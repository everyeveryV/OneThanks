"use client";

import { formatEther } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

function RecentCard({ id }: { id: bigint }) {
  const { data: card } = useScaffoldReadContract({ contractName: "OneThanks", functionName: "thanks", args: [id] });
  if (!card) return null;
  return (
    <article className="recent-letter">
      <div className="recent-letter-meta">
        <span>第 {String(id)} 封</span>
        <span>{["合约托管中", "已领取", "已退回"][card[4]]}</span>
      </div>
      <p className="letter-message">{card[5]}</p>
      <div className="recent-letter-meta">
        <span>收信人 GitHub ID {String(card[1])}</span>
        <b>{formatEther(card[2])} ETH</b>
      </div>
    </article>
  );
}

export function RecentThanks({ count }: { count: bigint | undefined }) {
  if (count === undefined) return null;
  return (
    <section className="recent-thanks" aria-label="本站真实感谢卡">
      <div className="recent-heading">
        <h2>这里已经寄出了 {String(count)} 封谢谢。</h2>
        <span>当前网络 · 本应用合约</span>
      </div>
      {count === 0n ? (
        <p>还没有人寄出。第一封，留给你真正想感谢的人。</p>
      ) : (
        <div className="recent-grid">
          {Array.from({ length: Number(count > 3n ? 3n : count) }, (_, i) => (
            <RecentCard key={String(count - BigInt(i))} id={count - BigInt(i)} />
          ))}
        </div>
      )}
    </section>
  );
}
