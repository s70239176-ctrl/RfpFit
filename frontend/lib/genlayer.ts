import { createClient } from "genlayer-js";
import { studionet, testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus, type Hash } from "genlayer-js/types";

type Hex = `0x${string}`;
type Client = ReturnType<typeof createClient>;

interface Eip1193 {
  request(args: { method: string; params?: unknown }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

export interface NetworkConfig {
  rpc: string;
  chainId: number;
  contractAddress: Hex | "";
  explorerUrl: string;
  networkName: string;
}

export function getNetworkConfig(): NetworkConfig {
  return {
    rpc: process.env.NEXT_PUBLIC_GENLAYER_RPC ?? "",
    chainId: Number(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID ?? ""),
    contractAddress: (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "") as Hex | "",
    explorerUrl: (process.env.NEXT_PUBLIC_EXPLORER_URL ?? "").replace(/\/$/, ""),
    networkName: process.env.NEXT_PUBLIC_NETWORK_NAME ?? "",
  };
}

/** Names every missing or malformed env value, or returns null when the app is configured. */
export function configProblem(): string | null {
  const c = getNetworkConfig();
  const missing: string[] = [];
  if (!c.rpc) missing.push("NEXT_PUBLIC_GENLAYER_RPC");
  if (!Number.isInteger(c.chainId) || c.chainId <= 0) missing.push("NEXT_PUBLIC_GENLAYER_CHAIN_ID");
  if (!c.contractAddress) missing.push("NEXT_PUBLIC_CONTRACT_ADDRESS");
  if (missing.length) return `Missing or invalid environment: ${missing.join(", ")}. See .env.example.`;
  if (!/^0x[0-9a-fA-F]{40}$/.test(c.contractAddress)) {
    return "NEXT_PUBLIC_CONTRACT_ADDRESS is not a 20-byte hex address.";
  }
  return null;
}

/** Chain object from env. Uses the official genlayer-js preset for consensus config, overriding id/RPC/name. */
function buildChain() {
  const c = getNetworkConfig();
  const base = c.chainId === testnetBradbury.id ? testnetBradbury : studionet;
  return {
    ...base,
    id: c.chainId,
    name: c.networkName || base.name,
    rpcUrls: { default: { http: [c.rpc] } },
  };
}

export function requireContract(): Hex {
  const problem = configProblem();
  if (problem) throw new Error(problem);
  return getNetworkConfig().contractAddress as Hex;
}

let cached: { key: string; client: Client } | null = null;

/** The only client factory. One instance per account; the read client has no account. */
export function getClient(account?: Hex): Client {
  const problem = configProblem();
  if (problem) throw new Error(problem);
  const key = account ?? "";
  if (!cached || cached.key !== key) {
    cached = { key, client: createClient({ chain: buildChain(), account }) as Client };
  }
  return cached.client;
}

function provider(): Eip1193 {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No browser wallet found. Install MetaMask or another EIP-1193 wallet.");
  }
  return window.ethereum;
}

async function ensureChain(p: Eip1193) {
  const c = getNetworkConfig();
  const hexId = `0x${c.chainId.toString(16)}`;
  const current = (await p.request({ method: "eth_chainId" })) as string;
  if (current.toLowerCase() === hexId) return;
  const chain = buildChain();
  try {
    await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch {
    await p.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexId,
          chainName: chain.name,
          rpcUrls: [c.rpc],
          nativeCurrency: chain.nativeCurrency,
          blockExplorerUrls: c.explorerUrl ? [c.explorerUrl] : undefined,
        },
      ],
    });
  }
}

export async function connect(): Promise<Hex> {
  const p = provider();
  await ensureChain(p);
  const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts.length) throw new Error("The wallet returned no accounts.");
  return accounts[0] as Hex;
}

export async function getAccount(): Promise<Hex | null> {
  if (typeof window === "undefined" || !window.ethereum) return null;
  const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
  return accounts.length ? (accounts[0] as Hex) : null;
}

export function onAccountsChanged(handler: (account: Hex | null) => void): () => void {
  const p = typeof window === "undefined" ? undefined : window.ethereum;
  if (!p?.on) return () => {};
  const listener = (accounts: unknown) => {
    const list = accounts as string[];
    handler(list.length ? (list[0] as Hex) : null);
  };
  p.on("accountsChanged", listener);
  return () => p.removeListener?.("accountsChanged", listener);
}

export type TxStage = "signing" | "submitted" | "validating";

export async function sendWrite(
  account: Hex,
  functionName: string,
  args: (string | bigint)[],
  valueWei: bigint,
  onStage: (stage: TxStage, txId?: string) => void,
): Promise<{ txId: string; returnValue: string }> {
  await ensureChain(provider());
  const client = getClient(account);
  onStage("signing");
  const txId = (await client.writeContract({
    address: requireContract(),
    functionName,
    args,
    value: valueWei,
  })) as string;
  onStage("submitted", txId);
  onStage("validating", txId);
  const receipt = await waitForReceipt(txId);
  return { txId, returnValue: extractReturn(receipt) };
}

interface ReceiptLike {
  statusName?: string;
  txExecutionResultName?: string;
  consensus_data?: { leader_receipt?: { result?: unknown }[] };
  txDataDecoded?: unknown;
  result?: unknown;
}

/**
 * Waits until validators accept the transaction (state is readable from then on).
 * Throws with a readable message when the contract rejected it.
 */
export async function waitForReceipt(txId: string): Promise<ReceiptLike> {
  const client = getClient();
  const receipt = (await client.waitForTransactionReceipt({
    hash: txId as Hash,
    status: TransactionStatus.ACCEPTED,
    retries: 400,
    interval: 3000,
  })) as ReceiptLike;
  if (receipt.txExecutionResultName === "FINISHED_WITH_ERROR") {
    throw new Error(`Contract rejected the call: ${readRevertReason(receipt)}`);
  }
  return receipt;
}

function readRevertReason(receipt: ReceiptLike): string {
  const first = receipt.consensus_data?.leader_receipt?.[0]?.result as
    | { payload?: { readable?: string } | string }
    | undefined;
  const payload = first?.payload;
  if (typeof payload === "string") return payload;
  if (payload && typeof payload.readable === "string") return payload.readable;
  return "no reason returned. Check the explorer for the transaction.";
}

function extractReturn(receipt: ReceiptLike): string {
  const first = receipt.consensus_data?.leader_receipt?.[0]?.result as
    | { payload?: { readable?: string } }
    | undefined;
  const readable = first?.payload?.readable;
  if (typeof readable === "string") return readable.replace(/^"|"$/g, "").replace(/\\"/g, '"');
  return "";
}

export function explorerTxUrl(txId: string): string {
  const base = getNetworkConfig().explorerUrl;
  return base ? `${base}/transactions/${txId}` : "";
}

export function explorerAddressUrl(address: string): string {
  const base = getNetworkConfig().explorerUrl;
  return base ? `${base}/address/${address}` : "";
}
