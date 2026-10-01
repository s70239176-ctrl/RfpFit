import { RISK_FLAG_TEXT } from "@/lib/constants";
import type { Verdict } from "@/lib/schema";
import { VerdictWord } from "./status-chip";

const EVIDENCE_TEXT: Record<Verdict["evidenceUsed"], string> = {
  ONCHAIN_SUMMARY: "On-chain summary only",
  URI: "Evidence link only",
  BOTH: "Summary and evidence link",
};

export function VerdictSheet({ verdict }: { verdict: Verdict }) {
  return (
    <div className="fade-in mt-4 rounded border border-double border-muted/40 p-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="label">Verdict, stored on-chain</p>
          <VerdictWord verdict={verdict.verdict} className="text-3xl uppercase" />
        </div>
        <div className="text-right">
          <p className="text-3xl leading-none">
            {verdict.score}
            <span className="text-base text-muted">/100</span>
          </p>
          <p className="mt-1 text-xs text-muted">Confidence {verdict.confidence.toLowerCase()}</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-pill bg-rule" role="img" aria-label={`Score ${verdict.score} out of 100`}>
        <div
          className={`h-full transition-[width] duration-700 ${verdict.verdict === "RESPONSIVE" ? "bg-good" : verdict.verdict === "PARTIAL" ? "bg-partial" : "bg-bad"}`}
          style={{ width: `${Math.max(0, Math.min(100, verdict.score))}%` }}
        />
      </div>

      {verdict.reasons.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {verdict.reasons.map((r, i) => (
            <li key={i} className="border-l border-rule pl-3">
              {r}
            </li>
          ))}
        </ul>
      )}

      {(verdict.requirementsMissing.length > 0 || verdict.requirementsUnclear.length > 0) && (
        <p className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
          {verdict.requirementsMissing.map((id) => (
            <span key={id} className="rounded-sm border border-bad/40 px-1.5 py-0.5 font-mono text-bad line-through">
              {id}
            </span>
          ))}
          {verdict.requirementsUnclear.map((id) => (
            <span key={id} className="rounded-sm border border-partial/40 px-1.5 py-0.5 font-mono text-partial">
              {id}?
            </span>
          ))}
          <span className="text-muted">missing / unclear</span>
        </p>
      )}

      <p className="mt-3 text-xs text-muted">
        Judged on: {EVIDENCE_TEXT[verdict.evidenceUsed] ?? verdict.evidenceUsed}
        {verdict.riskFlags.length > 0 && (
          <>
            {" · "}
            {verdict.riskFlags.map((f) => RISK_FLAG_TEXT[f] ?? f).join(" · ")}
          </>
        )}
      </p>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted hover:text-fg">Raw verdict</summary>
        <pre className="mt-2 overflow-x-auto rounded bg-ink p-3 font-mono text-[11px] leading-relaxed text-muted">
          {JSON.stringify(JSON.parse(verdict.raw), null, 2)}
        </pre>
      </details>
    </div>
  );
}
