"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { connect, getAccount, getNetworkConfig, onAccountsChanged } from "@/lib/genlayer";
import { shortReason, truncateAddress } from "@/lib/format";

type Hex = `0x${string}`;

interface WalletState {
  account: Hex | null;
  connecting: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Hex | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getAccount()
      .then((a) => live && setAccount(a))
      .catch(() => undefined);
    const off = onAccountsChanged((a) => setAccount(a));
    return () => {
      live = false;
      off();
    };
  }, []);

  const connectWallet = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      setAccount(await connect());
    } catch (err) {
      setError(shortReason(err));
    } finally {
      setConnecting(false);
    }
  }, []);

  const value = useMemo(() => ({ account, connecting, error, connectWallet }), [account, connecting, error, connectWallet]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function WalletBar() {
  const { account, connecting, error, connectWallet } = useWallet();
  const network = getNetworkConfig().networkName || "GenLayer";
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-xs text-muted sm:inline">{network}</span>
      {account ? (
        <span className="rounded border border-rule px-3 py-1.5 font-mono text-xs" title={account}>
          {truncateAddress(account)}
        </span>
      ) : (
        <button type="button" className="btn-quiet py-1.5" onClick={connectWallet} disabled={connecting}>
          {connecting ? "Connecting" : "Connect wallet"}
        </button>
      )}
      {error && (
        <span role="alert" className="max-w-[16rem] truncate text-xs text-bad" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
