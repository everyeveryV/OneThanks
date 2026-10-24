# 一句谢谢 OneThanks

给 GitHub 个人账号寄一条公开感谢和少量测试 ETH。作者不需要预先绑定钱包；资金由合约托管，作者用公开 Gist 验证身份后逐张领取。到期未领取，由原寄出者手动退款。

这是依赖后端签名者的测试网 demo。签名者可授权领取，不是无信任身份验证。没有自动 GitHub 通知、自动退款、数据库或 OAuth。

当前交付为本地版本：39 项测试通过，生产构建通过，浏览器已验证真实本地寄出、生成声明和退款。真实账号 Gist 成功领取与 Sepolia/公网验收按用户选择留待后续。

## 本地启动

在项目根目录运行一次：

```powershell
.\dev.cmd setup:local
```

脚本只在文件不存在时生成被 Git 忽略的 `packages/nextjs/.env.local`，使用公开 Hardhat 签名账户和随机 HMAC 密钥，不会打印密钥。已有配置保留。

然后使用三个终端：

```powershell
# 终端 1：每 2 秒出块，本地卡片 60 秒后可退款
.\dev.cmd chain

# 终端 2：部署并同步前端地址和 ABI
.\dev.cmd deploy

# 终端 3：前端和动态 API
.\dev.cmd start
```

打开 <http://127.0.0.1:3000>。选择本地 Burner Wallet，用钱包旁的水龙头领取本地测试 ETH；也可使用连接到 31337 的外部钱包。重启节点后重新运行 deploy，并刷新页面。

## everyeveryV 的验收流程

GitHub 个人账号查询已确认：`everyeveryV`，数字 ID `214375212`。感谢墙地址为 <http://127.0.0.1:3000/u/everyeveryV>。

1. 首页查找 `everyeveryV`，填写感谢和预设金额，连接钱包并寄出。等交易确认后打开感谢墙。
2. 作者钱包必须有本地 gas。在新卡点「我是作者，领取」，生成声明。
3. 登录 `everyeveryV`，在 <https://gist.github.com/> 创建公开 Gist，文件名 `onethanks.txt`，内容粘贴页面生成的完整声明。
4. 将 Gist 链接粘回页面，点击「验证并领取这张卡」，确认钱包交易。只有回执成功才算领取成功。
5. 另寄一张卡，等待 60 秒。保持或切回原寄出钱包，在该卡点击「取回这份心意」，确认回执。

本地 60 秒窗口很短，请提前打开 Gist 编辑器；来不及则重新寄卡。Sepolia 窗口固定 30 分钟。声明最多 10 分钟且不超过卡片到期时间，重试不会延长。切钱包、切网络或另一张卡领取导致 nonce 更新后，应重新生成声明。

## 检查命令

```powershell
.\dev.cmd test
.\dev.cmd hardhat:check-types
.\dev.cmd next:check-types
.\dev.cmd lint
.\dev.cmd next:build
# 需要已经启动本地链、部署和网页：真实 RPC/API 寄出、挑战、拒绝伪造、退款
.\dev.cmd test:smoke
```

Smoke 脚本只允许本地 31337，会发送明确标注为本地验收的卡片并退款；不会伪造真实 Gist，也不会用测试签名绕过在线身份接口。完整 Gist 成功领取必须用账号本人创建的文件验收。

## Sepolia 与网站部署

1. 用仓库现有 `.\dev.cmd account:import` 或 `.\dev.cmd generate` 配置加密的部署账户，为它准备 Sepolia 测试 ETH。另生成独立签名私钥，签名者不需要 ETH。
2. 在 `packages/hardhat/.env` 配置 `SEPOLIA_RPC_URL` 和 `ONETHANKS_SIGNER_ADDRESS`。后者必须与网站的 `SIGNER_PRIVATE_KEY` 对应，且不同于部署账户。部署脚本拒绝公开 Hardhat 测试账户。
3. 运行 `.\dev.cmd deploy --network sepolia --tags OneThanks`，按仓库流程输入本地解密密码。部署记录和前端 ABI 自动生成。
4. 网站环境设 `NEXT_PUBLIC_ONETHANKS_CHAIN_ID=11155111`，配置浏览器 RPC、服务端 `ONETHANKS_RPC_URL`、`SIGNER_PRIVATE_KEY`、至少 32 字符的随机 `CLAIM_HMAC_SECRET`。可选 `GITHUB_TOKEN` 用于提高公开读取额度。私钥、HMAC、token 绝不能使用 `NEXT_PUBLIC_` 前缀。
5. 用 `.\dev.cmd vercel:login` 登录有效 Vercel 账户。在 Vercel 选择本仓库、Root Directory `packages/nextjs`，保留 monorepo 根依赖访问，添加上述环境变量。运行 `.\dev.cmd vercel --prod` 发布。不要使用忽略构建错误的 yolo 命令。
6. 托管平台为 `/api/claim/*` 配置按 IP 的请求速率限制（建议起点每分钟 10 次），作者查询接口按流量设置限额。进程缓存不替代分布式限流。部署后检查 RPC chainId、合约 signer 与服务端地址一致。
7. 在实际 HTTPS 地址用两台设备完成寄出、真实 Gist、领取和退款。提前准备一张已过期卡演示退款；不修改公共测试网时间。

应用需要 Node.js 动态 API，不能静态导出或部署到 IPFS。公开 Vercel 构建拒绝使用本地链。RPC 或 signer 不一致时接口会停止签发；错误不会返回环境变量、RPC URL 或底层凭证。

## 结构与接口

- `packages/hardhat/contracts/OneThanks.sol`：托管、单卡领取、退款、最新优先分页。
- `packages/nextjs/app/page.tsx`：查作者与寄出。
- `packages/nextjs/app/u/[login]/page.tsx`：感谢墙和页内领取面板。
- `GET /api/github/[login]`：仅 GitHub 个人账号。
- `POST /api/claim/challenge`：请求 `{thanksId: "1", wallet: "0x…"}`。
- `POST /api/claim/verify`：请求 `{gistUrl, statement}`，返回绑定收款地址的短期签名。
- `utils/onethanks/claim-hash.ts`：生产签名与合约测试共用编码。

所有留言永久公开，不渲染 HTML。用户提交的 login 不证明归属，GitHub 数字 ID 才是资金归属依据。所有资金操作为常数复杂度，分页上限 20，终态不可重复转出。后端 HMAC、固定 GitHub API 域名、声明文件大小、超时和 nonce 校验保护核验边界。

已完成合约与 API 的 39 项自动化测试、本地寄出与退款流程、前端生产构建及桌面/手机检查。真实 Gist 成功领取、Sepolia 与公网部署仍待验收。不要将本地测试账户用于公共网络，不要提交实际环境文件、签名私钥、HMAC 密钥或访问令牌。
