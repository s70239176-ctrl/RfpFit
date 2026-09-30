# RfpFit

Sponsors of bounties and grants pay out on whoever writes the best pitch, or on a judge nobody can audit. RfpFit locks a prize in a GenLayer Intelligent Contract against a written brief. Bidders submit a short summary and a public evidence link. After the deadline, GenLayer validators judge whether each bid actually answers the numbered requirements, and the contract pays the best responsive bid or refunds the sponsor. GenLayer is required because "did this bid answer the brief?" is a language question with a money consequence, and neither side trusts the other's server. Remove GenLayer and a website can still rank proposals, but it cannot hold the prize and settle without a trusted operator.

## Live demo

**Not deployed yet.** Set after Phase 6 (Vercel URL goes here).

## Contract

**Not deployed yet.** Fill in after deploying `contracts/rfpfit_escrow.py`. Always verify the RPC and chain ID on the official GenLayer network page before deploying; networks change.

| | |
|---|---|
| Network | _pending_ |
| RPC | _pending_ |
| Chain ID | _pending_ |
| Contract address | _pending_ |
| Explorer | _pending_ |
| Create tx | _pending_ |
| Judge tx | _pending_ |
| Finalize tx | _pending_ |
| Pre-seeded expired RFP id | _pending_ |

## How it works

1. Sponsor locks the prize (native GEN, sent with `create_rfp`) and freezes a rubric of requirement IDs (`R1`, `R2`, ...).
2. Bidders submit a summary plus an https evidence link.
3. After the deadline, anyone requests judgement for a bid.
4. The contract stores a structured verdict: `RESPONSIVE`, `PARTIAL` or `NON_RESPONSIVE`, with a 0-100 score, met/missing requirement IDs and reasons.
5. Anyone finalizes once every bid is judged. The highest-scoring `RESPONSIVE` bid is paid (ties go to the lowest bid ID). If none is responsive, or there were no bids, the sponsor is refunded.

Settlement rules, limits and the verdict schema are enforced in the contract. `PARTIAL` bids are shown but never paid in v1.

## Why the UI is not the judge

The frontend only reads contract state and sends transactions you sign. It never computes a winner, never posts a verdict, and holds no keys or funds. Every verdict, score and payout you see is read back from the contract after each write. If the UI disappeared, the contract would still hold the prize and anyone could judge and finalize from another client.

## Stack

Next.js (App Router) and Tailwind, one Python Intelligent Contract, GenLayerJS, no backend.

Consensus: each `judge_bid` runs `gl.vm.run_nondet_unsafe`. The leader fetches the evidence link (falling back to the on-chain summary if it fails) and asks an LLM for JSON; each validator repeats that and must agree on the verdict exactly, with scores within 5 points. Free-text reasons are not compared. Model output that breaks the schema fails the transaction instead of being stored.

## Run locally

Requirements: Node 20+, Python 3.12+.

```bash
cd frontend
cp .env.example .env.local     # fill in RPC, chain ID, contract address
npm install
npm run dev                    # http://localhost:3000
npm run build
```

Contract tests (mocked LLM and web, direct runner from `genlayer-test`):

```bash
pip install genlayer-test pytest
python -m pytest contracts -q
```

On Windows, `contracts/conftest.py` works around a temp-file bug in the direct runner. The runner also downloads the GenLayer SDK from GitHub on first use.

## Demo evidence

Sample pack (labelled SAMPLE in the UI; it only fills forms and never submits anything).

**RFP:** Lagos Civic Data Landing Page. Build a public page that helps a resident find three working Lagos open-data sources. No wallet required to read the page.

- R1 Public GitHub repository with a README that runs locally in under 10 minutes.
- R2 Live demo URL that loads without an account.
- R3 Named list of exactly three Lagos or Nigeria open-data sources actually used.
- R4 Proof that the layout is readable on a phone-width screen. Screenshot or live demo is enough.
- R5 The demo view must not require wallet connect.

| Bid | Expected | Summary |
|---|---|---|
| `civic_ok` | RESPONSIVE | Repo includes README, Vite app, and a live demo. Sources used: data.lagosstate.gov.ng, grid3.gov.ng, nigerianstat.gov.ng. Demo has no wallet modal. Phone screenshot is in /docs/mobile.png. |
| `civic_half` | PARTIAL | GitHub repo and Vercel demo are live. I still need to add the three data sources and the mobile shot next week. |
| `civic_fluff` | NON_RESPONSIVE | We will deliver a world-class synergistic civic portal leveraging AI, Web3, and community flywheels for next-generation impact across Africa and beyond. |

Refund fixture: create a tiny second RFP, submit only `civic_fluff`, judge it, finalize, and the sponsor is refunded.

The sample bids point at `https://github.com/vitejs/vite` (and `https://example.com` for the fluff bid) as stand-in evidence, because no Lagos demo is hosted. That repo does not contain the claimed Lagos page, so with a fetched page the model may rate `civic_ok` lower than RESPONSIVE. Replace the URI in `frontend/lib/sample-data.ts` with a repo you control for the intended result.

## Known limitations

- AI variance: validators can disagree on borderline bids; the score tolerance and exact-verdict rule reduce this but do not remove it.
- Evidence fetch can fail; the contract then judges the on-chain summary alone and adds `URI_UNREACHABLE`.
- Test networks only. Not audited. Not legal advice.
- v1 has no partial payouts, no multiple winners, no sealed bids and no appeals.
- Judgement takes minutes; the UI says so instead of pretending to be instant.
- Time comes from the transaction datetime (`gl.message_raw["datetime"]`). The UI countdown uses your browser clock, which can differ from chain time by seconds.
- Payout uses a finalized-only transfer (`on="finalized"`), so funds arrive after the appeal window, not at acceptance.
- Contract tests run in the direct runner with mocked LLM/web and a patched non-deterministic path. Real validator consensus and the EOA transfer are only exercised on a live network.

## Roadmap

Later, not built: partial payouts, appeals, sealed bids.
