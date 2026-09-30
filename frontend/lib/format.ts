import { WEI_PER_GEN } from "./constants";

export function formatGen(wei: bigint, maxDecimals = 4): string {
  const whole = wei / WEI_PER_GEN;
  const frac = wei % WEI_PER_GEN;
  if (frac === 0n) return whole.toString();
  const digits = frac.toString().padStart(18, "0").slice(0, maxDecimals).replace(/0+$/, "");
  if (digits === "") return `<${whole}.${"0".repeat(maxDecimals - 1)}1`;
  return `${whole}.${digits}`;
}

/** Parse a decimal GEN string ("0.5") into wei. Returns null when invalid or not positive. */
export function parseGen(input: string): bigint | null {
  const m = /^(\d+)(?:\.(\d{1,18}))?$/.exec(input.trim());
  if (!m) return null;
  const wei = BigInt(m[1]) * WEI_PER_GEN + BigInt((m[2] ?? "").padEnd(18, "0") || "0");
  return wei > 0n ? wei : null;
}

export function truncateAddress(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

export function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function countdown(deadlineTs: number, nowMs: number): string {
  const s = Math.floor(deadlineTs - nowMs / 1000);
  if (s <= 0) return "Deadline passed";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m ${s % 60}s left`;
}

export function shortReason(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const line = msg.split("\n")[0].trim();
  return line.length > 220 ? `${line.slice(0, 217)}...` : line;
}
