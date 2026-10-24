import { Address, encodeAbiParameters, keccak256, parseAbiParameters } from "viem";

export type ClaimFields = {
  chainId: number;
  contract: Address;
  thanksId: string;
  githubId: string;
  wallet: Address;
  claimNonce: string;
  expiresAt: number;
};

// Shared by production signing and the Solidity integration tests.
export function claimHash(c: ClaimFields) {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("uint256, address, uint256, uint64, address, uint256, uint256"), [
      BigInt(c.chainId),
      c.contract,
      BigInt(c.thanksId),
      BigInt(c.githubId),
      c.wallet,
      BigInt(c.claimNonce),
      BigInt(c.expiresAt),
    ]),
  );
}
