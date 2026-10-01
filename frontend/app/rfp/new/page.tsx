"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SamplePack } from "@/components/sample-pack";
import { TxPanel, useTx } from "@/components/tx-toast";
import { useWallet } from "@/components/wallet-bar";
import { LIMITS, REQ_ID_RE } from "@/lib/constants";
import { createRfp } from "@/lib/contract";
import { configProblem } from "@/lib/genlayer";
import { formatGen, formatTime, parseGen, truncateAddress } from "@/lib/format";

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function detectIds(text: string): string {
  const ids: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(R[1-9][0-9]?)\b/.exec(line);
    if (m && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids.join(",");
}

export default function NewRfp() {
  const router = useRouter();
  const { account, connectWallet } = useWallet();
  const tx = useTx();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [requirements, setRequirements] = useState("");
  const [idsCsv, setIdsCsv] = useState("");
  const [deadline, setDeadline] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [prize, setPrize] = useState("");
  const [touched, setTouched] = useState(false);

  const ids = idsCsv.split(",").map((s) => s.trim()).filter(Boolean);
  const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000);
  const valueWei = parseGen(prize);

  function validate(): string | null {
    const t = title.trim().length;
    if (t < LIMITS.title.min || t > LIMITS.title.max) return `Title must be ${LIMITS.title.min} to ${LIMITS.title.max} characters.`;
    const s = summary.trim().length;
    if (s < LIMITS.summary.min || s > LIMITS.summary.max) return `Summary must be ${LIMITS.summary.min} to ${LIMITS.summary.max} characters.`;
    const r = requirements.trim().length;
    if (r < LIMITS.requirements.min || r > LIMITS.requirements.max) {
      return `Requirements must be ${LIMITS.requirements.min} to ${LIMITS.requirements.max} characters.`;
    }
    if (ids.length < LIMITS.requirementIds.min || ids.length > LIMITS.requirementIds.max) return "List 2 to 8 requirement IDs, like R1,R2,R3.";
    for (const id of ids) {
      if (!REQ_ID_RE.test(id)) return `"${id}" is not a valid requirement ID (R1 to R99).`;
      if (!new RegExp(`(^|[^A-Za-z0-9])${id}([^A-Za-z0-9]|$)`).test(requirements)) return `${id} does not appear in the requirements text.`;
    }
    if (new Set(ids).size !== ids.length) return "Requirement IDs must be unique.";
    if (!Number.isFinite(deadlineTs) || deadlineTs * 1000 <= Date.now()) return "Deadline must be in the future.";
    if (valueWei === null) return "Enter a prize greater than 0 GEN, like 0.5.";
    return null;
  }

  const problem = validate();
  const busy = tx.pending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!account) return void connectWallet();
    if (problem || valueWei === null) return;
    void tx.run(async (onStage) => {
      const r = await createRfp(
        account,
        {
          title: title.trim(),
          summary: summary.trim(),
          requirementsText: requirements.trim(),
          requirementIds: ids,
          deadlineTs,
          valueWei,
        },
        onStage,
      );
      if (r.rfpId) setTimeout(() => router.push(`/rfp/${r.rfpId}`), 1200);
      return { ...r, note: r.rfpId ? `Brief #${r.rfpId} is live. Opening it.` : "Brief created." };
    });
  }

  const prizeLabel = valueWei === null ? "-" : formatGen(valueWei, 6);
  const sections = "panel reveal space-y-5 p-6";

  return (
    <div className="space-y-6">
      <header className="reveal">
        <p className="label">Sponsor</p>
        <h1 className="mt-2 text-4xl font-medium sm:text-5xl">New RFP</h1>
        <p className="mt-3 max-w-2xl text-muted">
          The requirements and prize freeze once the first bid lands. The contract holds the prize until it pays a winner or refunds you.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <form onSubmit={submit} className="space-y-6 lg:col-span-8" noValidate>
          <section className={sections} style={{ ["--i" as string]: 1 }}>
            <h2 className="flex items-center gap-3 text-xl"><span className="font-mono text-xs font-semibold text-primary">01</span> Brief</h2>
            <div>
              <label htmlFor="title" className="label">Title</label>
              <input id="title" className="field mt-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.title.max} disabled={busy} />
            </div>
            <div>
              <label htmlFor="summary" className="label">Summary</label>
              <textarea id="summary" className="field mt-1 min-h-20" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={LIMITS.summary.max} disabled={busy} />
            </div>
          </section>

          <section className={sections} style={{ ["--i" as string]: 2 }}>
            <h2 className="flex items-center gap-3 text-xl"><span className="font-mono text-xs font-semibold text-primary">02</span> Rubric</h2>
            <div>
              <label htmlFor="reqs" className="label">Requirements (one per line, start each with its ID)</label>
              <textarea
                id="reqs"
                className="field mt-1 min-h-40 font-mono text-sm"
                value={requirements}
                onChange={(e) => {
                  setRequirements(e.target.value);
                  if (!idsCsv) setIdsCsv(detectIds(e.target.value));
                }}
                maxLength={LIMITS.requirements.max}
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor="ids" className="label">Requirement IDs</label>
              <div className="mt-1 flex gap-2">
                <input id="ids" className="field font-mono" value={idsCsv} onChange={(e) => setIdsCsv(e.target.value)} placeholder="R1,R2,R3" disabled={busy} />
                <button type="button" className="btn-quiet whitespace-nowrap" onClick={() => setIdsCsv(detectIds(requirements))} disabled={busy}>
                  Detect
                </button>
              </div>
            </div>
          </section>

          <section className={sections} style={{ ["--i" as string]: 3 }}>
            <h2 className="flex items-center gap-3 text-xl"><span className="font-mono text-xs font-semibold text-primary">03</span> Escrow</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="deadline" className="label">Bid deadline (your local time)</label>
                <input id="deadline" type="datetime-local" className="field mt-1" value={deadline} onChange={(e) => setDeadline(e.target.value)} disabled={busy} />
              </div>
              <div>
                <label htmlFor="prize" className="label">Prize (GEN)</label>
                <input id="prize" inputMode="decimal" className="field mt-1 font-mono" value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="0.5" disabled={busy} />
              </div>
            </div>
            {touched && problem && <p role="alert" className="text-sm text-bad">{problem}</p>}
            {configProblem() && <p role="alert" className="text-sm text-bad">{configProblem()}</p>}
            <button type="submit" className="btn-primary w-full px-5 py-2.5 sm:w-auto" disabled={busy || Boolean(configProblem())}>
              {busy ? "Locking prize" : account ? "Lock prize" : "Connect wallet to lock prize"}
            </button>
            <TxPanel state={tx.state} onRetry={tx.retry} onDismiss={tx.reset} />
          </section>
        </form>

        <div className="space-y-6 lg:sticky lg:top-20 lg:col-span-4 lg:self-start">
          <section className="panel reveal p-6" style={{ ["--i" as string]: 2 }} aria-label="Escrow preview">
            <p className="label">Escrow preview</p>
            <p className="mt-2 text-3xl font-medium tracking-tight text-primary">{prizeLabel} <span className="text-base text-muted">GEN</span></p>
            <dl className="mt-4 divide-y divide-rule text-sm">
              <div className="flex justify-between gap-3 py-2.5"><dt className="text-muted">Requirements</dt><dd className="font-mono text-xs">{ids.length || "-"}</dd></div>
              <div className="flex justify-between gap-3 py-2.5"><dt className="text-muted">Deadline</dt><dd className="text-right">{Number.isFinite(deadlineTs) ? formatTime(deadlineTs) : "-"}</dd></div>
              <div className="flex justify-between gap-3 py-2.5"><dt className="text-muted">Sponsor</dt><dd className="font-mono text-xs">{account ? truncateAddress(account) : "Not connected"}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">Prize is locked in the contract. This UI cannot move it.</p>
          </section>
          <SamplePack
            mode="rfp"
            onFill={(s) => {
              setTitle(s.title);
              setSummary(s.summary);
              setRequirements(s.requirementsText);
              setIdsCsv(s.requirementIds);
              setTouched(false);
              tx.reset();
            }}
          />
        </div>
      </div>
    </div>
  );
}
