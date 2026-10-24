import { getParsedError } from "~~/utils/scaffold-eth";

export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    signal,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "请求失败，请稍后重试。");
  return data;
}

export function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/reject|denied/i.test(message)) return "你取消了钱包签名，尚未完成交易。";
  if (/expired/i.test(message)) return "卡片或领取凭证已到期，请刷新后重试。";
  if (/InvalidSignature/i.test(message)) return "领取序号可能已变化，请重新生成声明。";
  if (/fetch|network|timeout|http request/i.test(message)) return "网络请求失败，尚未确认成功，请刷新链上状态后重试。";
  return getParsedError(error) || message;
}
