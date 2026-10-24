# 以太坊一日黑客松：本地开发

项目位置：`D:\CodexWorkspace\ethereum-hackathon`

由官方 `create-eth@2.0.23` 生成，选择 Hardhat 模板。包含 Next.js 前端、Solidity 合约、钱包连接和 Debug Contracts 调试页。

## 启动

打开三个 PowerShell 终端，每个先进入项目目录：

```powershell
cd D:\CodexWorkspace\ethereum-hackathon
```

1. 第一个终端启动本地以太坊节点，保持运行：

   ```powershell
   .\dev.cmd chain
   ```

2. 节点启动后，第二个终端部署示例合约：

   ```powershell
   .\dev.cmd deploy
   ```

3. 第三个终端启动前端，保持运行：

   ```powershell
   .\dev.cmd start
   ```

访问 <http://localhost:3000>，合约调试页为 <http://localhost:3000/debug>。用终端里的 Ctrl+C 停止节点或前端。重启本地节点后需要再次部署合约。

`dev.cmd` 会自动使用工作区的 Node.js 22.23.4 和项目附带的 Yarn 4.13.0；它接受与 `yarn` 相同的参数。例如，官方文档中的 `yarn test` 在这里可执行为 `.\dev.cmd test`。系统默认 Node.js 未被更改。

## 修改哪些文件

- 首页：`packages/nextjs/app/page.tsx`
- 示例合约：`packages/hardhat/contracts/YourContract.sol`
- 部署脚本：`packages/hardhat/deploy/`
- 合约测试：`packages/hardhat/test/YourContract.ts`
- 前端链配置：`packages/nextjs/scaffold.config.ts`
- 合约链配置：`packages/hardhat/hardhat.config.ts`
- AI 开发说明：`AGENTS.md`
- 项目自带 skills：`.agents/skills/`，包括 OpenZeppelin、ERC-721、SIWE、Subgraph、Ponder、EIP-5792、x402 和 Drizzle/Neon。

修改合约后运行 `.\dev.cmd deploy`，会同步生成前端所需的合约 ABI。

## 常用检查

```powershell
.\dev.cmd compile
.\dev.cmd test
.\dev.cmd next:check-types
.\dev.cmd lint
```

当前采用本地开发链，chain ID 为 31337，RPC 为 <http://127.0.0.1:8545>。模板中的测试账户和测试 ETH 仅用于本地开发。

## 环境位置

- Node.js / Corepack：`D:\CodexWorkspace\.tools\ethereum-runtime`
- Yarn 缓存：`D:\CodexWorkspace\.cache\ethereum-yarn`
- Corepack 缓存：`D:\CodexWorkspace\.cache\ethereum-corepack`

如果移动项目或换电脑，请安装 Node.js 22.23.4 或符合项目要求的更新版本，并安装 Yarn，然后按官方 README 使用 `yarn install`、`yarn chain`、`yarn deploy`、`yarn start`。

官方站点：<https://scaffoldeth.io/>；文档：<https://docs.scaffoldeth.io/>。

## 安装验证（2026-10-24）

- 依赖安装完成；Yarn 提示部分 peer dependency 不匹配，但未阻止安装和以下检查。
- Solidity 0.8.30 编译成功。
- 模板自带的 2 个合约测试通过。
- 前端 TypeScript 类型检查通过。
- 示例合约已成功部署到本地 Hardhat 链，并生成前端 ABI。
- 首页 `/` 和合约调试页 `/debug` 均返回 HTTP 200。
- 验证用服务已关闭；开始开发时按上面的三个步骤启动。

## Demo 使用什么网络

建议先在 Hardhat 本地链完成开发，再部署到 Sepolia 给评委或队友体验。以太坊官方将 Sepolia 推荐为应用开发的默认公共测试网：<https://ethereum.org/developers/docs/networks/>。

当前项目仍使用本地链。部署到 Sepolia 时，需要准备部署账户、测试 ETH 和可用 RPC，并同步修改 `packages/nextjs/scaffold.config.ts` 的目标网络。若赛题指定某条 L2，则遵循赛题使用对应的测试网。
