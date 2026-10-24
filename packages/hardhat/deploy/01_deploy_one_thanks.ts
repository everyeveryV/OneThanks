import { isAddress, Wallet } from "ethers";
import { deployScript, artifacts } from "../rocketh/deploy.js";
import { isLocalTestAccount } from "../../nextjs/utils/onethanks/local-accounts.js";

export default deployScript(
  async env => {
    const chainId = Number(await env.network.provider.request({ method: "eth_chainId" }));
    const local = chainId === 31337;
    if (!local && chainId !== 11155111) throw new Error("OneThanks only supports local Hardhat and Sepolia");
    const configured = process.env.ONETHANKS_SIGNER_ADDRESS;
    const signer =
      configured ||
      (local ? new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d").address : undefined);
    if (!signer || !isAddress(signer) || /^0x0{40}$/i.test(signer))
      throw new Error("Set ONETHANKS_SIGNER_ADDRESS to a dedicated signer");
    if (
      !local &&
      (signer.toLowerCase() === env.namedAccounts.deployer.toLowerCase() ||
        isLocalTestAccount(signer) ||
        isLocalTestAccount(env.namedAccounts.deployer))
    )
      throw new Error("Use a dedicated non-Hardhat signer on Sepolia");
    await env.deploy("OneThanks", {
      account: env.namedAccounts.deployer,
      artifact: artifacts.OneThanks,
      args: [signer as `0x${string}`, local ? 60n : 1800n],
    });
  },
  { tags: ["OneThanks"] },
);
