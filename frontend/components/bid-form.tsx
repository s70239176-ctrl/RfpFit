"use client";

import { useState } from "react";
import { BID_ID_RE, LIMITS } from "@/lib/constants";
import { submitBid } from "@/lib/contract";
import type { Rfp } from "@/lib/schema";
import type { SampleBid } from "@/lib/sample-data";
import { SamplePack } from "./sample-pack";
import { TxPanel, useTx } from "./tx-toast";
import { useWallet } from "./wallet-bar";

function validate(bidId: string, summary: string, uri: string, existing: string[]): string | null {
  if (!BID_ID_RE.test(bidId)) return "Bid ID is 3 to 32 letters, digits or underscores.";
  if (existing.includes(bidId)) return "That bid ID is already used on this brief.";
  const s = summary.trim().length;
  if (s < LIMITS.bidSummary.min || s > LIMITS.bidSummary.max) {
    return `Summary must be ${LIMITS.bidSummary.min} to ${LIMITS.bidSummary.max} characters (now ${s}).`;
  }
  if (uri.length > LIMITS.evidenceUri.max) return `Evidence link is at most ${LIMITS.evidenceUri.max} characters.`;
  if (uri && !uri.startsWith("https://")) return "Evidence link must start with https://";
  return null;
}

export function BidForm({
  rfp,
  existingBidIds,
  deadlinePassed,
  onChanged,
}: {
  rfp: Rfp;
  existingBidIds: string[];
  deadlinePassed: boolean;
  onChanged: () => Promise<void>;
}) {
  const { account, connectWallet } = useWallet();
  const tx = useTx();
  const [bidId, setBidId] = useState("");
  const [summary, setSummary] = useState("");
  const [uri, setUri] = useState("");
  const [touched, setTouched] = useState(false);

  const full = rfp.bidCount >= LIMITS.maxBids;
  const closed = deadlinePassed || rfp.status !== "OPEN";
  const problem = validate(bidId.trim(), summary, uri.trim(), existingBidIds);
  const sponsorBidding = account !== null && account.toLowerCase() === rfp.sponsor.toLowerCase();

  function fill(b: SampleBid) {
    setBidId(b.bidId);
    setSummary(b.summary);
    setUri(b.evidenceUri);
    setTouched(false);
    tx.reset();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!account) return void connectWallet();
    if (problem) return;
    void tx.run(
      async (onStage) => {
        const r = await submitBid(
          account,
          { rfpId: rfp.id, bidId: bidId.trim(), summary: summary.trim(), evidenceUri: uri.trim() },
          onStage,
        );
        return { ...r, note: "Bid stored." };
      },
      async () => {
        setBidId("");
        setSummary("");
        setUri("");
        setTouched(false);
        await onChanged();
      },
    );
  }

  if (closed || full) {
    return (
      <p className="panel p-4 text-sm text-muted">
        {full && !closed ? "This brief has the maximum of 8 bids." : rfp.finalized ? "Bidding is closed. This brief is settled." : "Bidding is closed. Judgement and settlement happen next."}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="panel space-y-4 p-5" noValidate>
      <h2 className="text-xl">Submit a bid</h2>
      <div>
        <label htmlFor="bid-id" className="label">
          Bid ID
        </label>
        <input id="bid-id" className="field mt-1 font-mono" value={bidId} onChange={(e) => setBidId(e.target.value)} maxLength={LIMITS.bidId.max} placeholder="civic_ok" disabled={tx.pending} />
      </div>
      <div>
        <label htmlFor="bid-summary" className="label">
          Summary
        </label>
        <textarea id="bid-summary" className="field mt-1 min-h-32" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={LIMITS.bidSummary.max} placeholder="Address each requirement ID with something checkable." disabled={tx.pending} />
        <p className="mt-1 text-xs text-muted">
          {summary.trim().length}/{LIMITS.bidSummary.max}
        </p>
      </div>
      <div>
        <label htmlFor="bid-uri" className="label">
          Evidence link (optional, https)
        </label>
        <input id="bid-uri" className="field mt-1" value={uri} onChange={(e) => setUri(e.target.value)} maxLength={LIMITS.evidenceUri.max} placeholder="https://github.com/you/repo" disabled={tx.pending} />
      </div>
      {sponsorBidding && <p className="text-xs text-partial">You are the sponsor. This bid will be flagged. It is allowed.</p>}
      {touched && problem && (
        <p role="alert" className="text-sm text-bad">
          {problem}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={tx.pending}>
        {tx.pending ? "Submitting" : account ? "Submit bid" : "Connect wallet to bid"}
      </button>
      <TxPanel state={tx.state} onRetry={tx.retry} onDismiss={tx.reset} />
      <SamplePack mode="bid" onFill={fill} />
    </form>
  );
}
