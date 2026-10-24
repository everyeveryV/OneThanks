import { ApiError } from "./proof";

export async function boundedJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError(415, "仅接受 JSON 请求。");
  if (Number(request.headers.get("content-length")) > 8192) throw new ApiError(413, "请求内容过长。");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "请求内容为空。");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        throw new ApiError(413, "请求内容过长。");
      }
      chunks.push(value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "请求 JSON 无效。");
  } finally {
    reader.releaseLock();
  }
}

export function apiFailure(e: unknown) {
  // Never expose RPC URLs, credentials, or provider errors to the browser.
  return Response.json(
    { error: e instanceof ApiError ? e.message : "服务暂不可用，请检查网络或稍后重试。" },
    { status: e instanceof ApiError ? e.status : 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function githubJson(path: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(`https://api.github.com${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ApiError(503, "GitHub 请求超时或网络不可用，请稍后重试。");
  }
  if (response.status === 403 || response.status === 429) throw new ApiError(429, "GitHub 暂时限流，请稍后重试。");
  if (response.status === 404) throw new ApiError(404, "没有找到该 GitHub 用户或公开 Gist。");
  if (!response.ok) throw new ApiError(502, "GitHub 暂时不可用，请稍后重试。");
  return response.json();
}

export type GithubUser = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
};
export function validateUser(input: unknown): GithubUser {
  const user = input as GithubUser & { type?: string };
  if (!user || user.type !== "User") throw new ApiError(400, "当前仅支持 GitHub 个人账号，不支持组织账号。");
  if (!Number.isSafeInteger(user.id) || user.id <= 0 || !/^[a-zA-Z0-9-]{1,39}$/.test(user.login))
    throw new ApiError(502, "GitHub 用户数据异常。");
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    html_url: `https://github.com/${user.login}`,
    bio: user.bio,
  };
}
