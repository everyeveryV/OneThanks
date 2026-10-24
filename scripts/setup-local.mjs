import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const file = new URL("../packages/nextjs/.env.local", import.meta.url);
if (existsSync(file)) {
  console.log(".env.local already exists; preserved. See .env.example for required values.");
} else {
  writeFileSync(file, [
    "# LOCAL HARDHAT ONLY. This signing key is publicly known. Never use it on Sepolia.",
    "NEXT_PUBLIC_ONETHANKS_CHAIN_ID=31337",
    "ONETHANKS_RPC_URL=http://127.0.0.1:8545",
    "SIGNER_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    `CLAIM_HMAC_SECRET=${randomBytes(32).toString("hex")}`,
    "",
  ].join("\n"), { mode: 0o600, flag: "wx" });
  console.log("Created ignored local environment. Restart Next.js to load it. No secrets printed.");
}
