import { RISK_FLAGS, VERDICT_LABELS } from "./constants";

export type VerdictLabel = (typeof VERDICT_LABELS)[number];
export type RiskFlag = (typeof RISK_FLAGS)[number];
export type ContractStatus = "OPEN" | "CLOSED_FOR_BIDS" | "FINALIZED" | "REFUNDED";

export interface Rfp {
  id: string;
  sponsor: string;
  title: string;
  summary: string;
  requirementsText: string;
  requirementIds: string[];
  deadlineTs: number;
  prizeWei: bigint;
  status: ContractStatus;
  bidCount: number;
  judgedCount: number;
  winnerBidId: string;
  winnerAddress: string;
  finalized: boolean;
  createdTs: number;
}

export interface Bid {
  rfpId: string;
  bidId: string;
  bidder: string;
  summary: string;
  evidenceUri: string;
  createdTs: number;
}

export interface Verdict {
  verdict: VerdictLabel;
  score: number;
  requirementsMet: string[];
  requirementsMissing: string[];
  requirementsUnclear: string[];
  evidenceUsed: "ONCHAIN_SUMMARY" | "URI" | "BOTH";
  reasons: string[];
  riskFlags: RiskFlag[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
  raw: string;
}

export interface Stats {
  totalRfps: number;
  totalBids: number;
  totalJudged: number;
  totalPaid: bigint;
  totalRefunded: bigint;
}

export interface Receipt {
  action: "PAY_WINNER" | "REFUND_SPONSOR";
  recipient: string;
  amountWei: bigint;
  bidId: string;
}

type Obj = Record<string, unknown>;

function obj(raw: string, what: string): Obj {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`${what}: contract returned invalid JSON`);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(`${what}: expected a JSON object`);
  }
  return data as Obj;
}

function str(o: Obj, key: string, what: string): string {
  const v = o[key];
  if (typeof v !== "string") throw new Error(`${what}: field "${key}" is not a string`);
  return v;
}

function num(o: Obj, key: string, what: string): number {
  const v = o[key];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${what}: field "${key}" is not a number`);
  return v;
}

function strList(o: Obj, key: string, what: string): string[] {
  const v = o[key];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    throw new Error(`${what}: field "${key}" is not a string list`);
  }
  return v as string[];
}

export function parseRfp(raw: string): Rfp {
  const o = obj(raw, "RFP");
  const status = str(o, "status", "RFP");
  if (!["OPEN", "CLOSED_FOR_BIDS", "FINALIZED", "REFUNDED"].includes(status)) {
    throw new Error(`RFP: unknown status "${status}"`);
  }
  return {
    id: str(o, "id", "RFP"),
    sponsor: str(o, "sponsor", "RFP"),
    title: str(o, "title", "RFP"),
    summary: str(o, "summary", "RFP"),
    requirementsText: str(o, "requirements_text", "RFP"),
    requirementIds: strList(o, "requirement_ids", "RFP"),
    deadlineTs: num(o, "deadline_ts", "RFP"),
    prizeWei: BigInt(str(o, "prize_wei", "RFP")),
    status: status as ContractStatus,
    bidCount: num(o, "bid_count", "RFP"),
    judgedCount: num(o, "judged_count", "RFP"),
    winnerBidId: str(o, "winner_bid_id", "RFP"),
    winnerAddress: str(o, "winner_address", "RFP"),
    finalized: o.finalized === true,
    createdTs: num(o, "created_ts", "RFP"),
  };
}

export function parseBid(raw: string): Bid {
  const o = obj(raw, "Bid");
  return {
    rfpId: str(o, "rfp_id", "Bid"),
    bidId: str(o, "bid_id", "Bid"),
    bidder: str(o, "bidder", "Bid"),
    summary: str(o, "summary", "Bid"),
    evidenceUri: str(o, "evidence_uri", "Bid"),
    createdTs: num(o, "created_ts", "Bid"),
  };
}

export function parseVerdict(raw: string): Verdict {
  const o = obj(raw, "Verdict");
  const verdict = str(o, "verdict", "Verdict");
  if (!(VERDICT_LABELS as readonly string[]).includes(verdict)) {
    throw new Error(`Verdict: unknown label "${verdict}"`);
  }
  return {
    verdict: verdict as VerdictLabel,
    score: num(o, "score", "Verdict"),
    requirementsMet: strList(o, "requirements_met", "Verdict"),
    requirementsMissing: strList(o, "requirements_missing", "Verdict"),
    requirementsUnclear: strList(o, "requirements_unclear", "Verdict"),
    evidenceUsed: str(o, "evidence_used", "Verdict") as Verdict["evidenceUsed"],
    reasons: strList(o, "reasons", "Verdict"),
    riskFlags: strList(o, "risk_flags", "Verdict") as RiskFlag[],
    confidence: str(o, "confidence", "Verdict") as Verdict["confidence"],
    raw,
  };
}

export function parseStats(raw: string): Stats {
  const o = obj(raw, "Stats");
  return {
    totalRfps: num(o, "total_rfps", "Stats"),
    totalBids: num(o, "total_bids", "Stats"),
    totalJudged: num(o, "total_judged", "Stats"),
    totalPaid: BigInt(str(o, "total_paid", "Stats")),
    totalRefunded: BigInt(str(o, "total_refunded", "Stats")),
  };
}

export function parseReceipt(raw: string): Receipt {
  const o = obj(raw, "Receipt");
  const action = str(o, "action", "Receipt");
  if (action !== "PAY_WINNER" && action !== "REFUND_SPONSOR") {
    throw new Error(`Receipt: unknown action "${action}"`);
  }
  return {
    action,
    recipient: str(o, "recipient", "Receipt"),
    amountWei: BigInt(str(o, "amount_wei", "Receipt")),
    bidId: str(o, "bid_id", "Receipt"),
  };
}

export function parseIdList(raw: string): string[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Contract returned an invalid id list");
  }
  if (!Array.isArray(data) || data.some((x) => typeof x !== "string")) {
    throw new Error("Contract returned an invalid id list");
  }
  return data as string[];
}
