"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BidCard } from "@/components/bid-card";
import { BidForm } from "@/components/bid-form";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { EscrowMeter } from "@/components/escrow-meter";
import { FinalizePanel } from "@/components/finalize-panel";
import { RequirementList } from "@/components/requirement-list";
import { RfpHeader } from "@/components/rfp-header";
import { getRfpDetail, type BidWithVerdict } from "@/lib/contract";
import { configProblem } from "@/lib/genlayer";
import { shortReason } from "@/lib/format";
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

  return (
    <div>
      <RfpHeader rfp={rfp} />
      {error && <p role="alert" className="mb-4 text-sm text-bad">Refresh failed: {error}</p>}
      <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-8">
          <EscrowMeter rfp={rfp} nowMs={now} />
          <RequirementList text={rfp.requirementsText} ids={rfp.requirementIds} verdict={selectedVerdict} />
          {selected && (
            <p className="-mt-4 text-xs text-muted">Showing met / missing marks for bid {selected}.</p>
          )}
        </div>

        <div className="space-y-6">
          <section aria-label="Bids" className="space-y-4">
            <h2 className="text-2xl">Bids</h2>
            {bids.length === 0 ? (
              <EmptyState message="This brief is live. Be first, or wait for the deadline." />
            ) : (
              bids.map(({ bid, verdict }) => (
                <BidCard
                  key={bid.bidId}
                  rfp={rfp}
                  bid={bid}
                  verdict={verdict}
                  isWinner={rfp.winnerBidId === bid.bidId}
                  selected={selected === bid.bidId}
                  deadlinePassed={deadlinePassed}
                  onSelect={() => setSelected(selected === bid.bidId ? null : bid.bidId)}
                  onChanged={load}
                />
              ))
            )}
          </section>
          <BidForm rfp={rfp} existingBidIds={bids.map((b) => b.bid.bidId)} deadlinePassed={deadlinePassed} onChanged={load} />
          <FinalizePanel rfp={rfp} deadlinePassed={deadlinePassed} onChanged={load} />
        </div>
      </div>
    </div>
  );
}
