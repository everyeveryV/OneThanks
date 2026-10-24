import { expect } from "chai";
import { createHmac } from "node:crypto";
import {
  issueStatement,
  parseStatement,
  gistIdFromUrl,
  validateGist,
  validateContext,
  ApiError,
} from "../../nextjs/utils/onethanks/proof.js";
import { boundedJson, githubJson, validateUser } from "../../nextjs/utils/onethanks/http.js";
import type { ClaimFields } from "../../nextjs/utils/onethanks/claim-hash.js";

const secret = "test-only-hmac-key-32-characters-long";
const now = 1800000000;
const fields: ClaimFields = {
  chainId: 31337,
  contract: "0x1111111111111111111111111111111111111111",
  thanksId: "1",
  githubId: "42",
  wallet: "0x2222222222222222222222222222222222222222",
  claimNonce: "0",
  expiresAt: now + 600,
};
const issue = (changes: Partial<ClaimFields> = {}, at = now) => issueStatement({ ...fields, ...changes }, at, secret);
const context = {
  chainId: 31337,
  contract: fields.contract,
  githubId: 42n,
  nonce: 0n,
  refundAt: BigInt(now + 1800),
  status: 0,
};
const gist = (text: string) => ({
  public: true,
  owner: { id: 42, type: "User" },
  files: { "onethanks.txt": { content: text, truncated: false, size: Buffer.byteLength(text) } },
});
const response = (status: number, data: unknown = {}) => (async () => Response.json(data, { status })) as typeof fetch;
async function fails(action: () => Promise<unknown>, status: number) {
  try {
    await action();
    expect.fail("expected request rejection");
  } catch (e) {
    expect(e).to.be.instanceOf(ApiError);
    expect((e as ApiError).status).to.equal(status);
  }
}

