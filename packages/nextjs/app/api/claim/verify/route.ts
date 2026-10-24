import { claimHash } from "~~/utils/onethanks/claim-hash";
import { apiFailure, boundedJson, githubJson } from "~~/utils/onethanks/http";
import { gistIdFromUrl, parseStatement, validateContext, validateGist } from "~~/utils/onethanks/proof";
import { cardContext, serverContext } from "~~/utils/onethanks/server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await boundedJson(request);
    const gistId = gistIdFromUrl(body.gistUrl);
    const ctx = await serverContext();
    const c = parseStatement(body.statement, ctx.secret, Math.floor(Date.now() / 1000));
    let current = await cardContext(ctx, BigInt(c.thanksId));
    validateContext(c, current, Math.max(current.now, Math.floor(Date.now() / 1000)));
    validateGist(await githubJson(`/gists/${gistId}`), c, body.statement as string);
    // Recheck after network I/O; never renew the original deadline.
    current = await cardContext(ctx, BigInt(c.thanksId));
    validateContext(c, current, Math.max(current.now, Math.floor(Date.now() / 1000)));
    const sig = await ctx.account.signMessage({ message: { raw: claimHash(c) } });
    return Response.json(
      { thanksId: c.thanksId, to: c.wallet, deadline: c.expiresAt, sig, chainId: c.chainId, contract: c.contract },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiFailure(e);
  }
}
