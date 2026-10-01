import {
  getClient,
  requireContract,
  sendWrite,
  type TxStage,
} from "./genlayer";
import {
  parseBid,
  parseIdList,
  parseReceipt,
  parseRfp,
  parseStats,
  parseVerdict,
  type Bid,
  type Receipt,
  type Rfp,
  type Stats,
  type Verdict,
} from "./schema";

type Hex = `0x${string}`;
export type OnStage = (stage: TxStage, txId?: string) => void;
export interface WriteResult {
  txId: string;
}

/** Reads retry briefly: the public RPC gateway occasionally answers with an HTML error page. */
async function read(functionName: string, args: string[] = []): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const out = await getClient().readContract({
        address: requireContract(),
        functionName,
        args,
      });
      return typeof out === "string" ? out : String(out ?? "");
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function getRfp(id: string): Promise<Rfp | null> {
  const raw = await read("get_rfp", [id]);
  return raw ? parseRfp(raw) : null;
}

export async function getBid(rfpId: string, bidId: string): Promise<Bid | null> {
  const raw = await read("get_bid", [rfpId, bidId]);
  return raw ? parseBid(raw) : null;
}

export async function getVerdict(rfpId: string, bidId: string): Promise<Verdict | null> {
  const raw = await read("get_verdict", [rfpId, bidId]);
  return raw ? parseVerdict(raw) : null;
}

export async function getBidIds(rfpId: string): Promise<string[]> {
  return parseIdList(await read("get_bid_ids", [rfpId]));
}

export async function getLatestRfpIds(): Promise<string[]> {
  return parseIdList(await read("get_latest_rfp_ids"));
}

export async function getStats(): Promise<Stats> {
  return parseStats(await read("get_stats"));
}

export interface BidWithVerdict {
  bid: Bid;
  verdict: Verdict | null;
}

/** Everything the RFP page shows, read fresh from the contract. */
export async function getRfpDetail(id: string): Promise<{ rfp: Rfp; bids: BidWithVerdict[] } | null> {
  const rfp = await getRfp(id);
  if (!rfp) return null;
  const ids = await getBidIds(id);
  const bids = await Promise.all(
    ids.map(async (bidId) => {
      const [bid, verdict] = await Promise.all([getBid(id, bidId), getVerdict(id, bidId)]);
      if (!bid) throw new Error(`Bid ${bidId} is indexed but missing on-chain`);
      return { bid, verdict };
    }),
  );
  return { rfp, bids };
}

export async function createRfp(
  account: Hex,
  input: {
    title: string;
    summary: string;
    requirementsText: string;
    requirementIds: string[];
    deadlineTs: number;
    valueWei: bigint;
  },
  onStage: OnStage,
): Promise<WriteResult & { rfpId: string }> {
  const { txId, returnValue } = await sendWrite(
    account,
    "create_rfp",
    [input.title, input.summary, input.requirementsText, input.requirementIds.join(","), BigInt(input.deadlineTs)],
    input.valueWei,
    onStage,
  );
  // The return value is the new id; fall back to the newest id on-chain if the node omitted it.
  const rfpId = /^\d+$/.test(returnValue) ? returnValue : ((await getLatestRfpIds())[0] ?? "");
  return { txId, rfpId };
}

export async function submitBid(
  account: Hex,
  input: { rfpId: string; bidId: string; summary: string; evidenceUri: string },
  onStage: OnStage,
): Promise<WriteResult> {
  const { txId } = await sendWrite(
    account,
    "submit_bid",
    [input.rfpId, input.bidId, input.summary, input.evidenceUri],
    0n,
    onStage,
  );
  return { txId };
}

export async function judgeBid(account: Hex, rfpId: string, bidId: string, onStage: OnStage): Promise<WriteResult> {
  const { txId } = await sendWrite(account, "judge_bid", [rfpId, bidId], 0n, onStage);
  return { txId };
}

export async function finalize(
  account: Hex,
  rfpId: string,
  onStage: OnStage,
): Promise<WriteResult & { receipt: Receipt | null }> {
  const { txId, returnValue } = await sendWrite(account, "finalize", [rfpId], 0n, onStage);
  let receipt: Receipt | null = null;
  try {
    receipt = returnValue ? parseReceipt(returnValue) : null;
  } catch {
    receipt = null;
  }
  return { txId, receipt };
}
