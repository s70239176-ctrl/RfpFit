import type { Rfp } from "@/lib/schema";
import { formatTime } from "@/lib/format";
import { CopyAddress } from "./copy-address";
import { displayStatus } from "./status-chip";

/** Escrow ledger: who holds what, straight from contract state. */
export function EscrowMeter({ rfp, nowMs }: { rfp: Rfp; nowMs: number }) {
  const status = displayStatus(rfp, nowMs);
  return (
    <section className="panel reveal p-5" style={{ ["--i" as string]: 3 }} aria-label="Escrow">
      <p className="label">Escrow ledger</p>
      <p className="mt-3 text-sm text-muted">
        {status === "PAID" && "Paid to the winning bidder by the contract."}
        {status === "REFUNDED" && "No RESPONSIVE bid. The contract refunded the sponsor."}
        {(status === "OPEN" || status === "JUDGING") && "Prize is locked in the contract. This UI cannot move it."}
      </p>
      <dl className="mt-4 divide-y divide-rule text-sm">
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-muted">Amount</dt>
          <dd className="font-mono text-xs">{rfp.prizeWei.toString()} wei</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-muted">Sponsor</dt>
          <dd>
            <CopyAddress address={rfp.sponsor} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-muted">Deadline</dt>
          <dd className="text-right">{formatTime(rfp.deadlineTs)}</dd>
        </div>
        {rfp.winnerAddress && (
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-muted">Paid to</dt>
            <dd>
              <CopyAddress address={rfp.winnerAddress} />
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
