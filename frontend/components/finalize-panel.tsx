"use client";

import { finalize } from "@/lib/contract";
import { explorerAddressUrl } from "@/lib/genlayer";
import { formatGen } from "@/lib/format";
import type { Rfp } from "@/lib/schema";
import { TxPanel, useTx } from "./tx-toast";
import { useWallet } from "./wallet-bar";

export function FinalizePanel({
  rfp,
  deadlinePassed,
  onChanged,
}: {
  rfp: Rfp;
  deadlinePassed: boolean;
  onChanged: () => Promise<void>;
}) {
  const { account, connectWallet } = useWallet();
  const tx = useTx();

  if (rfp.finalized) {
    const paid = rfp.status === "FINALIZED";
    const url = explorerAddressUrl(paid ? rfp.winnerAddress : rfp.sponsor);
    return (
      <section className="panel p-5" aria-label="Settlement">
        <h2 className="text-xl">{paid ? "Paid" : "Refunded"}</h2>
        <p className="mt-2 text-sm text-muted">
          {paid
            ? `${formatGen(rfp.prizeWei, 6)} GEN was sent to the winning bid ${rfp.winnerBidId}.`
            : `${formatGen(rfp.prizeWei, 6)} GEN went back to the sponsor. No bid was RESPONSIVE.`}
        </p>
        {url && (
          <p className="mt-2 text-sm">
            <a href={url} target="_blank" rel="noreferrer">
              View recipient on the explorer
            </a>
          </p>
        )}
      </section>
    );
  }

  const unjudged = rfp.bidCount - rfp.judgedCount;
  let blocked: string | null = null;
  if (!deadlinePassed) blocked = "Finalize opens after the deadline";
  else if (unjudged > 0) blocked = `Judge every bid first (${rfp.judgedCount} of ${rfp.bidCount} done)`;

  function run() {
    if (!account) return void connectWallet();
    void tx.run(async (onStage) => {
      const r = await finalize(account, rfp.id, onStage);
      const note = r.receipt
        ? r.receipt.action === "PAY_WINNER"
          ? `Prize paid to bid ${r.receipt.bidId}.`
          : "Sponsor refunded."
        : "";
      return { ...r, note };
    }, onChanged);
  }

  return (
    <section
      aria-label="Finalize"
      className="panel space-y-3 p-5 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-10 max-lg:rounded-none max-lg:border-x-0 max-lg:border-b-0"
    >
      <h2 className="text-xl max-lg:hidden">Settle</h2>
      <p className="text-sm text-muted max-lg:hidden">
        Anyone can finalize once every bid has a verdict. The contract pays the best RESPONSIVE bid, or refunds the sponsor.
      </p>
      <button type="button" className="btn-primary w-full" disabled={tx.pending || blocked !== null} onClick={run}>
        {tx.pending ? "Finalizing" : (blocked ?? (account ? "Finalize" : "Connect wallet to finalize"))}
      </button>
      <TxPanel state={tx.state} onRetry={tx.retry} onDismiss={tx.reset} />
    </section>
  );
}
