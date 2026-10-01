# RfpFit

Sponsors of bounties and grants pay out on whoever writes the best pitch, or on a judge nobody can audit. RfpFit locks a prize in a GenLayer Intelligent Contract against a written brief. Bidders submit a short summary and a public evidence link. After the deadline, GenLayer validators judge whether each bid actually answers the numbered requirements, and the contract pays the best responsive bid or refunds the sponsor. GenLayer is required because "did this bid answer the brief?" is a language question with a money consequence, and neither side trusts the other's server. Remove GenLayer and a website can still rank proposals, but it cannot hold the prize and settle without a trusted operator.

## Live demo

https://rfp-fit.vercel.app/

## Contract

Deployed by the project owner to GenLayer Studionet. Always verify the RPC and chain ID on the official GenLayer network page; networks change.

| | |
|---|---|
| Network | Studionet |
| RPC | `https://studio.genlayer.com/api` |
| Chain ID | `61999` |
| Contract address | [`0x23377D847b0BaD5C918Db79B8Fe2Aeb7fF5F55B9`](https://explorer-studio.genlayer.com/address/0x23377D847b0BaD5C918Db79B8Fe2Aeb7fF5F55B9) |
| Explorer | https://explorer-studio.genlayer.com |
| Create tx (RFP 2) | [`0x5b8cbc11...c8efc5`](https://explorer-studio.genlayer.com/transactions/0x5b8cbc11ebfa9d08c9c9a6533b416e0e746fff24fc358d8d0eaeeea7aec8efc5) |
| Judge tx (RFP 2, RESPONSIVE) | [`0x45e12ff5...1d9689`](https://explorer-studio.genlayer.com/transactions/0x45e12ff50b182f028f8309d9a5ad82595a5a2a21b5cf34242a8dfbad0a1d9689) |
| Finalize tx (RFP 2, paid winner) | [`0x3a45e018...0c0bb1`](https://explorer-studio.genlayer.com/transactions/0x3a45e018577fb1867a5a1c0d4123edcece29e22667c04df41bdaa4adf00c0bb1) |
| Finalize tx (RFP 1, refund) | [`0xb7b47f38...649b07`](https://explorer-studio.genlayer.com/transactions/0xb7b47f38d38106cb2b11c97ca948d4a558d8cb80ab4a71f5a9d19f45e2649b07) |
| Pre-seeded expired RFP id | _pending_ |

### Live test results (Studionet, tiny prizes, throwaway accounts)

- **Pay path (RFP 2):** one bid judged RESPONSIVE 100 by validators, finalize paid 0.01 GEN. The winner's balance rose by exactly 0.01 GEN and the contract balance went to 0.
- **Refund path (RFP 1, the Lagos sample):** `civic_fluff` judged NON-RESPONSIVE (0), `civic_ok` PARTIAL (80), `civic_half` PARTIAL (40). No RESPONSIVE bid, so finalize refunded the sponsor in full. A second finalize was rejected ("RFP is already finalized") and nothing was sent twice.
- **Validator splits:** one `civic_half` judgement ended `MAJORITY_DISAGREE` after 4 rounds and stored nothing. Calling `judge_bid` again succeeded. The UI reports this as a failure with a Retry button.
- **Judge latency:** 30 to 90 seconds per bid on Studionet.
- `civic_ok` was PARTIAL, not RESPONSIVE, because the sample evidence link is a stand-in repo (see below). Use evidence you control for the intended result.

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

- AI variance: validators can disagree (seen live: a borderline bid needed a second `judge_bid` call) on borderline bids; the score tolerance and exact-verdict rule reduce this but do not remove it.
- Evidence fetch can fail; the contract then judges the on-chain summary alone and adds `URI_UNREACHABLE`.
- Test networks only. Not audited. Not legal advice.
- v1 has no partial payouts, no multiple winners, no sealed bids and no appeals.
- Judgement takes minutes; the UI says so instead of pretending to be instant.
- Time comes from the transaction datetime (`gl.message_raw["datetime"]`). The UI countdown uses your browser clock, which can differ from chain time by seconds.
- The payout transfer to a wallet address uses the default message timing, so funds may move at acceptance, before the appeal window ends.
- Contract tests run in the direct runner with mocked LLM/web and a patched non-deterministic path. Real validator consensus and the EOA transfer are only exercised on a live network.

## Roadmap

Later, not built: partial payouts, appeals, sealed bids.
