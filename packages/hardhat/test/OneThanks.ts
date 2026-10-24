import { expect } from "chai";
import { network } from "hardhat";
import { claimHash, type ClaimFields } from "../../nextjs/utils/onethanks/claim-hash.js";

const { ethers, networkHelpers } = await network.create();
const value = ethers.parseEther("0.0005");

async function fixture() {
  const [sender, signer, recipient, other] = await ethers.getSigners();
  const contract = await ethers.deployContract("OneThanks", [signer.address, 1800]);
  await contract.waitForDeployment();
  await contract.sendThanks(42, "alice", "谢谢你的开源！", { value });
  const address = (await contract.getAddress()) as `0x${string}`;
  const card = await contract.thanks(1);
  const fields: ClaimFields = {
    chainId: 31337,
    contract: address,
    thanksId: "1",
    githubId: "42",
    wallet: recipient.address as `0x${string}`,
    claimNonce: "0",
    expiresAt: Number(card.refundAt),
  };
  const sign = async (overrides: Partial<ClaimFields> = {}) =>
    signer.signMessage(ethers.getBytes(claimHash({ ...fields, ...overrides })));
  return { contract, sender, signer, recipient, other, fields, sign, card };
}

describe("OneThanks escrow", () => {
  it("validates constructor signer and refund window", async () => {
    const [sender] = await ethers.getSigners();
    await expect(ethers.deployContract("OneThanks", [ethers.ZeroAddress, 60])).to.be.revertedWithCustomError(
      await ethers.getContractFactory("OneThanks"),
      "InvalidInput",
    );
    await expect(ethers.deployContract("OneThanks", [sender.address, 0])).to.revert(ethers);
  });
  it("stores UTF-8 message and escrow, emits send event", async () => {
    const { contract, sender, card } = await networkHelpers.loadFixture(fixture);
    expect(card.sender).to.equal(sender.address);
    expect(card.message).to.equal("谢谢你的开源！");
    expect(await ethers.provider.getBalance(contract)).to.equal(value);
    await expect(contract.sendThanks(42, "alice", "Thank you", { value })).to.emit(contract, "ThanksSent");
    expect(await contract.thanksCount()).to.equal(2);
  });
  for (const [label, id, login, message, amount] of [
    ["zero ID", 0, "alice", "Thanks", value],
    ["insufficient value", 42, "alice", "Thanks", 1n],
    ["empty message", 42, "alice", "", value],
    ["UTF-8 byte overflow", 42, "alice", "谢".repeat(94), value],
    ["empty login", 42, "", "Thanks", value],
    ["long login", 42, "a".repeat(40), "Thanks", value],
  ] as const) {
    it(`rejects ${label}`, async () => {
      const { contract } = await networkHelpers.loadFixture(fixture);
      await expect(contract.sendThanks(id, login, message, { value: amount })).to.be.revertedWithCustomError(
        contract,
        "InvalidInput",
      );
    });
  }
  it("accepts exact 280-byte message and minimum amount", async () => {
    const { contract } = await networkHelpers.loadFixture(fixture);
    await contract.sendThanks(42, "alice", "谢".repeat(93) + "!", { value: ethers.parseEther("0.0001") });
  });
  it("pays only the signed recipient even when another account submits", async () => {
    const { contract, recipient, other, sign, fields } = await networkHelpers.loadFixture(fixture);
    const tx = contract.connect(other).claim(1, recipient.address, fields.expiresAt, await sign());
    await expect(tx).to.changeEtherBalances(ethers, [contract, recipient], [-value, value]);
    await expect(tx).to.emit(contract, "ThanksClaimed").withArgs(1, 42, recipient.address, value);
    expect((await contract.thanks(1)).status).to.equal(1);
    expect(await contract.claimNonce(42)).to.equal(1);
    await expect(contract.claim(1, recipient.address, fields.expiresAt, await sign())).to.be.revertedWithCustomError(
      contract,
      "NotPending",
    );
    await networkHelpers.time.increaseTo(fields.expiresAt);
    await expect(contract.refund(1)).to.be.revertedWithCustomError(contract, "NotPending");
  });
  for (const [label, overrides] of [
    ["chain", { chainId: 1 }],
    ["contract", { contract: "0x0000000000000000000000000000000000000001" }],
    ["card", { thanksId: "2" }],
    ["GitHub ID", { githubId: "43" }],
    ["nonce", { claimNonce: "1" }],
    ["recipient", { wallet: "0x0000000000000000000000000000000000000001" }],
  ] as const) {
    it(`rejects signature bound to wrong ${label}`, async () => {
      const { contract, recipient, fields, sign } = await networkHelpers.loadFixture(fixture);
      await expect(
        contract.claim(1, recipient.address, fields.expiresAt, await sign(overrides)),
      ).to.be.revertedWithCustomError(contract, "InvalidSignature");
    });
  }
  it("rejects wrong signer, malformed signature, zero recipient and nonexistent card", async () => {
    const { contract, recipient, other, fields, sign } = await networkHelpers.loadFixture(fixture);
    const sig = await other.signMessage(ethers.getBytes(claimHash(fields)));
    await expect(contract.claim(1, recipient.address, fields.expiresAt, sig)).to.be.revertedWithCustomError(
      contract,
      "InvalidSignature",
    );
    await expect(contract.claim(1, recipient.address, fields.expiresAt, "0x1234")).to.revert(ethers);
    await expect(contract.claim(1, ethers.ZeroAddress, fields.expiresAt, await sign())).to.be.revertedWithCustomError(
      contract,
      "InvalidInput",
    );
    await expect(contract.claim(99, recipient.address, fields.expiresAt, await sign())).to.be.revertedWithCustomError(
      contract,
      "NotPending",
    );
    await expect(contract.refund(99)).to.be.revertedWithCustomError(contract, "NotPending");
  });
  it("invalidates all old author credentials after one claim", async () => {
    const { contract, recipient, fields, sign } = await networkHelpers.loadFixture(fixture);
    await contract.sendThanks(42, "alice", "Second card", { value });
    const oldSig = await sign({ thanksId: "2" });
    await contract.claim(1, recipient.address, fields.expiresAt, await sign());
    await expect(contract.claim(2, recipient.address, fields.expiresAt, oldSig)).to.be.revertedWithCustomError(
      contract,
      "InvalidSignature",
    );
    await contract.claim(2, recipient.address, fields.expiresAt, await sign({ thanksId: "2", claimNonce: "1" }));
  });
  it("rejects expired deadline and deadline beyond card expiry", async () => {
    const { contract, recipient, fields, sign } = await networkHelpers.loadFixture(fixture);
    const deadline = (await networkHelpers.time.latest()) + 10;
    await networkHelpers.time.setNextBlockTimestamp(deadline);
    await expect(
      contract.claim(1, recipient.address, deadline, await sign({ expiresAt: deadline })),
    ).to.be.revertedWithCustomError(contract, "Expired");
    await expect(
      contract.claim(1, recipient.address, fields.expiresAt + 1, await sign({ expiresAt: fields.expiresAt + 1 })),
    ).to.be.revertedWithCustomError(contract, "Expired");
  });
  it("allows claim one second before refund boundary", async () => {
    const { contract, recipient, fields, sign } = await networkHelpers.loadFixture(fixture);
    await networkHelpers.time.setNextBlockTimestamp(fields.expiresAt - 1);
    await contract.claim(1, recipient.address, fields.expiresAt, await sign());
  });
  it("at exact boundary disallows claim and allows sender refund", async () => {
    const { contract, recipient, sender, fields, sign } = await networkHelpers.loadFixture(fixture);
    await networkHelpers.time.setNextBlockTimestamp(fields.expiresAt);
    await expect(contract.claim(1, recipient.address, fields.expiresAt, await sign())).to.be.revertedWithCustomError(
      contract,
      "Expired",
    );
    await expect(contract.refund(1)).to.changeEtherBalances(ethers, [contract, sender], [-value, value]);
    expect((await contract.thanks(1)).status).to.equal(2);
    await expect(contract.refund(1)).to.be.revertedWithCustomError(contract, "NotPending");
    await expect(contract.claim(1, recipient.address, fields.expiresAt, await sign())).to.be.revertedWithCustomError(
      contract,
      "NotPending",
    );
  });
  it("refund succeeds at exact refundAt and emits event", async () => {
    const { contract, sender, fields } = await networkHelpers.loadFixture(fixture);
    await networkHelpers.time.setNextBlockTimestamp(fields.expiresAt);
    await expect(contract.refund(1)).to.emit(contract, "ThanksRefunded").withArgs(1, sender.address, value);
  });
  it("rejects early refund and non-sender refund", async () => {
    const { contract, other, fields } = await networkHelpers.loadFixture(fixture);
    await expect(contract.refund(1)).to.be.revertedWithCustomError(contract, "RefundUnavailable");
    await networkHelpers.time.increaseTo(fields.expiresAt);
    await expect(contract.connect(other).refund(1)).to.be.revertedWithCustomError(contract, "RefundUnavailable");
  });
  it("rolls back status and nonce if recipient rejects ETH", async () => {
    const { contract, fields, sign } = await networkHelpers.loadFixture(fixture);
    const receiver = await ethers.deployContract("PayoutReceiver", [await contract.getAddress()]);
    await receiver.setReject(true);
    const to = (await receiver.getAddress()) as `0x${string}`;
    await expect(contract.claim(1, to, fields.expiresAt, await sign({ wallet: to }))).to.be.revertedWithCustomError(
      contract,
      "TransferFailed",
    );
    expect((await contract.thanks(1)).status).to.equal(0);
    expect(await contract.claimNonce(42)).to.equal(0);
    expect(await ethers.provider.getBalance(contract)).to.equal(value);
  });
  it("refund rejection rolls back; reentry cannot withdraw a second card during claim", async () => {
    const { contract, fields, sign } = await networkHelpers.loadFixture(fixture);
    const receiver = await ethers.deployContract("PayoutReceiver", [await contract.getAddress()]);
    await receiver.send({ value });
    const second = await contract.thanks(2);
    await networkHelpers.time.increaseTo(second.refundAt);
    await receiver.setReject(true);
    await expect(receiver.refund()).to.be.revertedWithCustomError(contract, "TransferFailed");
    expect((await contract.thanks(2)).status).to.equal(0);
    await receiver.setReject(false);
    await contract.sendThanks(42, "alice", "Third card", { value });
    const third = await contract.thanks(3);
    const to = (await receiver.getAddress()) as `0x${string}`;
    await contract.claim(
      3,
      to,
      third.refundAt,
      await sign({ ...fields, thanksId: "3", wallet: to, expiresAt: Number(third.refundAt) }),
    );
    expect(await receiver.reentrySucceeded()).to.equal(false);
    expect((await contract.thanks(2)).status).to.equal(0);
    await receiver.refund();
    expect(await receiver.reentrySucceeded()).to.equal(false);
    expect((await contract.thanks(2)).status).to.equal(2);
  });
  it("pages newest-first with author isolation and bounded limits", async () => {
    const { contract } = await networkHelpers.loadFixture(fixture);
    for (let i = 0; i < 21; i++) await contract.sendThanks(42, "alice", "Thank you", { value });
    await contract.sendThanks(43, "bob", "Thanks", { value });
    expect(await contract.getIds(42, 0, 20)).to.deep.equal(Array.from({ length: 20 }, (_, i) => BigInt(22 - i)));
    expect(await contract.getIds(42, 20, 20)).to.deep.equal([2n, 1n]);
    expect(await contract.getIds(43, 0, 20)).to.deep.equal([23n]);
    expect(await contract.getIds(42, 22, 20)).to.deep.equal([]);
    expect(await contract.getIds(42, ethers.MaxUint256, 20)).to.deep.equal([]);
    await expect(contract.getIds(42, 0, 21)).to.be.revertedWithCustomError(contract, "InvalidInput");
    await expect(contract.getIds(42, 0, 0)).to.be.revertedWithCustomError(contract, "InvalidInput");
  });
});
