import { apiFailure, githubJson, validateUser } from "~~/utils/onethanks/http";
import { ApiError } from "~~/utils/onethanks/proof";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ login: string }> }) {
  try {
    const { login } = await params;
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(login))
      throw new ApiError(400, "请输入有效的 GitHub 用户名。");
    return Response.json(validateUser(await githubJson(`/users/${encodeURIComponent(login)}`)), {
      headers: { "Cache-Control": "public, max-age=30" },
    });
  } catch (e) {
    return apiFailure(e);
  }
}
