"""An unreachable evidence URI must never win the escrowed prize.

Rule under test: if a bid submits an evidence URI and the contract cannot fetch it, the verdict
cannot be RESPONSIVE (it is downgraded to PARTIAL with the score capped), validators refuse to
accept a RESPONSIVE verdict unless they can reach the evidence themselves, and finalize re-checks
eligibility at payout time.
"""

import json

import pytest

from test_rfpfit_escrow import AFTER, BID_TEXT, PRIZE, bid, create, env, verdict_json, warp  # noqa: F401

EVIDENCE = "https://github.com/example/x"
PAGE = "<html><body><h1>README</h1><p>Run locally. Live demo at https://x.example</p></body></html>"
RESPONSIVE = verdict_json("RESPONSIVE", 95, ["R1", "R2"], [])


def serve(vm, status, body):
    vm.clear_mocks()
    vm.mock_web(r"https://github\.com/example/x", {"method": "GET", "status": status, "body": body})
    vm.mock_llm(".*", RESPONSIVE)


def judged_bid(env, status, body):
    """Sponsor alice, bidder bob with an evidence URI. Judge it while the page answers (status, body)."""
    c, vm, alice, bob, _ = env
    create(c, vm, alice)
    bid(c, vm, bob, uri=EVIDENCE)
    warp(vm, AFTER)
    serve(vm, status, body)
    return c, vm, json.loads(c.judge_bid("1", "civic_ok"))


@pytest.mark.parametrize(
    "status,body",
    [(503, ""), (404, "Not Found"), (200, ""), (200, "   <script>x()</script>  ")],
    ids=["server-error", "not-found", "empty-body", "no-readable-text"],
)
def test_unreachable_uri_cannot_win_the_escrowed_prize(env, status, body):
    c, vm, verdict = judged_bid(env, status, body)

    # The model said RESPONSIVE 95, but the evidence was never read.
    assert verdict["verdict"] == "PARTIAL"
    assert verdict["score"] <= 60
    assert verdict["evidence_used"] == "ONCHAIN_SUMMARY"
    assert "URI_UNREACHABLE" in verdict["risk_flags"]
    assert verdict["requirements_met"] == []
    assert set(verdict["requirements_unclear"]) == {"R1", "R2"}

    # And it does not win: the sponsor is refunded and nothing is paid.
    receipt = json.loads(c.finalize("1"))
    assert receipt["action"] == "REFUND_SPONSOR"
    assert receipt["bid_id"] == ""
    rfp = json.loads(c.get_rfp("1"))
    assert rfp["status"] == "REFUNDED" and rfp["winner_bid_id"] == "" and rfp["winner_address"] == ""
    stats = json.loads(c.get_stats())
    assert stats["total_paid"] == "0" and stats["total_refunded"] == str(PRIZE)


def test_reachable_uri_can_still_win(env):
    c, vm, verdict = judged_bid(env, 200, PAGE)
    assert verdict["verdict"] == "RESPONSIVE"
    assert verdict["evidence_used"] == "BOTH"
    assert "URI_UNREACHABLE" not in verdict["risk_flags"]
    receipt = json.loads(c.finalize("1"))
    assert receipt["action"] == "PAY_WINNER" and receipt["bid_id"] == "civic_ok"


def test_summary_only_bid_without_a_uri_is_unchanged(env):
    c, vm, alice, bob, _ = env
    create(c, vm, alice)
    bid(c, vm, bob)  # no evidence URI submitted, so there is nothing to be unreachable
    warp(vm, AFTER)
    serve(vm, 503, "")
    assert json.loads(c.judge_bid("1", "civic_ok"))["verdict"] == "RESPONSIVE"
    assert json.loads(c.finalize("1"))["action"] == "PAY_WINNER"


def test_unreachable_responsive_loses_to_a_reachable_one(env):
    """A higher-scoring unverified bid must not outrank a verified RESPONSIVE bid."""
    c, vm, alice, bob, charlie = env
    create(c, vm, alice)
    bid(c, vm, bob, "aa_unreachable", uri="https://gone.example/x")
    bid(c, vm, charlie, "zz_verified", uri=EVIDENCE)
    warp(vm, AFTER)

    vm.clear_mocks()
    vm.mock_web(r"https://gone\.example/x", {"method": "GET", "status": 500, "body": ""})
    vm.mock_llm(".*", verdict_json("RESPONSIVE", 99, ["R1", "R2"], []))
    c.judge_bid("1", "aa_unreachable")

    vm.clear_mocks()
    vm.mock_web(r"https://github\.com/example/x", {"method": "GET", "status": 200, "body": PAGE})
    vm.mock_llm(".*", verdict_json("RESPONSIVE", 70, ["R1", "R2"], []))
    c.judge_bid("1", "zz_verified")

    assert json.loads(c.get_verdict("1", "aa_unreachable"))["verdict"] == "PARTIAL"
    assert json.loads(c.finalize("1"))["bid_id"] == "zz_verified"


# ---- validator acceptance ---------------------------------------------------------------------


def test_validator_accepts_a_reachable_responsive_verdict(env):
    c, vm, verdict = judged_bid(env, 200, PAGE)
    assert verdict["verdict"] == "RESPONSIVE"
    assert vm.run_validator() is True


def test_validator_rejects_responsive_when_it_cannot_reach_the_evidence(env):
    c, vm, verdict = judged_bid(env, 200, PAGE)
    assert verdict["verdict"] == "RESPONSIVE"
    serve(vm, 503, "")  # this validator's view of the page: unreachable
    assert vm.run_validator() is False


def test_validator_rejects_a_leader_claiming_responsive_without_reading_the_evidence(env):
    c, vm, verdict = judged_bid(env, 503, "")
    forged = dict(RESPONSIVE_RESULT, evidence_used="ONCHAIN_SUMMARY")
    # Whatever this validator sees, a RESPONSIVE verdict with unread evidence is refused.
    serve(vm, 503, "")
    assert vm.run_validator(leader_result=forged) is False
    serve(vm, 200, PAGE)
    assert vm.run_validator(leader_result=forged) is False


def test_validator_accepts_a_matching_unverified_downgrade(env):
    c, vm, verdict = judged_bid(env, 503, "")
    assert vm.run_validator() is True  # both sides downgrade identically


RESPONSIVE_RESULT = {
    "verdict": "RESPONSIVE",
    "score": 95,
    "requirements_met": ["R1", "R2"],
    "requirements_missing": [],
    "requirements_unclear": [],
    "evidence_used": "BOTH",
    "reasons": ["R1 evidenced"],
    "risk_flags": [],
    "confidence": "HIGH",
}


# ---- payout-time defense ------------------------------------------------------------------------


def test_finalize_refuses_a_stored_responsive_verdict_with_unread_evidence(env):
    """Even if a RESPONSIVE verdict somehow sits in storage without verified evidence, it cannot be paid."""
    c, vm, alice, bob, _ = env
    create(c, vm, alice)
    bid(c, vm, bob, uri=EVIDENCE)
    warp(vm, AFTER)

    forged = dict(RESPONSIVE_RESULT, evidence_used="ONCHAIN_SUMMARY")
    c.verdicts["1:civic_ok"] = json.dumps(forged)
    rfp = json.loads(c.rfps["1"])
    rfp["judged_count"] = 1
    c.rfps["1"] = json.dumps(rfp)

    receipt = json.loads(c.finalize("1"))
    assert receipt["action"] == "REFUND_SPONSOR"
    assert json.loads(c.get_stats())["total_paid"] == "0"
