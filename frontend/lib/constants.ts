export const LIMITS = {
  title: { min: 3, max: 80 },
  summary: { min: 20, max: 800 },
  requirements: { min: 40, max: 4000 },
  requirementIds: { min: 2, max: 8 },
  bidId: { min: 3, max: 32 },
  bidSummary: { min: 40, max: 2000 },
  evidenceUri: { max: 300 },
  maxBids: 8,
  latestRfps: 20,
} as const;

export const REQ_ID_RE = /^R[1-9][0-9]?$/;
export const BID_ID_RE = /^[A-Za-z0-9_]{3,32}$/;

export const WEI_PER_GEN = 10n ** 18n;

export const VERDICT_LABELS = ["RESPONSIVE", "PARTIAL", "NON_RESPONSIVE"] as const;
export const RISK_FLAGS = [
  "GENERIC_FLUFF",
  "URI_UNREACHABLE",
  "URI_IRRELEVANT",
  "SPONSOR_IS_BIDDER",
  "COPYPASTA",
  "OVERCLAIM",
  "EMPTY_EVIDENCE",
] as const;

export const RISK_FLAG_TEXT: Record<(typeof RISK_FLAGS)[number], string> = {
  GENERIC_FLUFF: "Generic language, no concrete evidence",
  URI_UNREACHABLE: "Evidence link could not be fetched",
  URI_IRRELEVANT: "Evidence link does not address the brief",
  SPONSOR_IS_BIDDER: "Bidder is the sponsor",
  COPYPASTA: "Text copied from the brief",
  OVERCLAIM: "Claims exceed the evidence",
  EMPTY_EVIDENCE: "No assessable evidence",
};
