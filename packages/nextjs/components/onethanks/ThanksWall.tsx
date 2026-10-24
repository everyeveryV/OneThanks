"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ClaimPanel } from "./ClaimPanel";
import { Address } from "@scaffold-ui/components";
import { useQuery } from "@tanstack/react-query";
import { type Hex, formatEther } from "viem";
import { useAccount, useBlock, useBlockNumber } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { api, friendlyError } from "~~/utils/onethanks/client";
import type { GithubUser } from "~~/utils/onethanks/http";
import { getBlockExplorerTxLink } from "~~/utils/scaffold-eth";

const chainId = scaffoldConfig.targetNetworks[0].id;

export function ThanksWall({ login }: { login: string }) {
  const author = useQuery({
    queryKey: ["github-user", login],
    queryFn: ({ signal }) => api<GithubUser>(`/api/github/${encodeURIComponent(login)}`, undefined, signal),
    retry: false,
  });
  return (
    <div className="wall-shell">
      <Link href="/" className="back-link">
        ← 写一张感谢卡
      </Link>
      {author.isPending ? (
        <div className="wall-empty" role="status">
          正在查找 GitHub 作者…
        </div>
      ) : author.error ? (
        <div className="alert alert-error" role="alert">
          {friendlyError(author.error)}
          <button className="btn btn-sm" onClick={() => void author.refetch()}>
            重试
          </button>
        </div>
      ) : (
        author.data && <AuthorWall key={author.data.id} author={author.data} />
      )}
    </div>
  );
}

function AuthorWall({ author }: { author: GithubUser }) {
  const [offset, setOffset] = useState(0);
  const [ids, setIds] = useState<bigint[]>([]);
  const [selected, setSelected] = useState<bigint>();
  const [revision, setRevision] = useState(0);
  const { address, chainId: walletChain } = useAccount();
  const page = useScaffoldReadContract({
    contractName: "OneThanks",
    functionName: "getIds",
    args: [BigInt(author.id), BigInt(offset), 20n],
    watch: false,
  });
  const { data: blockNumber } = useBlockNumber({ chainId, watch: true });
  const { data: block } = useBlock({ chainId, blockNumber });
  useEffect(() => {
    if (page.data) setIds(previous => [...new Set([...previous, ...page.data])]);
  }, [page.data]);
  const canClaim = !!address && walletChain === chainId;
  return (
    <>
      <header className="wall-heading">
        <Image unoptimized src={author.avatar_url} width={80} height={80} alt="" />
        <div>
          <a className="author-handle link" href={author.html_url} target="_blank" rel="noreferrer">
            @{author.login} ↗
          </a>
          <h1>{author.name || author.login} 的感谢墙</h1>
          <p>代码带来的帮助，都有回响。</p>
        </div>
        <span className="wall-postmark" aria-hidden="true">
          一句谢谢
          <br />
          <small>OneThanks</small>
        </span>
      </header>
      <div className="wall-toolbar">
        <span>公开的心意，真实的链上状态</span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setSelected(undefined);
            setRevision(v => v + 1);
            if (offset === 0) {
              void page.refetch().then(result => {
                if (result.data) setIds([...result.data]);
              });
            } else {
              setIds([]);
              setOffset(0);
            }
          }}
        >
          刷新状态
        </button>
      </div>
      {!canClaim && (
        <p className="wall-hint">
          作者领取或寄出者取回前，请连接钱包并切换到 {scaffoldConfig.targetNetworks[0].name}。
        </p>
      )}
      {page.error && (
        <div role="alert" className="alert alert-error feedback">
          无法读取感谢卡，请确认本地节点已启动或稍后重试。
          <button className="btn btn-sm" onClick={() => void page.refetch()}>
            重试
          </button>
        </div>
      )}
      {page.isLoading && !ids.length && <p role="status">正在读取链上感谢卡…</p>}
      {!page.isLoading && !page.error && page.data?.length === 0 && ids.length === 0 && (
        <section className="wall-empty">
          <span aria-hidden="true">✉</span>
          <h2>第一句谢谢，还在等你写下。</h2>
          <p>这里会展示寄给 @{author.login} 的公开感谢。</p>
          <Link className="btn btn-primary" href="/">
            写一张感谢卡
          </Link>
        </section>
      )}
      <div className="wall-cards">
        {ids.map(id => (
          <ThanksCard
            key={`${id}-${revision}`}
            id={id}
            githubId={BigInt(author.id)}
            now={block?.timestamp}
            selected={selected === id}
            select={() => setSelected(id)}
            close={() => setSelected(undefined)}
          />
        ))}
      </div>
      {page.data?.length === 20 && (
        <button className="btn btn-outline load-more" disabled={page.isFetching} onClick={() => setOffset(v => v + 20)}>
          {page.isFetching ? "加载中…" : "加载更多（最多 20 张）"}
        </button>
      )}
      <p className="wall-disclosure">
        资金由合约托管；GitHub 身份由后端签名者核验。到期未领取的卡片，需要原寄出者手动取回。作者不会自动收到 GitHub
        通知。
      </p>
    </>
  );
}

