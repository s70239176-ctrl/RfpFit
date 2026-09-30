"use client";

import Link from "next/link";
import { SAMPLE_BIDS, SAMPLE_RFP, type SampleBid } from "@/lib/sample-data";

type Props =
  | { mode: "info" }
  | { mode: "rfp"; onFill: (rfp: typeof SAMPLE_RFP) => void }
  | { mode: "bid"; onFill: (bid: SampleBid) => void };

export function SamplePack(props: Props) {
  return (
    <aside className="panel border-dashed p-5" aria-label="Sample pack">
      <div className="flex items-center gap-2">
        <span className="rounded-sm border border-partial/50 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.1em] text-partial">
          Sample
        </span>
        <h2 className="text-lg">Demo brief and three bids</h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        &ldquo;{SAMPLE_RFP.title}&rdquo; with one bid per outcome. Filling a form does not submit anything. You still sign.
      </p>

      {props.mode === "info" && (
        <Link href="/rfp/new" className="btn-quiet mt-4">
          Open the create form
        </Link>
      )}

      {props.mode === "rfp" && (
        <button type="button" className="btn-quiet mt-4" onClick={() => props.onFill(SAMPLE_RFP)}>
          Fill form with sample brief
        </button>
      )}

      {props.mode === "bid" && (
        <ul className="mt-4 space-y-2">
          {SAMPLE_BIDS.map((b) => (
            <li key={b.bidId} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {b.label} <span className="font-mono text-xs text-muted">{b.bidId}</span>
                <span className="ml-2 text-xs text-muted">expected {b.expected.replace("_", "-")}</span>
              </span>
              <button type="button" className="btn-quiet py-1" onClick={() => props.onFill(b)}>
                Fill bid
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
