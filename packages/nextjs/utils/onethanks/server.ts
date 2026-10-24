import { isLocalTestAccount } from "./local-accounts";
import { ApiError } from "./proof";
import "server-only";
import { type Address, type Hex, createPublicClient, http, isAddress, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import deployedContracts from "~~/contracts/deployedContracts";
import { oneThanksAbi } from "~~/contracts/oneThanksAbi";
import scaffoldConfig from "~~/scaffold.config";

export async function serverContext() {
  const chain = scaffoldConfig.targetNetworks[0];
  const registry = deployedContracts as Record<number, { OneThanks?: { address: Address; abi: readonly unknown[] } }>;
  const deployment = registry[chain.id]?.OneThanks;
  if (!deployment) throw new ApiError(503, "当前网络尚未部署 OneThanks。");
  const key = process.env.SIGNER_PRIVATE_KEY;
  const secret = process.env.CLAIM_HMAC_SECRET;
  const rpc = process.env.ONETHANKS_RPC_URL || (chain.id === 31337 ? "http://127.0.0.1:8545" : undefined);
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key) || !secret || secret.length < 32 || !rpc)
    throw new ApiError(503, "认领服务尚未配置，请联系演示维护者。");
  const account = privateKeyToAccount(key as Hex);
  if (chain.id !== 31337 && isLocalTestAccount(account.address)) throw new ApiError(503, "测试网签名者配置不安全。");
  const client = createPublicClient({ chain, transport: http(rpc, { timeout: 8000, retryCount: 0 }) });
  const contract = { address: deployment.address, abi: oneThanksAbi };
  const [actualChain, signer] = await Promise.all([
    client.getChainId(),
    client.readContract({ ...contract, functionName: "signer" }),
  ]);
  if (actualChain !== chain.id || signer.toLowerCase() !== account.address.toLowerCase())
    throw new ApiError(503, "网络或签名者配置不一致，已停止签发。");
  return { chain, contract, client, account, secret };
}

export async function cardContext(ctx: Awaited<ReturnType<typeof serverContext>>, id: bigint) {
  const card = await ctx.client.readContract({ ...ctx.contract, functionName: "thanks", args: [id] });
  if (card[0] === zeroAddress) throw new ApiError(404, "找不到这张感谢卡。");
  const [nonce, block] = await Promise.all([
    ctx.client.readContract({ ...ctx.contract, functionName: "claimNonce", args: [card[1]] }),
    ctx.client.getBlock(),
  ]);
  return {
    chainId: ctx.chain.id,
    contract: ctx.contract.address,
    githubId: card[1],
    nonce,
    refundAt: card[3],
    status: card[4],
    now: Number(block.timestamp),
  };
}

export function parseChallengeInput(body: Record<string, unknown>) {
  if (
    typeof body.thanksId !== "string" ||
    !/^[1-9][0-9]{0,77}$/.test(body.thanksId) ||
    BigInt(body.thanksId) >= 2n ** 256n ||
    typeof body.wallet !== "string" ||
    !isAddress(body.wallet) ||
    body.wallet === zeroAddress
  )
    throw new ApiError(400, "卡片编号或钱包地址不正确。");
  return { id: BigInt(body.thanksId), wallet: body.wallet };
}
