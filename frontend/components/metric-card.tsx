import type { ReactNode } from "react";

/** Compact operational metric: mono label, large value, optional trailing visual. */
export function MetricCard({
  label,
  value,
  sub,
  accent = false,
  visual,
  index = 0,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
  visual?: ReactNode;
  index?: number;
}) {
  return (
    <div className="panel card-lift reveal flex items-start justify-between gap-4 p-5" style={{ ["--i" as string]: index }}>
      <div className="min-w-0">
        <p className="label">{label}</p>
        <p className={`mt-2 truncate text-3xl font-medium tracking-tight ${accent ? "text-primary" : ""}`}>{value}</p>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {visual}
    </div>
  );
}

/** Progress ring, 0 to 1. */
export function Ring({ value, label }: { value: number; label: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" role="img" aria-label={label} className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#27272A" strokeWidth="5" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke="#FF5A1F"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${c * v} ${c}`}
        transform="rotate(-90 26 26)"
        style={{ transition: "stroke-dasharray 600ms ease" }}
      />
    </svg>
  );
}
