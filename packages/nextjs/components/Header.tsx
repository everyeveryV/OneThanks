"use client";
import Link from "next/link";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";

export const Header = () => (
  <header className="site-header navbar">
    <Link href="/" className="brand" aria-label="一句谢谢 首页">
      <span>
        One<span className="brand-thanks">Thanks</span>
        <small>一句谢谢</small>
      </span>
    </Link>
    <nav className="header-nav" aria-label="页面导航">
      <Link href="/#github-login">写一封谢谢</Link>
      <Link href="/#how-it-works">如何运作</Link>
    </nav>
    <div className="header-wallet">
      <span className="network-label">
        <i />
        {scaffoldConfig.targetNetworks[0].id === 31337 ? "本地测试网" : "Sepolia 测试网"}
      </span>
      <RainbowKitCustomConnectButton />
    </div>
  </header>
);
