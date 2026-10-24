# 一句谢谢 OneThanks

🎬 [观看项目介绍视频](./docs/media/onethanks.mp4) · [下载 MP4](https://github.com/everyeveryV/OneThanks/raw/refs/heads/main/docs/media/onethanks.mp4)

本仓库实现基于 Scaffold-ETH 2 的 OneThanks MVP：给 GitHub 作者寄公开感谢与测试 ETH，通过公开 Gist 逐卡领取，或由原发送者在到期后退款。

网站：[onethanks.vercel.app](https://onethanks.vercel.app/)。使用 Ethereum Sepolia 测试网；作者有 30 分钟领取，到期后寄出者可手动退款。

合约：[0x4fddbbe651da583fe815e99e3cb1bc4d732b7e87](https://sepolia.etherscan.io/address/0x4fddbbe651da583fe815e99e3cb1bc4d732b7e87)。本地启动、Gist 验收与部署配置请看 [中文使用说明](./ONETHANKS.zh-CN.md)。真实账号 Gist 成功领取的端到端验收仍待完成。

本仓库不包含运行环境密钥。请从 `.env.example` 配置；`.env`、`.env.local`、钱包文件、本地部署记录和构建产物均不应提交。源码中的 Hardhat 固定测试密钥是公开的本地开发账户，不能用于公共网络或存放真实资产。

安装 Node.js 22.10+ 和 Yarn 4 后，可在任意系统运行：

```sh
yarn install
yarn setup:local
# 三个终端依次运行
yarn chain
yarn deploy
yarn start
```

---

# 🏗 Scaffold-ETH 2

<h4 align="center">
  <a href="https://docs.scaffoldeth.io">Documentation</a> |
  <a href="https://scaffoldeth.io">Website</a>
</h4>

🧪 An open-source, up-to-date toolkit for building decentralized applications (dapps) on the Ethereum blockchain. It's designed to make it easier for developers to create and deploy smart contracts and build user interfaces that interact with those contracts.

> [!NOTE]
> 🤖 Scaffold-ETH 2 is AI-ready! It has everything agents need to build on Ethereum. Check `.agents/`, `.claude/`, `.opencode` or `.cursor/` for more info.

⚙️ Built using NextJS, RainbowKit, Hardhat, Wagmi, Viem, and Typescript.

- ✅ **Contract Hot Reload**: Your frontend auto-adapts to your smart contract as you edit it.
- 🪝 **[Custom hooks](https://docs.scaffoldeth.io/hooks/)**: Collection of React hooks wrapper around [wagmi](https://wagmi.sh/) to simplify interactions with smart contracts with typescript autocompletion.
- 🧱 [**Components**](https://docs.scaffoldeth.io/components/): Collection of common web3 components to quickly build your frontend.
- 🔥 **Burner Wallet & Local Faucet**: Quickly test your application with a burner wallet and local faucet.
- 🔐 **Integration with Wallet Providers**: Connect to different wallet providers and interact with the Ethereum network.

![Debug Contracts tab](https://github.com/scaffold-eth/scaffold-eth-2/assets/55535804/b237af0c-5027-4849-a5c1-2e31495cccb1)

## Requirements

Before you begin, you need to install the following tools:

- [Node (>= v22.10.0)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))
- [Git](https://git-scm.com/downloads)

## Quickstart

To get started with Scaffold-ETH 2, follow the steps below:

1. Install dependencies if it was skipped in CLI:

```
cd my-dapp-example
yarn install
```

2. Run a local network in the first terminal:

```
yarn chain
```

This command starts a local Ethereum network using Hardhat. The network runs on your local machine and can be used for testing and development. You can customize the network configuration in `packages/hardhat/hardhat.config.ts`.

3. On a second terminal, deploy the test contract:

```
yarn deploy
```

This command deploys a test smart contract to the local network. The contract is located in `packages/hardhat/contracts` and can be modified to suit your needs. The `yarn deploy` command uses the deploy script located in `packages/hardhat/deploy` to deploy the contract to the network. You can also customize the deploy script.

4. On a third terminal, start your NextJS app:

```
yarn start
```

Visit your app on: `http://localhost:3000`. You can interact with your smart contract using the `Debug Contracts` page. You can tweak the app config in `packages/nextjs/scaffold.config.ts`.

Run smart contract test with `yarn hardhat:test`

- Edit your smart contracts in `packages/hardhat/contracts`
- Edit your frontend homepage at `packages/nextjs/app/page.tsx`. For guidance on [routing](https://nextjs.org/docs/app/building-your-application/routing/defining-routes) and configuring [pages/layouts](https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts) checkout the Next.js documentation.
- Edit your deployment scripts in `packages/hardhat/deploy`


## Documentation

Visit our [docs](https://docs.scaffoldeth.io) to learn how to start building with Scaffold-ETH 2.

To know more about its features, check out our [website](https://scaffoldeth.io).

## Contributing to Scaffold-ETH 2

We welcome contributions to Scaffold-ETH 2!

Please see [CONTRIBUTING.MD](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/CONTRIBUTING.md) for more information and guidelines for contributing to Scaffold-ETH 2.
