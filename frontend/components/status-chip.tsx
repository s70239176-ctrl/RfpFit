import type { Rfp, VerdictLabel } from "@/lib/schema";

export type DisplayStatus = "OPEN" | "JUDGING" | "PAID" | "REFUNDED";

export function displayStatus(rfp: Rfp, nowMs: number): DisplayStatus {
  if (rfp.status === "FINALIZED") return "PAID";
  if (rfp.status === "REFUNDED") return "REFUNDED";
  return nowMs / 1000 < rfp.deadlineTs && rfp.status === "OPEN" ? "OPEN" : "JUDGING";
}

const STATUS_STYLE: Record<DisplayStatus, string> = {
  OPEN: "border-primary/60 text-primary",
  JUDGING: "border-partial/60 text-partial",
  PAID: "border-good/60 text-good",
  REFUNDED: "border-muted/50 text-muted",
};

const base = "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium uppercase tracking-[0.1em]";

export function StatusChip({ status }: { status: DisplayStatus }) {
  return <span className={`${base} ${STATUS_STYLE[status]}`}>{status}</span>;
}

const VERDICT_STYLE: Record<VerdictLabel, string> = {
  RESPONSIVE: "text-good",
  PARTIAL: "text-partial",
  NON_RESPONSIVE: "text-bad",
};

export function VerdictWord({ verdict, className = "" }: { verdict: VerdictLabel; className?: string }) {
  return (
    <span className={`tracking-tight ${VERDICT_STYLE[verdict]} ${className}`}>
      {verdict.replace("_", "-")}
    </span>
  );
}
