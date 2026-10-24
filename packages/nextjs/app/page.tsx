"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { PaperComposition } from "~~/components/onethanks/PaperComposition";
import { RecentThanks } from "~~/components/onethanks/RecentThanks";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { api, friendlyError } from "~~/utils/onethanks/client";
import type { GithubUser } from "~~/utils/onethanks/http";
import { getBlockExplorerTxLink, notification } from "~~/utils/scaffold-eth";

const writingPrompts = [
  { label: "它帮我解决了什么", placeholder: "用这个项目之前，你遇到了什么问题？它替你省下了哪些时间？" },
  { label: "我最喜欢哪一点", placeholder: "一个好用的功能、一段清楚的文档，或一次耐心的回复……哪一点打动了你？" },
  { label: "想对 TA 说", placeholder: "如果作者就在面前，你最想告诉 TA 什么？" },
];

function durationLabel(seconds: bigint) {
  for (const [unit, size] of [
    ["天", 86400n],
    ["小时", 3600n],
    ["分钟", 60n],
    ["秒", 1n],
  ] as const) {
    if (seconds >= size && seconds % size === 0n) return `${seconds / size} ${unit}`;
  }
  return `${seconds} 秒`;
}

export default function Home() {
  const [login, setLogin] = useState("");
  const [author, setAuthor] = useState<GithubUser>();
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState("0.0005");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ login: string; hash: `0x${string}`; date: string }>();
  const [promptIndex, setPromptIndex] = useState<number>();
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const lookupVersion = useRef(0);
  const { address, chainId } = useAccount();
  const target = scaffoldConfig.targetNetworks[0];
  const { data: deployment } = useDeployedContractInfo({ contractName: "OneThanks" });
  const { data: refundAfter } = useScaffoldReadContract({ contractName: "OneThanks", functionName: "refundAfter" });
  const { data: thanksCount, refetch: refreshCount } = useScaffoldReadContract({
    contractName: "OneThanks",
    functionName: "thanksCount",
  });
  const { writeContractAsync, isMining, isPending } = useScaffoldWriteContract({ contractName: "OneThanks" });
  const bytes = new TextEncoder().encode(message.trim()).length;
  const characters = Array.from(
    new Intl.Segmenter("zh-CN", { granularity: "grapheme" }).segment(message.trim()),
  ).length;
  const busy = sending || isMining || isPending;
  async function findAuthor() {
    const version = ++lookupVersion.current;
    setSearching(true);
    setError("");
    setAuthor(undefined);
    setSent(undefined);
    try {
      const user = await api<GithubUser>(`/api/github/${encodeURIComponent(login.trim().replace(/^@/, ""))}`);
      if (version === lookupVersion.current) setAuthor(user);
    } catch (e) {
      if (version === lookupVersion.current) setError(friendlyError(e));
    } finally {
      if (version === lookupVersion.current) setSearching(false);
    }
  }
  async function send() {
    if (!author || !address || chainId !== target.id || !bytes || bytes > 280 || busy) return;
    setError("");
    setSent(undefined);
    setSending(true);
    const recipient = author;
    try {
      const current = await api<GithubUser>(`/api/github/${encodeURIComponent(recipient.login)}`);
      if (current.id !== recipient.id) throw new Error("GitHub 用户归属已变化，请重新查找作者。");
      const hash = await writeContractAsync({
        functionName: "sendThanks",
        args: [BigInt(recipient.id), recipient.login, message.trim()],
        value: parseEther(amount),
      });
      if (hash) {
        setSent({ login: recipient.login, hash, date: new Date().toLocaleDateString("zh-CN") });
        void refreshCount();
        setMessage("");
        notification.success("已托管。可以把感谢墙链接分享给作者。");
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="home-shell">
      <section className="compose-layout">
        <div className="intro">
          <div className="intro-note">一封写给开源作者的信</div>
          <h1>
            Thanks,
            <br />
            builders.
          </h1>
          <h2 className="intro-title">
            让开源背后的人，
            <br />
            听见一句谢谢。
          </h2>
          <PaperComposition />
          <p className="intro-description">
            也许是一个救急的工具，
            <br />
            也许是一份耐心维护的文档。
            <br />
            把你的感谢，寄给写下它的人。
          </p>
          <div className="intro-footnote">
            一句公开留言，一点测试 ETH。
            <br />
            作者还没有钱包？合约先替他保管。
          </div>
        </div>
        <section className="postcard card" aria-label="写一张感谢卡">
          <div className="postcard-top">
            <h2>写一张感谢卡</h2>
            <span>公开留言 / 测试 ETH</span>
          </div>
          <div className="recipient">
            <label htmlFor="github-login">寄给</label>
            <form
              onSubmit={e => {
                e.preventDefault();
                void findAuthor();
              }}
              className="recipient-search"
            >
              <span aria-hidden="true">@</span>
              <input
                className="input input-ghost"
                id="github-login"
                placeholder="GitHub 用户名"
                autoComplete="off"
                maxLength={39}
                value={login}
                disabled={busy}
                onChange={e => {
                  lookupVersion.current++;
                  setLogin(e.target.value);
                  setAuthor(undefined);
                  setSearching(false);
                  setError("");
                  setSent(undefined);
                }}
              />
              <button className="btn btn-ghost btn-sm" disabled={!login.trim() || searching || busy}>
                {searching ? "查找中…" : "查找作者"}
              </button>
            </form>
          </div>
          {author && (
            <div className="author-found">
              <Image unoptimized src={author.avatar_url} alt="" width={32} height={32} />
              <span>
                <b>{author.name || author.login}</b>
                <small>@{author.login}</small>
              </span>
              <Link href={`/u/${author.login}`} className="link">
                查看感谢墙
              </Link>
            </div>
          )}
          <div className="writing-prompts" aria-label="写作提示">
            {writingPrompts.map((prompt, index) => (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                key={prompt.label}
                aria-pressed={promptIndex === index}
                disabled={busy}
                onClick={() => {
                  setPromptIndex(index);
                  messageInput.current?.focus();
                }}
              >
                {prompt.label}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="thanks-message">
            感谢留言
          </label>
          <textarea
            id="thanks-message"
            ref={messageInput}
            className="textarea letter-input"
            placeholder={
              promptIndex === undefined ? "谢谢你，因为你的开源项目……" : writingPrompts[promptIndex].placeholder
            }
            value={message}
            maxLength={560}
            disabled={busy}
            onChange={e => setMessage(e.target.value)}
          />
          <div className={`byte-count ${bytes > 280 ? "over-limit" : ""}`}>
            {bytes > 280
              ? `已写 ${characters} 字，内容超出容量，请缩短后寄出。`
              : `已写 ${characters} 字 · 约可写 93 个汉字（含表情时会更少）`}
          </div>
          <fieldset className="amount-field" disabled={busy}>
            <legend>
              随信附上一点心意 <small>测试 ETH</small>
            </legend>
            <div className="amount-options">
              {[
                ["0.0005", "轻轻一句"],
                ["0.001", "认真道谢"],
                ["0.005", "重重谢意"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  className={`btn ${amount === value ? "amount-selected" : "btn-ghost"}`}
                  key={value}
                  aria-pressed={amount === value}
                  onClick={() => setAmount(value)}
                >
                  <span>
                    {value} <small>ETH</small>
                  </span>
                  <small className="amount-name">{label}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <section className="live-letter" aria-label="感谢卡实时预览">
            <div className="live-letter-top">
              <span>
                寄给{" "}
                {author ? `@${author.login}` : login.trim() ? `@${login.trim().replace(/^@/, "")}` : "你想感谢的人"}
              </span>
              <span className="preview-postmark" aria-label="草稿，尚未寄出">
                一句谢谢<small>待寄出</small>
              </span>
            </div>
            <p className={`preview-message ${message.trim() ? "" : "is-placeholder"}`}>
              {message.trim() || "你的具体感谢，会写在这里。"}
            </p>
            <div className="live-letter-bottom">
              <span>预览 · 尚未寄出</span>
              <b>{amount} 测试 ETH</b>
            </div>
          </section>
          <button
            className="btn btn-primary send-button"
            onClick={() => void send()}
            disabled={!author || !bytes || bytes > 280 || !address || chainId !== target.id || busy || !deployment}
          >
            {busy
              ? "正在等待钱包与链上确认…"
              : !address
                ? "先连接钱包，再寄出"
                : chainId !== target.id
                  ? `请切换到 ${target.name}`
                  : "寄出这句谢谢"}
            <span aria-hidden="true">↗</span>
          </button>
          <p className="card-fineprint">
            留言会公开保存在链上。
            {refundAfter !== undefined
              ? `寄出 ${durationLabel(refundAfter)}后仍未领取，寄出者可手动取回。`
              : "正在读取合约领取期限…"}
          </p>
          {error && (
            <div role="alert" className="alert alert-error feedback">
              {error}
            </div>
          )}
          {sent && (
            <div role="status" className="alert alert-success feedback">
              <div>
                <span className="sent-postmark">
                  已寄出<small>{sent.date}</small>
                </span>
                <b>已托管，感谢已经写上链。</b>
                <br />
                <Link href={`/u/${sent.login}`} className="link">
                  打开 @{sent.login} 的感谢墙
                </Link>
                <br />
                <a
                  className="link"
                  href={getBlockExplorerTxLink(target.id, sent.hash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看交易回执
                </a>
              </div>
            </div>
          )}
        </section>
      </section>
      <section className="how-it-works" id="how-it-works" aria-label="如何运作">
        <div>
          <span>01</span>
          <h2>写给一个人</h2>
          <p>找到 GitHub 作者，把具体的感谢写下来。</p>
        </div>
        <div>
          <span>02</span>
          <h2>心意先保管</h2>
          <p>测试 ETH 进入合约托管，感谢留在作者墙上。</p>
        </div>
        <div>
          <span>03</span>
          <h2>验证后领取</h2>
          <p>作者用公开 Gist 证明身份，逐张领取心意。</p>
        </div>
      </section>
      <RecentThanks count={thanksCount} />
    </div>
  );
}
