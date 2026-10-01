"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Ambient } from "@/components/ambient";
import { CopyAddress } from "@/components/copy-address";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { MetricCard, Ring } from "@/components/metric-card";
import { SamplePack } from "@/components/sample-pack";
import { StatusChip, displayStatus } from "@/components/status-chip";
import { getLatestRfpIds, getRfp, getStats } from "@/lib/contract";
import { configProblem, explorerAddressUrl, getNetworkConfig } from "@/lib/genlayer";
import { formatGen, shortReason } from "@/lib/format";
import type { Rfp, Stats } from "@/lib/schema";
import { useNow } from "@/lib/use-now";

const PIPELINE = [
  { title: "Write the brief", text: "Numbered requirements become the frozen rubric." },
  { title: "Lock the prize", text: "GEN is held by the contract, not by a server." },
  { title: "Collect bids", text: "A summary plus a public https evidence link." },
  { title: "GenLayer scores", text: "Validators judge each bid against the rubric." },
  { title: "Settle", text: "Best RESPONSIVE bid is paid. Otherwise a refund." },
];

interface Loaded {
  stats: Stats;
  rfps: Rfp[];
}

function Pipeline() {
  return (
    <section className="panel card-lift reveal p-6 lg:col-span-12" style={{ ["--i" as string]: 3 }} aria-label="Settlement pipeline">
      <p className="label">Settlement pipeline</p>
      <div className="relative mt-6 hidden xl:block" aria-hidden="true">
        <div className="h-px w-full bg-rule" />
        <span className="flow-dot absolute -top-[2px] h-[5px] w-[5px] rounded-pill bg-primary shadow-[0_0_10px_2px_rgba(255,90,31,0.7)]" />
      </div>
      <ol className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-5 xl:gap-6">
        {PIPELINE.map((s, i) => (
          <li key={s.title}>
            <span className="font-mono text-xs font-semibold text-primary">0{i + 1}</span>
            <p className="mt-1 text-sm font-medium">{s.title}</p>
            <p className="mt-1 text-sm text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SettledValue({ stats }: { stats: Stats | null }) {
  const paid = stats?.totalPaid ?? 0n;
  const refunded = stats?.totalRefunded ?? 0n;
  const total = paid + refunded;
  const paidPct = total > 0n ? Number((paid * 1000n) / total) / 10 : 0;
  return (
    <section className="panel card-lift reveal p-6" style={{ ["--i" as string]: 4 }} aria-label="Settled value">
      <p className="label">Settled value</p>
      <p className="mt-2 text-3xl font-medium tracking-tight">
        {stats ? formatGen(total) : "-"} <span className="text-base text-muted">GEN</span>
      </p>
      <div className="mt-4 flex h-2 overflow-hidden rounded-pill bg-rule" role="img" aria-label={`Paid ${paidPct}% refunded ${total > 0n ? 100 - paidPct : 0}%`}>
        <div className="h-full bg-primary transition-[width] duration-700" style={{ width: `${paidPct}%` }} />
        <div className="h-full bg-muted/60 transition-[width] duration-700" style={{ width: total > 0n ? `${100 - paidPct}%` : "0%" }} />
      </div>
      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-2 text-muted">
            <span className="h-2 w-2 rounded-pill bg-primary" /> Paid to winners
          </dt>
          <dd className="font-mono text-xs">{stats ? formatGen(paid) : "-"}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-2 text-muted">
            <span className="h-2 w-2 rounded-pill bg-muted/60" /> Refunded
          </dt>
          <dd className="font-mono text-xs">{stats ? formatGen(refunded) : "-"}</dd>
        </div>
      </dl>
    </section>
  );
}

function Connections() {
  const net = getNetworkConfig();
  const explorer = net.contractAddress ? explorerAddressUrl(net.contractAddress) : "";
  const rows: [string, React.ReactNode][] = [
    ["Network", net.networkName || "Unset"],
    ["Chain ID", <span key="c" className="font-mono text-xs">{net.chainId || "Unset"}</span>],
    ["Contract", net.contractAddress ? <CopyAddress key="a" address={net.contractAddress} /> : "Unset"],
    ["Explorer", explorer ? <a key="e" href={explorer} target="_blank" rel="noreferrer" className="text-sm">Open</a> : "Unset"],
  ];
  return (
    <section className="panel card-lift reveal p-6" style={{ ["--i" as string]: 6 }} aria-label="Connections">
      <p className="label">Connections ({rows.filter(([, v]) => v !== "Unset").length})</p>
      <dl className="mt-4 divide-y divide-rule text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted">Prize is locked in the contract. This UI cannot move it.</p>
    </section>
  );
}

function Trending({ rfps, now }: { rfps: Rfp[]; now: number }) {
  const sorted = [...rfps].sort((a, b) => (a.prizeWei === b.prizeWei ? 0 : a.prizeWei > b.prizeWei ? -1 : 1));
  return (
    <section id="latest" className="panel reveal overflow-hidden lg:col-span-8" style={{ ["--i" as string]: 5 }} aria-labelledby="trending-h">
      <div className="flex items-center justify-between border-b border-rule p-5">
        <h2 id="trending-h" className="text-xl">
          Trending
        </h2>
        <span className="label">By prize</span>
      </div>
      {sorted.length === 0 ? (
        <div className="p-5">
          <EmptyState message="No briefs yet. Lock the first prize." action={{ href: "/rfp/new", label: "Create an RFP" }} />
        </div>
      ) : (
        <ul>
          {sorted.map((r, i) => (
            <li key={r.id} className="border-b border-rule last:border-b-0">
              <Link
                href={`/rfp/${r.id}`}
                className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 no-underline transition-colors duration-150 hover:bg-ink"
              >
                <span className="w-6 font-mono text-xs font-semibold text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium transition-colors duration-150 group-hover:text-primary">{r.title}</span>
                  <span className="font-mono text-xs text-muted">
                    #{r.id} · {r.bidCount} {r.bidCount === 1 ? "bid" : "bids"} · {r.judgedCount} judged
                  </span>
                </span>
                <span className="font-medium text-primary">{formatGen(r.prizeWei)} GEN</span>
                <StatusChip status={displayStatus(r, now)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
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

  const stats = data?.stats ?? null;
  const judgedShare = stats && stats.totalBids > 0 ? stats.totalJudged / stats.totalBids : 0;

  return (
    <div className="space-y-6">
      <section className="panel relative overflow-hidden px-6 py-14 sm:px-12 sm:py-20">
        <div className="grid-bg absolute inset-0" aria-hidden="true" />
        <Ambient />
        <div className="relative max-w-3xl">
          <p className="reveal label" style={{ ["--i" as string]: 0 }}>
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-pill bg-primary align-middle" />
            GenLayer escrow · on-chain verdicts
          </p>
          <h1 className="mt-5 text-5xl font-medium leading-[1.04] sm:text-[64px]">
            <span className="mask-line" style={{ ["--i" as string]: 0 }}>
              <span>Unify the brief,</span>
            </span>
            <span className="mask-line" style={{ ["--i" as string]: 1 }}>
              <span>
                the prize and the <span className="text-primary">verdict.</span>
              </span>
            </span>
          </h1>
          <p className="reveal mt-6 max-w-xl text-lg text-muted" style={{ ["--i" as string]: 3 }}>
            Lock a prize against a written brief. Validators judge whether each bid is actually responsive, then the contract pays the
            winner or refunds the sponsor.
          </p>
          <div className="reveal mt-8 flex flex-wrap gap-3" style={{ ["--i" as string]: 4 }}>
            <Link href="/rfp/new" className="btn-primary px-5 py-2.5">
              Create an RFP
            </Link>
            <a href="#latest" className="btn-quiet px-5 py-2.5">
              Browse briefs
            </a>
          </div>
        </div>
      </section>

      {configProblem() ? (
        <ErrorState message="Contract is not configured, so no data can be read." />
      ) : error ? (
        <ErrorState message={`Could not read the contract: ${error}`} onRetry={load} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Contract totals">
        <MetricCard index={0} label="Briefs" value={stats ? stats.totalRfps : "-"} sub="Created on-chain" />
        <MetricCard index={1} label="Bids" value={stats ? stats.totalBids : "-"} sub="Across all briefs" />
        <MetricCard
          index={2}
          label="Judged"
          value={stats ? stats.totalJudged : "-"}
          sub={stats ? `${Math.round(judgedShare * 100)}% of bids` : undefined}
          visual={<Ring value={judgedShare} label={`${Math.round(judgedShare * 100)} percent of bids judged`} />}
        />
        <MetricCard index={3} accent label="Paid out" value={stats ? formatGen(stats.totalPaid) : "-"} sub="GEN to winners" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Pipeline />
        {data ? <Trending rfps={data.rfps} now={now} /> : (
          <section id="latest" className="panel p-5 lg:col-span-8" aria-label="Trending">
            <p className="text-muted" role="status">
              {error || configProblem() ? "No data to show." : "Reading the contract..."}
            </p>
          </section>
        )}
        <div className="space-y-4 lg:col-span-4">
          <SettledValue stats={stats} />
          <Connections />
        </div>
        <div className="lg:col-span-12">
          <SamplePack mode="info" />
        </div>
      </div>
    </div>
  );
}
