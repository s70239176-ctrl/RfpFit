"use client";

import { useState } from "react";
import { truncateAddress } from "@/lib/format";

export function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs">
      <span title={address}>{truncateAddress(address)}</span>
      <button
        type="button"
        onClick={copy}
        className="rounded border border-rule px-1.5 py-0.5 text-[11px] text-muted transition-colors duration-150 hover:border-muted hover:text-fg"
        aria-label={`Copy address ${address}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
