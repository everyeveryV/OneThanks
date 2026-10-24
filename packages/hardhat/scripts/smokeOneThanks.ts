import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Contract, JsonRpcProvider, parseEther } from "ethers";

// Integration smoke test against real local RPC + HTTP handlers. No fake Gist or signing bypass.
const origin = process.env.ONETHANKS_APP_URL || "http://127.0.0.1:3000";
const provider = new JsonRpcProvider("http://127.0.0.1:8545");
assert.equal((await provider.getNetwork()).chainId, 31337n, "This script is local-only");
const deployment = JSON.parse(readFileSync(new URL("../deployments/default/OneThanks.json", import.meta.url), "utf8"));
const sender = await provider.getSigner(0);
const contract = new Contract(deployment.address, deployment.abi, sender);
const request = async (path: string, body?: unknown) => {
  const response = await fetch(`${origin}${path}`, {
    ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  return { status: response.status, body: await response.json() };
};

const user = await request("/api/github/everyeveryV");
assert.equal(user.status, 200);
assert.equal(user.body.id, 214375212);
const sendReceipt = await (
  await contract.sendThanks(user.body.id, user.body.login, "本地验收：谢谢你让开源多了一种可能。", {
    value: parseEther("0.0005"),
  })
).wait();
assert.equal(sendReceipt.status, 1);
const id = await contract.thanksCount();
const card = await contract.thanks(id);
const wallet = await sender.getAddress();
const challenge = await request("/api/claim/challenge", { thanksId: String(id), wallet });
assert.equal(challenge.status, 200, JSON.stringify(challenge.body));
assert.equal(challenge.body.expiresAt, Number(card.refundAt));
assert.ok(challenge.body.statement.includes("githubId=214375212\n"));
assert.ok(challenge.body.statement.includes(`contract=${deployment.address}`));
assert.equal(
  (await request("/api/claim/verify", { gistUrl: "https://evil.example/123", statement: challenge.body.statement }))
    .status,
  400,
);
assert.equal(
  (
    await request("/api/claim/verify", {
      gistUrl: `https://gist.github.com/everyeveryV/${"a".repeat(32)}`,
      statement: challenge.body.statement.replace("thanksId=", "thanksId=9"),
    })
  ).status,
  400,
);
assert.equal((await request("/api/claim/challenge", { thanksId: "0", wallet })).status, 400);
assert.equal((await request("/api/claim/challenge", { thanksId: "999999", wallet })).status, 404);
assert.equal((await request("/api/github/github")).status, 400);

// Advance only the disposable local chain; leave its clock close to wall time.
await provider.send("evm_setNextBlockTimestamp", [Number(card.refundAt)]);
const refundReceipt = await (await contract.refund(id)).wait();
assert.equal(refundReceipt.status, 1);
assert.equal((await contract.thanks(id)).status, 2n);
assert.equal((await request("/api/claim/challenge", { thanksId: String(id), wallet })).status, 410);
console.log(
  JSON.stringify(
    {
      chainId: 31337,
      contract: deployment.address,
      githubLogin: user.body.login,
      cardId: String(id),
      sendTx: sendReceipt.hash,
      refundTx: refundReceipt.hash,
      result:
        "Real local send, challenge, forged-proof rejection and refund passed; real Gist claim still requires owner action.",
    },
    null,
    2,
  ),
);
