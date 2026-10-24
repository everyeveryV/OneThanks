"use client";

import { useEffect, useRef, useState } from "react";
import { Address } from "@scaffold-ui/components";
import type { Address as EthAddress, Hex } from "viem";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { api, friendlyError } from "~~/utils/onethanks/client";
import { notification } from "~~/utils/scaffold-eth";

export function ClaimPanel({
  id,
  wallet,
  onClaimed,
  onClose,
}: {
  id: bigint;
  wallet: EthAddress;
  onClaimed: (hash: Hex) => void;
  onClose: () => void;
}) {
  const [challenge, setChallenge] = useState<{ statement: string; expiresAt: number }>();
  const [gistUrl, setGistUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const alive = useRef(true);
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "OneThanks" });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function generate() {
    setBusy(true);
    setError("");
    setStatus("正在读取卡片与领取序号…");
    try {
      const next = await api<{ statement: string; expiresAt: number }>("/api/claim/challenge", {
        thanksId: String(id),
        wallet,
      });
      if (alive.current) {
        setChallenge(next);
        setGistUrl("");
        setStatus("");
      }
    } catch (e) {
      if (alive.current) {
        setError(friendlyError(e));
        setStatus("");
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function verify() {
    if (!challenge) return;
    setBusy(true);
    setError("");
    setStatus("正在核验公开 Gist 的作者与声明…");
    try {
      const proof = await api<{ thanksId: string; to: EthAddress; deadline: number; sig: Hex }>("/api/claim/verify", {
        gistUrl,
        statement: challenge.statement,
      });
      if (!alive.current) return;
      if (proof.to.toLowerCase() !== wallet.toLowerCase() || proof.thanksId !== String(id))
        throw new Error("钱包或卡片已变化，请重新开始。");
      setStatus("身份核验通过，等待钱包签名与链上确认…");
      const hash = await writeContractAsync({
        functionName: "claim",
        args: [id, proof.to, BigInt(proof.deadline), proof.sig],
      });
      if (alive.current && hash) {
        setStatus("已领取，链上交易已确认。");
        onClaimed(hash);
      }
    } catch (e) {
      if (alive.current) {
        setError(friendlyError(e));
        setStatus("");
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="claim-panel" aria-label={`领取感谢卡 ${id}`}>
      <div className="claim-heading">
        <h3>把这份心意收下</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          关闭
        </button>
      </div>
      <p>验证你拥有这个 GitHub 账号，领取第 {String(id)} 张卡。钱包换账号或换网络后，需要重新开始。</p>
      <div className="claim-address">
        收款钱包 <Address address={wallet} />
      </div>
      <ol className="claim-steps">
        <li>
          <b>生成专属声明</b>
          <p>声明只授权这张卡与当前钱包，最多 10 分钟有效，本地卡片仅 60 秒。</p>
          <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => void generate()}>
            {challenge ? "重新生成声明" : "生成声明"}
          </button>
        </li>
        {challenge && (
          <>
            <li>
              <b>用作者账号创建公开 Gist</b>
              <p>
                文件命名为 <code>onethanks.txt</code>，粘贴以下原文，选择 Create public gist。
              </p>
              <textarea
                className="textarea proof-text"
                aria-label="Gist 声明原文"
                readOnly
                value={challenge.statement}
              />
              <div className="claim-actions">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(challenge.statement).then(
                      () => notification.success("声明已复制"),
                      () => setError("复制失败，请手动选择上方声明并复制。"),
                    );
                  }}
                >
                  复制声明
                </button>
                <a className="btn btn-ghost btn-sm" href="https://gist.github.com/" target="_blank" rel="noreferrer">
                  去创建 Gist ↗
                </a>
              </div>
              <small>固定到期时间：{new Date(challenge.expiresAt * 1000).toLocaleTimeString()}</small>
            </li>
            <li>
              <label htmlFor={`gist-${id}`}>
                <b>粘贴链接，验证并领取</b>
              </label>
              <input
                id={`gist-${id}`}
                className="input gist-url"
                type="url"
                placeholder="https://gist.github.com/…"
                value={gistUrl}
                disabled={busy}
                onChange={e => setGistUrl(e.target.value)}
              />
              <button className="btn btn-primary" disabled={!gistUrl || busy} onClick={() => void verify()}>
                {busy ? "处理中…" : "验证并领取这张卡"}
              </button>
              <p>领取需要钱包支付测试网 gas。验证成功后仍需交易确认。</p>
            </li>
          </>
        )}
      </ol>
      {status && <p role="status">{status}</p>}
      {error && (
        <div className="alert alert-error feedback" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
