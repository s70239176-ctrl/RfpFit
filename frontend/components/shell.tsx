import Link from "next/link";
import type { ReactNode } from "react";
import { WalletBar, WalletProvider } from "./wallet-bar";
import { configProblem } from "@/lib/genlayer";

export function Shell({ children }: { children: ReactNode }) {
  const problem = configProblem();
  return (
    <WalletProvider>
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-page items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="font-serif text-xl tracking-tight no-underline">
            Rfp<span className="text-copper">Fit</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/rfp/new" className="text-muted no-underline hover:text-fg">
              New RFP
            </Link>
            <WalletBar />
          </nav>
        </div>
      </header>
      {problem && (
        <div role="alert" className="border-b border-bad/40 bg-bad/10">
          <p className="mx-auto max-w-page px-4 py-3 text-sm text-bad sm:px-6">{problem}</p>
        </div>
      )}
      <main className="mx-auto max-w-page px-4 pb-32 pt-10 sm:px-6 lg:pb-16">{children}</main>
      <footer className="border-t border-rule">
        <p className="mx-auto max-w-page px-4 py-6 text-sm text-muted sm:px-6">
          The interface displays the contract. It does not decide.
        </p>
      </footer>
    </WalletProvider>
  );
}
