"use client";

import { useCallback, useRef, useState } from "react";
import { explorerTxUrl, type TxStage } from "@/lib/genlayer";
import { shortReason } from "@/lib/format";

export type TxState =
  | { phase: "idle" }
  | { phase: TxStage; txId?: string }
  | { phase: "success"; txId: string; note?: string }
  | { phase: "failed"; message: string; txId?: string };

type Runner<T> = (onStage: (stage: TxStage, txId?: string) => void) => Promise<{ txId: string; note?: string } & T>;

/** Drives one write button: pending / success / failed, plus a retry of the same call. */
export function useTx() {
  const [state, setState] = useState<TxState>({ phase: "idle" });
  const last = useRef<{ run: Runner<object>; after?: () => void | Promise<void> } | null>(null);

  const run = useCallback(async <T extends object>(runner: Runner<T>, after?: () => void | Promise<void>) => {
    last.current = { run: runner as Runner<object>, after };
    let txId: string | undefined;
    setState({ phase: "signing" });
    try {
      const result = await runner((stage, id) => {
        txId = id ?? txId;
        setState({ phase: stage, txId });
      });
      setState({ phase: "success", txId: result.txId, note: result.note });
      // Re-read contract state so the UI shows what is on-chain, not what we expect.
      await after?.();
      return result;
    } catch (err) {
      setState({ phase: "failed", message: shortReason(err), txId });
      return undefined;
    }
  }, []);

  const retry = useCallback(() => {
    const l = last.current;
    if (l) void run(l.run, l.after);
  }, [run]);

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  return { state, run, retry, reset, pending: ["signing", "submitted", "validating"].includes(state.phase) };
}

const STEPS: { phase: TxStage; text: string }[] = [
  { phase: "signing", text: "Waiting for wallet signature" },
  { phase: "submitted", text: "Submitted to GenLayer" },
  { phase: "validating", text: "Validators are reviewing. This can take minutes." },
];

export function TxPanel({ state, onRetry, onDismiss }: { state: TxState; onRetry: () => void; onDismiss: () => void }) {
  if (state.phase === "idle") return null;

  if (state.phase === "success") {
    const url = explorerTxUrl(state.txId);
    return (
      <div role="status" className="fade-in rounded border border-good/40 bg-good/10 p-3 text-sm">
        <p className="text-good">Confirmed on-chain.{state.note ? ` ${state.note}` : ""}</p>
        <p className="mt-1 flex items-center gap-3 text-muted">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer">
              View transaction
            </a>
          ) : (
            <span className="font-mono text-xs">{state.txId}</span>
          )}
          <button type="button" className="text-xs underline underline-offset-4" onClick={onDismiss}>
            Dismiss
          </button>
        </p>
      </div>
    );
  }

  if (state.phase === "failed") {
    const url = state.txId ? explorerTxUrl(state.txId) : "";
    return (
      <div role="alert" className="fade-in rounded border border-bad/40 bg-bad/10 p-3 text-sm">
        <p className="text-bad">{state.message}</p>
        <p className="mt-2 flex items-center gap-3">
          <button type="button" className="btn-quiet py-1" onClick={onRetry}>
            Retry
          </button>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="text-muted">
              View transaction
            </a>
          )}
          <button type="button" className="text-xs text-muted underline underline-offset-4" onClick={onDismiss}>
            Dismiss
          </button>
        </p>
      </div>
    );
  }

  const active = STEPS.findIndex((s) => s.phase === state.phase);
  return (
    <ol role="status" aria-live="polite" className="fade-in space-y-1.5 rounded border border-rule p-3 text-sm">
      {STEPS.map((s, i) => (
        <li key={s.phase} className={i < active ? "text-muted line-through" : i === active ? "text-fg" : "text-muted/50"}>
          <span className="mr-2 inline-block w-4 font-mono text-xs text-primary">{i === active ? ">" : i < active ? "-" : ""}</span>
          {s.text}
        </li>
      ))}
    </ol>
  );
}
