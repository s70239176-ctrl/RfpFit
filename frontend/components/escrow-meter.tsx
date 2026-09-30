import type { Rfp } from "@/lib/schema";
import { formatGen, formatTime, countdown } from "@/lib/format";
import { CopyAddress } from "./copy-address";
import { StatusChip, displayStatus } from "./status-chip";

export function EscrowMeter({ rfp, nowMs }: { rfp: Rfp; nowMs: number }) {
  const status = displayStatus(rfp, nowMs);
  return (
    <section className="panel p-6" aria-label="Escrow">
      <div className="flex items-start justify-between gap-4">
        <span className="label">Escrowed prize</span>
        <StatusChip status={status} />
      </div>
      <p className="mt-3 font-serif text-4xl tracking-tight text-copper">
        {formatGen(rfp.prizeWei, 6)} <span className="text-xl text-muted">GEN</span>
      </p>
      <p className="mt-1 font-mono text-xs text-muted">{rfp.prizeWei.toString()} wei</p>
      <p className="mt-4 text-sm text-muted">
        {status === "PAID" && "Paid to the winning bidder by the contract."}
        {status === "REFUNDED" && "No RESPONSIVE bid. The contract refunded the sponsor."}
        {(status === "OPEN" || status === "JUDGING") && "Prize is locked in the contract. This UI cannot move it."}
      </p>
      <dl className="mt-5 space-y-3 border-t border-rule pt-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Sponsor</dt>
          <dd>
            <CopyAddress address={rfp.sponsor} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Deadline</dt>
          <dd className="text-right">
            {formatTime(rfp.deadlineTs)}
            <span className="block text-xs text-muted">{countdown(rfp.deadlineTs, nowMs)}</span>
          </dd>
        </div>
        {rfp.winnerAddress && (
          <div className="flex items-center justify-between gap-4">
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
