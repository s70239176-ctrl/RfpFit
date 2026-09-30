// SAMPLE data only. Never mixed into on-chain state; it fills forms and the clipboard, nothing else.

/** A public repo standing in for evidence. Replace with a URL you control for a stronger demo. */
const EXAMPLE_REPO = "https://github.com/vitejs/vite";

export const SAMPLE_RFP = {
  title: "Lagos Civic Data Landing Page",
  summary:
    "Build a public page that helps a resident find three working Lagos open-data sources. No wallet required to read the page.",
  requirementsText: [
    "R1 Public GitHub repository with a README that runs locally in under 10 minutes.",
    "R2 Live demo URL that loads without an account.",
    "R3 Named list of exactly three Lagos or Nigeria open-data sources actually used.",
    "R4 Proof that the layout is readable on a phone-width screen. Screenshot or live demo is enough.",
    "R5 The demo view must not require wallet connect.",
  ].join("\n"),
  requirementIds: "R1,R2,R3,R4,R5",
};

export interface SampleBid {
  label: string;
  expected: "RESPONSIVE" | "PARTIAL" | "NON_RESPONSIVE";
  bidId: string;
  summary: string;
  evidenceUri: string;
}

export const SAMPLE_BIDS: SampleBid[] = [
  {
    label: "Bid A",
    expected: "RESPONSIVE",
    bidId: "civic_ok",
    summary:
      "Repo https://github.com/example/lagos-civic-page includes README, Vite app, and a live demo. Sources used: data.lagosstate.gov.ng, grid3.gov.ng, nigerianstat.gov.ng. Demo has no wallet modal. Phone screenshot is in /docs/mobile.png.",
    evidenceUri: EXAMPLE_REPO,
  },
  {
    label: "Bid B",
    expected: "PARTIAL",
    bidId: "civic_half",
    summary:
      "GitHub repo and Vercel demo are live. I still need to add the three data sources and the mobile shot next week.",
    evidenceUri: EXAMPLE_REPO,
  },
  {
    label: "Bid C",
    expected: "NON_RESPONSIVE",
    bidId: "civic_fluff",
    summary:
      "We will deliver a world-class synergistic civic portal leveraging AI, Web3, and community flywheels for next-generation impact across Africa and beyond.",
    evidenceUri: "https://example.com",
  },
];
