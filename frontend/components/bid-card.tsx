"use client";

import { formatTime } from "@/lib/format";
import { judgeBid } from "@/lib/contract";
import type { Bid, Rfp, Verdict } from "@/lib/schema";
import { CopyAddress } from "./copy-address";
import { TxPanel, useTx } from "./tx-toast";
import { VerdictSheet } from "./verdict-sheet";
import { useWallet } from "./wallet-bar";

interface Props {
  rfp: Rfp;
  bid: Bid;
  verdict: Verdict | null;
  isWinner: boolean;
  selected: boolean;
  deadlinePassed: boolean;
  onSelect: () => void;
  onChanged: () => Promise<void>;
}

export function BidCard({ rfp, bid, verdict, isWinner, selected, deadlinePassed, onSelect, onChanged }: Props) {
  const { account, connectWallet } = useWallet();
  const tx = useTx();
  const sponsorBid = bid.bidder.toLowerCase() === rfp.sponsor.toLowerCase();
  const settled = rfp.finalized;

  let judgeLabel = "Request judgement";
  if (tx.pending) judgeLabel = "Judging";
  else if (!deadlinePassed) judgeLabel = "Judgement opens after deadline";

  function judge() {
    if (!account) return void connectWallet();
    void tx.run(async (onStage) => {
      const r = await judgeBid(account, rfp.id, bid.bidId, onStage);
      return { ...r, note: "Verdict stored." };
    }, onChanged);
  }

  return (
    <article
      className={`panel p-5 ${isWinner ? "border-l-2 border-l-primary" : ""} ${selected ? "ring-1 ring-muted/40" : ""}`}
      aria-label={`Bid ${bid.bidId}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onSelect} className="text-left font-mono text-sm hover:text-primary" aria-pressed={selected}>
            {bid.bidId}
          </button>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <CopyAddress address={bid.bidder} />
            <span>{formatTime(bid.createdTs)}</span>
            {sponsorBid && <span className="rounded-sm border border-partial/50 px-1.5 py-0.5 text-partial">Sponsor is bidder</span>}
            {isWinner && <span className="rounded-sm border border-primary/60 px-1.5 py-0.5 text-primary">Winner</span>}
          </p>
        </div>
      </header>

      <p className="mt-3 whitespace-pre-wrap text-sm">{bid.summary}</p>
      {bid.evidenceUri && (
        <p className="mt-2 truncate text-sm">
          <span className="text-muted">Evidence: </span>
          <a href={bid.evidenceUri} target="_blank" rel="noreferrer noopener">
            {bid.evidenceUri}
          </a>
        </p>
      )}

      {verdict ? (
        <>
          <VerdictSheet verdict={verdict} />
          {verdict.verdict === "PARTIAL" && (
            <p className="mt-2 text-xs text-muted">Partial means the bid answered some requirements. It cannot win in v1.</p>
          )}
        </>
      ) : (
        !settled && (
          <div className="mt-4 space-y-3">
            <button
              type="button"
              className="btn-quiet"
              disabled={tx.pending || !deadlinePassed}
              onClick={judge}
            >
              {judgeLabel}
            </button>
            {tx.pending && (
              <p className="text-xs text-muted">Validators compare the brief to the evidence. Expect a wait.</p>
            )}
            <TxPanel state={tx.state} onRetry={tx.retry} onDismiss={tx.reset} />
          </div>
        )
      )}
    </article>
  );
}
