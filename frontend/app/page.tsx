"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { SamplePack } from "@/components/sample-pack";
import { StatusChip, displayStatus } from "@/components/status-chip";
import { getLatestRfpIds, getRfp, getStats } from "@/lib/contract";
import { configProblem } from "@/lib/genlayer";
import { formatGen, shortReason } from "@/lib/format";
import type { Rfp, Stats } from "@/lib/schema";
import { useNow } from "@/lib/use-now";

const STEPS = [
  "Write the brief.",
  "Lock the prize.",
  "Collect bids.",
  "After the deadline, GenLayer scores responsiveness.",
  "One RESPONSIVE winner is paid. Otherwise the sponsor is refunded.",
];

interface Loaded {
  stats: Stats;
  rfps: Rfp[];
}

export default function Home() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useNow(30_000);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [stats, ids] = await Promise.all([getStats(), getLatestRfpIds()]);
      const rfps = (await Promise.all(ids.map((id) => getRfp(id)))).filter((r): r is Rfp => r !== null);
      setData({ stats, rfps });
    } catch (err) {
      setError(shortReason(err));
    }
  }, []);

  useEffect(() => {
    if (!configProblem()) void load();
  }, [load]);

  return (
    <div className="space-y-16">
      <section className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <h1 className="text-5xl leading-[1.05] sm:text-6xl">
            Rfp<span className="text-copper">Fit</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            A brief with teeth. Prize locked. Bids judged against the written requirements. Winner paid by the contract.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/rfp/new" className="btn-primary">
              Create an RFP
            </Link>
            <a href="#latest" className="btn-quiet">
              Browse briefs
            </a>
          </div>
        </div>
        <dl className="panel grid grid-cols-2 gap-px overflow-hidden bg-rule p-0" aria-label="Contract totals">
          {[
            ["Briefs", data ? data.stats.totalRfps.toString() : "-"],
            ["Bids", data ? data.stats.totalBids.toString() : "-"],
            ["Judged", data ? data.stats.totalJudged.toString() : "-"],
            ["Paid out (GEN)", data ? formatGen(data.stats.totalPaid) : "-"],
          ].map(([k, v]) => (
            <div key={k} className="bg-paper p-4">
              <dt className="label">{k}</dt>
              <dd className="mt-1 font-serif text-3xl">{v}</dd>
            </div>
          ))}
          <div className="col-span-2 bg-paper p-4">
            <dt className="label">Refunded (GEN)</dt>
            <dd className="mt-1 font-serif text-3xl">{data ? formatGen(data.stats.totalRefunded) : "-"}</dd>
          </div>
        </dl>
      </section>

      <section id="latest" aria-labelledby="latest-h">
        <h2 id="latest-h" className="mb-4 text-2xl">
          Latest briefs
        </h2>
        {configProblem() ? (
          <ErrorState message="Contract is not configured, so no briefs can be read." />
        ) : error ? (
          <ErrorState message={`Could not read the contract: ${error}`} onRetry={load} />
        ) : !data ? (
          <p className="text-muted" role="status">
            Reading the contract...
          </p>
        ) : data.rfps.length === 0 ? (
          <EmptyState message="No briefs yet. Lock the first prize." action={{ href: "/rfp/new", label: "Create an RFP" }} />
        ) : (
          <ul className="divide-y divide-rule rounded-lg border border-rule">
            {data.rfps.map((r) => (
              <li key={r.id}>
                <Link href={`/rfp/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 no-underline hover:bg-paper">
                  <span>
                    <span className="font-serif text-lg">{r.title}</span>
                    <span className="ml-3 text-sm text-muted">
                      #{r.id} · {r.bidCount} {r.bidCount === 1 ? "bid" : "bids"}
                    </span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="font-serif text-lg text-copper">{formatGen(r.prizeWei)} GEN</span>
                    <StatusChip status={displayStatus(r, now)} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-10 lg:grid-cols-2" aria-labelledby="how-h">
        <div>
          <h2 id="how-h" className="mb-4 text-2xl">
            How it works
          </h2>
          <ol className="space-y-3">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="mt-0.5 rounded-sm bg-copper/15 px-1.5 py-0.5 font-mono text-xs text-copper">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <SamplePack mode="info" />
      </section>
    </div>
  );
}