describe("OneThanks production proof / HTTP helpers", () => {
  it("round trips a fixed-deadline challenge and permits idempotent retry", () => {
    const statement = issue();
    expect(parseStatement(statement, secret, now).expiresAt).to.equal(now + 600);
    expect(parseStatement(statement, secret, now + 100).expiresAt).to.equal(now + 600);
    expect(parseStatement(issue({ expiresAt: now + 30 }), secret, now).expiresAt).to.equal(now + 30);
  });
  it("accepts only CRLF normalization and one trailing newline", () => {
    const statement = issue();
    const c = parseStatement(statement.replace(/\n/g, "\r\n") + "\r\n", secret, now);
    validateGist(gist(statement + "\n"), c, statement);
    expect(() => validateGist(gist(statement + "\n\n"), c, statement)).to.throw(ApiError);
    expect(() => validateGist(gist(" " + statement), c, statement)).to.throw(ApiError);
  });
  it("rejects tampered fields, missing/duplicate fields and wrong HMAC key", () => {
    const text = issue();
    for (const invalid of [
      text.replace("thanksId=1", "thanksId=2"),
      text + "\nthanksId=1",
      text.replace("version=1\n", ""),
      text.replace("hmac=", "hmac=aa"),
      text + "\n\n",
    ])
      expect(() => parseStatement(invalid, secret, now)).to.throw(ApiError);
    expect(() => parseStatement(text, "other-key", now)).to.throw(ApiError);
  });
  it("rejects unknown versions, invalid typed fields even with a valid HMAC", () => {
    const statement = issue();
    for (const [before, after] of [
      ["version=1", "version=2"],
      ["thanksId=1", "thanksId=01"],
      ["githubId=42", "githubId=18446744073709551616"],
      ["chainId=31337", "chainId=NaN"],
      [fields.wallet, "0x0000000000000000000000000000000000000000"],
    ]) {
      const payload = statement.split("\nhmac=")[0].replace(before, after);
      const signed = `${payload}\nhmac=${createHmac("sha256", secret).update(payload).digest("hex")}`;
      expect(() => parseStatement(signed, secret, now)).to.throw(ApiError);
    }
  });
  it("rejects future, expired and longer-than-ten-minute challenges", () => {
    expect(() => parseStatement(issue(), secret, now - 1)).to.throw(ApiError);
    expect(() => parseStatement(issue(), secret, now + 600)).to.throw(ApiError);
    expect(() => parseStatement(issue({ expiresAt: now + 601 }), secret, now)).to.throw(ApiError);
    expect(() => parseStatement("x".repeat(4097), secret, now)).to.throw(ApiError);
  });
  it("rejects stale nonce, wrong deployment, wrong ID, terminal state and refund boundary", () => {
    const c = parseStatement(issue(), secret, now);
    validateContext(c, context, now);
    for (const change of [
      { chainId: 1 },
      { contract: fields.wallet },
      { githubId: 43n },
      { nonce: 1n },
      { status: 1 },
      { status: 2 },
      { refundAt: BigInt(now) },
      { refundAt: BigInt(now + 599) },
    ])
      expect(() => validateContext(c, { ...context, ...change }, now)).to.throw(ApiError);
    expect(() => validateContext(c, context, now + 600)).to.throw(ApiError);
  });
  it("rejects other owner, missing owner, private gist and missing/truncated/large file", () => {
    const text = issue();
    const c = parseStatement(text, secret, now);
    const invalid = [
      null,
      { ...gist(text), owner: { id: 43, type: "User" } },
      { ...gist(text), owner: null },
      { ...gist(text), public: false },
      { ...gist(text), truncated: true },
      { ...gist(text), files: {} },
      { ...gist(text), files: { "onethanks.txt": { content: text, truncated: true } } },
      { ...gist(text), files: { "onethanks.txt": { content: text, size: 4097 } } },
    ];
    for (const input of invalid) expect(() => validateGist(input, c, text)).to.throw(ApiError);
  });
  it("accepts canonical GitHub Gist URL only, never arbitrary hosts", () => {
    const id = "a".repeat(32);
    expect(gistIdFromUrl(`https://gist.github.com/alice/${id}`)).to.equal(id);
    for (const url of [
      `http://gist.github.com/alice/${id}`,
      `https://evil.test/${id}`,
      `https://gist.github.com.evil.test/alice/${id}`,
      `https://user@gist.github.com/alice/${id}`,
      `https://gist.github.com:444/alice/${id}`,
      `https://gist.github.com/alice/${id}?url=evil`,
      `https://gist.github.com/alice/${id}/raw`,
      "file:///etc/passwd",
      "broken",
    ])
      expect(() => gistIdFromUrl(url)).to.throw(ApiError);
  });
  it("supports individual GitHub users, refuses organizations and invalid IDs", () => {
    expect(validateUser({ type: "User", id: 42, login: "Alice" }).login).to.equal("Alice");
    expect(() => validateUser({ type: "Organization", id: 42, login: "org" })).to.throw(ApiError);
    expect(() => validateUser({ type: "User", id: NaN, login: "alice" })).to.throw(ApiError);
  });
  it("fails closed on GitHub timeout, rate limits, redirects and missing Gists", async () => {
    await fails(() => githubJson("/gists/a", response(403)), 429);
    await fails(() => githubJson("/gists/a", response(429)), 429);
    await fails(() => githubJson("/users/no-user", response(404)), 404);
    await fails(() => githubJson("/gists/a", response(500)), 502);
    await fails(
      () =>
        githubJson("/gists/a", (async () => {
          throw new Error("Timeout");
        }) as typeof fetch),
      503,
    );
    let called = false;
    await githubJson("/gists/abc", (async (url, init) => {
      called = true;
      expect(url).to.equal("https://api.github.com/gists/abc");
      expect(init?.redirect).to.equal("error");
      expect(init?.cache).to.equal("no-store");
      expect(init?.signal).to.be.instanceOf(AbortSignal);
      return Response.json({});
    }) as typeof fetch);
    expect(called).to.equal(true);
  });
  it("bounds JSON request bodies including chunked streams", async () => {
    const request = (body: string, headers = { "content-type": "application/json" }) =>
      new Request("https://localhost/api", { method: "POST", headers, body });
    expect(await boundedJson(request('{"thanksId":"1"}'))).to.deep.equal({ thanksId: "1" });
    await fails(() => boundedJson(request("not json")), 400);
    await fails(() => boundedJson(request("[]")), 400);
    await fails(() => boundedJson(request("null")), 400);
    await fails(() => boundedJson(request("{}", { "content-type": "text/plain" })), 415);
    await fails(() => boundedJson(request(JSON.stringify({ text: "x".repeat(9000) }))), 413);
  });
});
