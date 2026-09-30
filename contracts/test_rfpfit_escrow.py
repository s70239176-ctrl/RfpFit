"""Direct-mode tests (genlayer-test). Run: python -m pytest contracts -q

LLM and web calls are mocked, so these cover contract logic: validation,
lifecycle, tie-break, refund, idempotent finalize. Real validator consensus
is exercised on Studio (see README).
"""

import json
import sys
from pathlib import Path

import pytest

CONTRACT = str(Path(__file__).parent / "rfpfit_escrow.py")
T0 = "2030-01-01T00:00:00Z"
DEADLINE = 1893456000 + 86400  # 2030-01-02T00:00:00Z
AFTER = "2030-01-03T00:00:00Z"
PRIZE = 10**18
REQ = "R1 Public repo with README. R2 Live demo URL that loads without an account."
BID_TEXT = "Repo https://github.com/example/x has a README and a live demo at https://x.example."


def warp(vm, iso):
    # vm.warp() does not refresh gl.message_raw["datetime"], which the contract reads.
    vm.warp(iso)
    sys.modules["genlayer.gl"].message_raw["datetime"] = iso


def verdict_json(verdict, score, met, missing):
    return json.dumps(
        {
            "verdict": verdict,
            "score": score,
            "requirements_met": met,
            "requirements_missing": missing,
            "requirements_unclear": [],
            "evidence_used": "ONCHAIN_SUMMARY",
            "reasons": ["R1 evidenced"],
            "risk_flags": [],
            "confidence": "HIGH",
        }
    )


@pytest.fixture
def env(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c = direct_deploy(CONTRACT)
    warp(direct_vm, T0)
    return c, direct_vm, direct_alice, direct_bob, direct_charlie


def create(c, vm, sponsor, value=PRIZE, ids="R1,R2", deadline=DEADLINE):
    vm.sender = sponsor
    vm.value = value
    vm.deal(vm._contract_address, value)
    try:
        return c.create_rfp("Civic page", "A public page for three open-data sources.", REQ, ids, deadline)
    finally:
        vm.value = 0


def bid(c, vm, who, bid_id="civic_ok", text=BID_TEXT, uri=""):
    vm.sender = who
    return c.submit_bid("1", bid_id, text, uri)


def test_create_rejections(env):
    c, vm, alice, *_ = env
    with vm.expect_revert("prize"):
        create(c, vm, alice, value=0)
    with vm.expect_revert("2..8"):
        create(c, vm, alice, ids="R1")
    with vm.expect_revert("R3"):
        create(c, vm, alice, ids="R1,R3")
    with vm.expect_revert("future"):
        create(c, vm, alice, deadline=1)


def test_create_tracks_prize_and_bidding_rules(env):
    c, vm, alice, bob, _ = env
    assert create(c, vm, alice) == "1"
    rfp = json.loads(c.get_rfp("1"))
    assert rfp["prize_wei"] == str(PRIZE) and rfp["status"] == "OPEN"
    with vm.expect_revert("unknown RFP"):
        c.submit_bid("9", "abc", BID_TEXT, "")
    bid(c, vm, bob)
    with vm.expect_revert("already used"):
        bid(c, vm, bob)
    with vm.expect_revert("https"):
        bid(c, vm, bob, bid_id="other", uri="http://x.example")
    warp(vm, AFTER)
    with vm.expect_revert("closed"):
        bid(c, vm, bob, bid_id="late")


def test_judge_guards(env):
    c, vm, alice, bob, _ = env
    create(c, vm, alice)
    bid(c, vm, bob)
    with vm.expect_revert("after the deadline"):
        c.judge_bid("1", "civic_ok")
    warp(vm, AFTER)
    vm.mock_llm(".*", verdict_json("RESPONSIVE", 90, ["R1", "R2"], []))
    out = json.loads(c.judge_bid("1", "civic_ok"))
    assert out["verdict"] == "RESPONSIVE"
    assert json.loads(c.get_verdict("1", "civic_ok")) == out
    with vm.expect_revert("already judged"):
        c.judge_bid("1", "civic_ok")


def test_finalize_pays_winner_with_tiebreak_and_is_idempotent(env):
    c, vm, alice, bob, charlie = env
    create(c, vm, alice)
    bid(c, vm, charlie, "zz_bid")
    bid(c, vm, bob, "aa_bid")
    bid(c, vm, bob, "mm_partial")
    warp(vm, AFTER)
    with vm.expect_revert("every bid must be judged"):
        c.finalize("1")
    for bid_id, v in (
        ("zz_bid", verdict_json("RESPONSIVE", 91, ["R1", "R2"], [])),
        ("aa_bid", verdict_json("RESPONSIVE", 91, ["R1", "R2"], [])),
        ("mm_partial", verdict_json("PARTIAL", 80, ["R1"], ["R2"])),
    ):
        vm.clear_mocks()
        vm.mock_llm(".*", v)
        c.judge_bid("1", bid_id)
    receipt = json.loads(c.finalize("1"))
    assert receipt["action"] == "PAY_WINNER" and receipt["bid_id"] == "aa_bid"
    assert receipt["amount_wei"] == str(PRIZE)
    rfp = json.loads(c.get_rfp("1"))
    assert rfp["status"] == "FINALIZED" and rfp["winner_bid_id"] == "aa_bid"
    with vm.expect_revert("already finalized"):
        c.finalize("1")
    assert json.loads(c.get_stats())["total_paid"] == str(PRIZE)


def test_refund_when_no_responsive_bid(env):
    c, vm, alice, bob, _ = env
    create(c, vm, alice)
    bid(c, vm, bob, "civic_fluff", "We will deliver a world-class synergistic civic portal leveraging AI.")
    warp(vm, AFTER)
    vm.mock_llm(".*", verdict_json("NON_RESPONSIVE", 5, [], ["R1", "R2"]))
    assert json.loads(c.judge_bid("1", "civic_fluff"))["verdict"] == "NON_RESPONSIVE"
    receipt = json.loads(c.finalize("1"))
    assert receipt["action"] == "REFUND_SPONSOR"
    assert json.loads(c.get_rfp("1"))["status"] == "REFUNDED"
    assert json.loads(c.get_stats())["total_refunded"] == str(PRIZE)


def test_zero_bids_refund(env):
    c, vm, alice, *_ = env
    create(c, vm, alice)
    with vm.expect_revert("after the deadline"):
        c.finalize("1")
    warp(vm, AFTER)
    assert json.loads(c.finalize("1"))["action"] == "REFUND_SPONSOR"


def test_unusable_model_output_fails_instead_of_storing_garbage(env):
    c, vm, alice, bob, _ = env
    create(c, vm, alice)
    bid(c, vm, bob)
    warp(vm, AFTER)
    vm.mock_llm(".*", json.dumps({"verdict": "GREAT", "score": 500}))
    with vm.expect_revert():
        c.judge_bid("1", "civic_ok")
    assert c.get_verdict("1", "civic_ok") == ""
