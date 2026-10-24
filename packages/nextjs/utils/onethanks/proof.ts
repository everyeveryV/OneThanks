import { ClaimFields } from "./claim-hash";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isAddress, zeroAddress } from "viem";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Challenge = ClaimFields & { version: string; challengeId: string; issuedAt: number };
const keys = [
  "version",
  "thanksId",
  "githubId",
  "wallet",
  "chainId",
  "contract",
  "claimNonce",
  "challengeId",
  "issuedAt",
  "expiresAt",
] as const;
const uint = /^(0|[1-9][0-9]{0,77})$/;
export const normalizeStatement = (s: string) => s.replace(/\r\n/g, "\n").replace(/\n$/, "");
const payload = (c: Challenge) => keys.map(k => `${k}=${c[k]}`).join("\n");
const mac = (s: string, secret: string) => createHmac("sha256", secret).update(s).digest("hex");

export function issueStatement(fields: ClaimFields, now: number, secret: string) {
  const c: Challenge = { ...fields, version: "1", challengeId: randomBytes(24).toString("hex"), issuedAt: now };
  const text = payload(c);
  return `${text}\nhmac=${mac(text, secret)}`;
}

export function parseStatement(input: unknown, secret: string, now: number): Challenge {
  if (typeof input !== "string" || Buffer.byteLength(input) > 4096)
    throw new ApiError(400, "声明过长或格式不正确，请重新生成。");
  const lines = normalizeStatement(input).split("\n");
  const allKeys = [...keys, "hmac"];
  if (lines.length !== allKeys.length) throw new ApiError(400, "声明字段缺失或重复。");
  const data: Record<string, string> = {};
  lines.forEach((line, i) => {
    const prefix = `${allKeys[i]}=`;
    if (!line.startsWith(prefix)) throw new ApiError(400, "请完整复制原始声明，不要修改字段或顺序。");
    data[allKeys[i]] = line.slice(prefix.length);
  });
  if (
    !/^[a-f0-9]{64}$/.test(data.hmac) ||
    !timingSafeEqual(Buffer.from(data.hmac, "hex"), Buffer.from(mac(lines.slice(0, -1).join("\n"), secret), "hex"))
  )
    throw new ApiError(400, "声明已被修改，请重新生成。");
  if (data.version !== "1" || !/^[a-f0-9]{48}$/.test(data.challengeId)) throw new ApiError(400, "不支持的声明。");
  for (const k of ["thanksId", "githubId", "chainId", "claimNonce", "issuedAt", "expiresAt"]) {
    if (!uint.test(data[k]) || BigInt(data[k]) >= 2n ** 256n) throw new ApiError(400, "声明数字格式错误。");
  }
  if (BigInt(data.githubId) === 0n || BigInt(data.githubId) >= 2n ** 64n || BigInt(data.thanksId) === 0n)
    throw new ApiError(400, "声明编号错误。");
  if (
    !isAddress(data.wallet) ||
    data.wallet === zeroAddress ||
    !isAddress(data.contract) ||
    data.contract === zeroAddress
  )
    throw new ApiError(400, "声明地址错误。");
  const issuedAt = Number(data.issuedAt),
    expiresAt = Number(data.expiresAt),
    chainId = Number(data.chainId);
  if (
    ![issuedAt, expiresAt, chainId].every(Number.isSafeInteger) ||
    issuedAt > now ||
    expiresAt <= now ||
    expiresAt <= issuedAt ||
    expiresAt > issuedAt + 600
  )
    throw new ApiError(410, "声明尚未生效或已过期，请重新生成。");
  return { ...data, wallet: data.wallet, contract: data.contract, issuedAt, expiresAt, chainId } as Challenge;
}

export function gistIdFromUrl(input: unknown) {
  if (typeof input !== "string" || input.length > 250) throw new ApiError(400, "请输入公开 Gist 链接。");
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ApiError(400, "Gist 链接无效。");
  }
  const match = url.pathname.match(/^\/(?:[a-zA-Z0-9-]{1,39}\/)?([a-fA-F0-9]{20,32})\/?$/);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "gist.github.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    !match
  )
    throw new ApiError(400, "仅支持 https://gist.github.com/用户名/Gist编号 链接。");
  return match[1];
}

export function validateGist(gist: unknown, c: Challenge, statement: string) {
  const g = gist as {
    public?: boolean;
    truncated?: boolean;
    owner?: { id?: number; type?: string };
    files?: Record<string, { content?: string; truncated?: boolean; size?: number }>;
  } | null;
  const file = g?.files?.["onethanks.txt"];
  if (
    !g?.public ||
    g.truncated ||
    g.owner?.type !== "User" ||
    !Number.isSafeInteger(g.owner?.id) ||
    String(g.owner?.id) !== c.githubId
  )
    throw new ApiError(403, "Gist 必须由这位 GitHub 作者创建，并设为公开。");
  if (
    !file ||
    file.truncated ||
    typeof file.content !== "string" ||
    (file.size ?? 0) > 4096 ||
    Buffer.byteLength(file.content) > 4096
  )
    throw new ApiError(400, "请创建完整、未截断的 onethanks.txt 文件（不超过 4 KB）。");
  if (normalizeStatement(file.content) !== normalizeStatement(statement))
    throw new ApiError(400, "Gist 内容与当前声明不一致，请粘贴完整声明。");
}

export function validateContext(
  c: Challenge,
  current: { chainId: number; contract: string; githubId: bigint; nonce: bigint; refundAt: bigint; status: number },
  now: number,
) {
  if (
    c.chainId !== current.chainId ||
    c.contract.toLowerCase() !== current.contract.toLowerCase() ||
    BigInt(c.githubId) !== current.githubId
  )
    throw new ApiError(409, "部署或卡片已变化，请重新生成声明。");
  if (current.status !== 0 || BigInt(c.claimNonce) !== current.nonce)
    throw new ApiError(409, "卡片已处理或领取序号已变化，请重新生成声明。");
  if (BigInt(now) >= current.refundAt || c.expiresAt <= now || BigInt(c.expiresAt) > current.refundAt)
    throw new ApiError(410, "卡片或声明已到期，无法领取。");
}
