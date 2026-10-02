# Demo script

Total time: about 10 minutes, most of it judgement latency. Use the pre-seeded expired RFP so nobody waits on stage.

1. Open the live app. Point at the escrow chip and say: the prize is in the contract, not on a server.
2. Open a live RFP, or create one with the sample brief (Create an RFP, "Fill form with sample brief") and a small GEN amount. Set the deadline a few minutes out.
3. On that RFP, submit Bid C (`civic_fluff`). Wait for the confirmed panel.
4. Submit Bid A (`civic_ok`). Wait for the confirmed panel.
5. The deadline for a fresh RFP is in the future, so switch to the pre-seeded expired brief, #1 (the Lagos sample, listed in the README). Its three bids are already in and unjudged, so you can go straight to judgement.
6. Request judgement on Bid C. Say validators are reviewing the evidence and it takes a few minutes. When it completes, show the NON-RESPONSIVE card. Refresh the page to show it is read from the contract, not local state.
7. Request judgement on Bid A (`civic_ok`). Its evidence link is a stand-in, so expect PARTIAL, not RESPONSIVE. Select the bid to show met / missing marks on the rubric. Open "Raw verdict" to show the stored JSON.
8. Open brief #2 to show a finished payout: a RESPONSIVE bid, the Winner marker, the PAID status and the explorer link for the recipient.
9. Back on brief #1, Finalize once every bid is judged. With no RESPONSIVE bid the sponsor is refunded. Open the README contract section and point at the contract address and the create, judge and finalize transactions.

Refund and safety paths, already settled: brief #3 (only a generic bid, refunded) and brief #4 (the evidence link does not exist, so the bid is flagged unreachable and cannot be paid).

Brief #1 on the deployed contract is the pre-seeded expired RFP. Briefs #2 to #4 are already settled (pay, refund, unreachable evidence refunded) if you want finished examples.
