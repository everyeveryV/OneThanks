import { apiFailure, boundedJson } from "~~/utils/onethanks/http";
import { ApiError, issueStatement } from "~~/utils/onethanks/proof";
import { cardContext, parseChallengeInput, serverContext } from "~~/utils/onethanks/server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { id, wallet } = parseChallengeInput(await boundedJson(request));
    const ctx = await serverContext();
    const card = await cardContext(ctx, id);
    const now = Math.max(Math.floor(Date.now() / 1000), card.now);
    if (card.status !== 0 || BigInt(now) >= card.refundAt) throw new ApiError(410, "这张卡片已处理或已到期。");
    const expiresAt = Math.min(now + 600, Number(card.refundAt));
    const statement = issueStatement(
      {
        chainId: card.chainId,
        contract: card.contract,
        githubId: String(card.githubId),
        thanksId: String(id),
        wallet,
        claimNonce: String(card.nonce),
        expiresAt,
      },
      now,
      ctx.secret,
    );
    return Response.json({ statement, expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return apiFailure(e);
  }
}
