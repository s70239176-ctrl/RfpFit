"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { configProblem, getNetworkConfig } from "@/lib/genlayer";
import { truncateAddress } from "@/lib/format";
import { CopyAddress } from "./copy-address";
import { WalletBar, WalletProvider, useWallet } from "./wallet-bar";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight no-underline">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/rfpfit-mark.svg" alt="" width={28} height={28} />
      <span>
        Rfp<span className="text-primary">Fit</span>
      </span>
    </Link>
  );
}

const NAV = [
  { href: "/", label: "Overview", key: "01" },
  { href: "/rfp/new", label: "New RFP", key: "02" },
];

function Dot({ on }: { on: boolean }) {
  return <span className={`h-1.5 w-1.5 rounded-pill ${on ? "bg-good" : "bg-muted/50"}`} aria-hidden="true" />;
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { account } = useWallet();
  const net = getNetworkConfig();
  const ok = configProblem() === null;

  return (
    <div className="flex h-full flex-col gap-8 p-5">
      <Brand />

      <nav aria-label="Primary" className="space-y-1">
        <p className="label mb-2">Workspace</p>
        {NAV.map((n) => {
          const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center justify-between rounded px-3 py-2 text-sm no-underline transition-colors duration-150 ${
                active ? "bg-primary/10 text-primary" : "text-muted hover:bg-paper hover:text-fg"
              }`}
            >
              {n.label}
              <span className="font-mono text-[11px] opacity-60">{n.key}</span>
            </Link>
          );
        })}
        <Link
          href="/#latest"
          onClick={onNavigate}
          className="flex items-center justify-between rounded px-3 py-2 text-sm text-muted no-underline transition-colors duration-150 hover:bg-paper hover:text-fg"
        >
          Trending briefs
          <span className="font-mono text-[11px] opacity-60">03</span>
        </Link>
      </nav>

      <section aria-label="Connections" className="space-y-2">
        <p className="label mb-2">Connections ({(account ? 1 : 0) + (ok ? 2 : 0)})</p>
        <div className="space-y-2 text-sm">
          <div className="panel flex items-center justify-between gap-2 px-3 py-2">
            <span className="flex items-center gap-2 text-muted">
              <Dot on={Boolean(account)} /> Wallet
            </span>
            <span className="font-mono text-xs">{account ? truncateAddress(account) : "Not connected"}</span>
          </div>
          <div className="panel flex items-center justify-between gap-2 px-3 py-2">
            <span className="flex items-center gap-2 text-muted">
              <Dot on={ok} /> Network
            </span>
            <span className="font-mono text-xs">{net.networkName || "Unset"}</span>
          </div>
          <div className="panel flex flex-col gap-1.5 px-3 py-2">
            <span className="flex items-center gap-2 text-muted">
              <Dot on={ok} /> Contract
            </span>
            {net.contractAddress ? <CopyAddress address={net.contractAddress} /> : <span className="font-mono text-xs">Unset</span>}
          </div>
        </div>
      </section>

      <p className="mt-auto text-xs text-muted">The interface displays the contract. It does not decide.</p>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const problem = configProblem();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-rule bg-ink lg:block" aria-label="Sidebar">
        <SidebarBody />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-rule bg-ink/90 px-4 py-3 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              type="button"
              className="btn-quiet px-3 py-1.5"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((v) => !v)}
            >
              Menu
            </button>
            <Brand />
          </div>
          <p className="label hidden lg:block">Escrow-backed RFP adjudication</p>
          <WalletBar />
        </header>

        {open && (
          <div id="mobile-nav" className="fade-in border-b border-rule bg-ink lg:hidden">
            <SidebarBody onNavigate={() => setOpen(false)} />
          </div>
        )}

        {problem && (
          <div role="alert" className="border-b border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad sm:px-8">
            {problem}
          </div>
        )}

        <main className="mx-auto max-w-[1200px] px-4 pb-32 pt-8 sm:px-8 lg:pb-16">{children}</main>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <Frame>{children}</Frame>
    </WalletProvider>
  );
}
