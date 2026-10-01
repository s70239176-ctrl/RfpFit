import type { Rfp } from "@/lib/schema";
import { displayStatus } from "./status-chip";

const STEPS = ["Prize locked", "Bidding", "Judging", "Settled"] as const;

/** Where the brief is in its life, derived from contract state. */
export function Lifecycle({ rfp, nowMs }: { rfp: Rfp; nowMs: number }) {
  const status = displayStatus(rfp, nowMs);
  const current = status === "OPEN" ? 1 : status === "JUDGING" ? 2 : 3;
  const last = status === "REFUNDED" ? "Refunded" : status === "PAID" ? "Paid" : "Settled";
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Brief lifecycle">
      {STEPS.map((s, i) => {
        const done = i < current || (i === 3 && current === 3);
        const active = i === current && !(i === 3);
        return (
          <li key={s} className="flex items-center gap-2 whitespace-nowrap">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-pill border font-mono text-[11px] font-semibold ${
                done
                  ? "border-primary bg-primary text-ink"
                  : active
                    ? "border-primary text-primary"
                    : "border-rule text-muted"
              }`}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span className={`text-sm ${done || active ? "text-fg" : "text-muted"}`}>{i === 3 ? last : s}</span>
            {i < STEPS.length - 1 && <span className={`h-px w-8 ${i < current ? "bg-primary" : "bg-rule"}`} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
