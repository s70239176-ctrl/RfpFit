"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BidCard } from "@/components/bid-card";
import { BidForm } from "@/components/bid-form";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { EscrowMeter } from "@/components/escrow-meter";
import { MetricCard, Ring } from "@/components/metric-card";
import { displayStatus } from "@/components/status-chip";
import { FinalizePanel } from "@/components/finalize-panel";
import { RequirementList } from "@/components/requirement-list";
import { RfpHeader } from "@/components/rfp-header";
import { getRfpDetail, type BidWithVerdict } from "@/lib/contract";
import { configProblem } from "@/lib/genlayer";
import { LIMITS } from "@/lib/constants";
import { countdown, formatGen, formatTime, shortReason } from "@/lib/format";
import type { Rfp } from "@/lib/schema";
import { useNow } from "@/lib/use-now";

type Detail = { rfp: Rfp; bids: BidWithVerdict[] };

export default function RfpPage() {
  const { id } = useParams<{ id: string }>();
  const now = useNow();
  const [detail, setDetail] = useState<Detail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await getRfpDetail(id));
      setError(null);
    } catch (err) {
      setError(shortReason(err));
    }
  }, [id]);

  useEffect(() => {
    if (configProblem()) return;
    void load();
    // Contract state changes without this tab: keep the view honest while unsettled.
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  if (configProblem()) return <ErrorState message="Contract is not configured, so this brief cannot be read." />;
  if (error && !detail) return <ErrorState message={`Could not read the contract: ${error}`} onRetry={load} />;
  if (detail === undefined) return <p className="text-muted" role="status">Reading the contract...</p>;
  if (detail === null) return <EmptyState message="Not found. No brief with this ID exists on the contract." action={{ href: "/", label: "Back to briefs" }} />;

  const { rfp, bids } = detail;
  const deadlinePassed = now / 1000 >= rfp.deadlineTs;
  const selectedVerdict = bids.find((b) => b.bid.bidId === selected)?.verdict ?? null;

  const judgedShare = rfp.bidCount > 0 ? rfp.judgedCount / rfp.bidCount : 0;

  return (
    <div className="space-y-6">
      <RfpHeader rfp={rfp} nowMs={now} />
      {error && <p role="alert" className="text-sm text-bad">Refresh failed: {error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard index={0} accent label="Escrowed prize" value={<>{formatGen(rfp.prizeWei, 6)} <span className="text-base text-muted">GEN</span></>} sub={displayStatus(rfp, now) === "PAID" ? "Paid out" : displayStatus(rfp, now) === "REFUNDED" ? "Refunded" : "Locked in contract"} />
        <MetricCard index={1} label="Deadline" value={deadlinePassed ? "Closed" : countdown(rfp.deadlineTs, now)} sub={formatTime(rfp.deadlineTs)} />
        <MetricCard index={2} label="Bids" value={`${rfp.bidCount}/${LIMITS.maxBids}`} sub="Max 8 per brief" />
        <MetricCard
          index={3}
          label="Judged"
          value={`${rfp.judgedCount}/${rfp.bidCount}`}
          sub="Verdicts on-chain"
          visual={<Ring value={judgedShare} label={`${rfp.judgedCount} of ${rfp.bidCount} bids judged`} />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <section aria-label="Bids" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl">Bids</h2>
              <span className="label">{bids.length} total</span>
            </div>
            {bids.length === 0 ? (
              <EmptyState message="This brief is live. Be first, or wait for the deadline." />
            ) : (
              bids.map(({ bid, verdict }, i) => (
                <div key={bid.bidId} className="reveal" style={{ ["--i" as string]: i + 2 }}>
                  <BidCard
                    rfp={rfp}
                    bid={bid}
                    verdict={verdict}
                    isWinner={rfp.winnerBidId === bid.bidId}
                    selected={selected === bid.bidId}
                    deadlinePassed={deadlinePassed}
                    onSelect={() => setSelected(selected === bid.bidId ? null : bid.bidId)}
                    onChanged={load}
                  />
                </div>
              ))
            )}
          </section>
          <RequirementList text={rfp.requirementsText} ids={rfp.requirementIds} verdict={selectedVerdict} />
          {selected && <p className="-mt-3 text-xs text-muted">Showing met / missing marks for bid {selected}.</p>}
        </div>

        <div className="space-y-6 lg:sticky lg:top-20 lg:col-span-5 lg:self-start">
          <EscrowMeter rfp={rfp} nowMs={now} />
          <FinalizePanel rfp={rfp} deadlinePassed={deadlinePassed} onChanged={load} />
          <BidForm rfp={rfp} existingBidIds={bids.map((b) => b.bid.bidId)} deadlinePassed={deadlinePassed} onChanged={load} />
        </div>
      </div>
    </div>
  );
}