function ThanksCard({
  id,
  githubId,
  now,
  selected,
  select,
  close,
}: {
  id: bigint;
  githubId: bigint;
  now?: bigint;
  selected: boolean;
  select: () => void;
  close: () => void;
}) {
  const {
    data: card,
    error: readError,
    refetch,
  } = useScaffoldReadContract({ contractName: "OneThanks", functionName: "thanks", args: [id] });
  const { address, chainId: walletChain } = useAccount();
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "OneThanks" });
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Hex>();
  const [stamped, setStamped] = useState(false);
  if (readError)
    return (
      <div className="alert alert-error" role="alert">
        卡片 #{String(id)} 读取失败。
        <button className="btn btn-sm" onClick={() => void refetch()}>
          重试
        </button>
      </div>
    );
  if (!card) return <div className="thanks-card skeleton">正在读取感谢卡…</div>;
  if (card[1] !== githubId) return null;
  const [sender, , amount, refundAt, state, message] = card;
  const expired = now !== undefined && now >= refundAt;
  const connected = !!address && walletChain === chainId;
  const pending = state === 0;
  const canClaim = connected && now !== undefined && pending && !expired;
  const status = state === 1 ? "已领取" : state === 2 ? "已退回" : expired ? "已到期，可取回" : "等待领取";
  async function refund() {
    setError("");
    try {
      const hash = await writeContractAsync({ functionName: "refund", args: [id] });
      if (hash) {
        setReceipt(hash);
        await refetch();
      }
    } catch (e) {
      setError(friendlyError(e));
    }
  }
  return (
    <article className="thanks-card card">
      <div className="thanks-card-top">
        <span>第 {String(id).padStart(3, "0")} 封</span>
        <span className={`status-mark ${state === 1 ? "claimed" : ""} ${stamped ? "stamp-in" : ""}`}>{status}</span>
      </div>
      <p className="letter-message">{message}</p>
      <div className="card-sender">
        <span>来自</span>
        <Address address={sender} />
      </div>
      <div className="thanks-card-bottom">
        <b>
          {formatEther(amount)} <small>ETH</small>
        </b>
        <span>
          {pending ? "领取截止" : "原领取截止"} {new Date(Number(refundAt) * 1000).toLocaleString()}
        </span>
      </div>
      {canClaim && (
        <button className="btn btn-outline claim-button" disabled={selected} onClick={select}>
          我是作者，领取
        </button>
      )}
      {pending && expired && connected && address?.toLowerCase() === sender.toLowerCase() && (
        <button className="btn btn-outline claim-button" disabled={isMining} onClick={() => void refund()}>
          {isMining ? "等待链上确认…" : "取回这份心意"}
        </button>
      )}
      {selected && connected && address && (
        <ClaimPanel
          key={`${id}-${address}-${walletChain}`}
          id={id}
          wallet={address}
          onClose={close}
          onClaimed={hash => {
            setReceipt(hash);
            setStamped(true);
            close();
            void refetch();
          }}
        />
      )}
      {error && (
        <div className="alert alert-error feedback" role="alert">
          {error}
        </div>
      )}
      {receipt && (
        <a
          className="link receipt-link"
          href={getBlockExplorerTxLink(chainId, receipt)}
          target="_blank"
          rel="noreferrer"
        >
          交易已确认 · 查看回执
        </a>
      )}
    </article>
  );
}
