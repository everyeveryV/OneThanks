import { mnemonicToAccount } from "viem/accounts";

// Public Hardhat development mnemonic; these addresses must never sign public deployments.
const localAccounts = new Set(
  Array.from({ length: 20 }, (_, addressIndex) =>
    mnemonicToAccount("test test test test test test test test test test test junk", {
      addressIndex,
    }).address.toLowerCase(),
  ),
);
export const isLocalTestAccount = (address: string) => localAccounts.has(address.toLowerCase());
