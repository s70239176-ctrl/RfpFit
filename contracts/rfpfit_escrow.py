# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""RfpFit escrow.

A sponsor locks native GEN against a written brief. Bidders submit a short
summary plus an https evidence URI. After the deadline, validators judge each
bid against the frozen requirement IDs and the contract pays the best
RESPONSIVE bid, or refunds the sponsor. Nothing outside this contract decides
a verdict or moves money.

Syntax confirmed against docs.genlayer.com (value-transfers, calling-llms,
non-determinism, web-access):
  - @gl.public.write.payable + gl.message.value (u256)
  - gl.vm.run_nondet_unsafe(leader_fn, validator_fn) with gl.vm.Return
  - gl.nondet.exec_prompt(prompt, response_format="json")
  - gl.nondet.web.get(url) -> .status_code / .body
  - EOA payout via @gl.evm.contract_interface _Recipient(...).emit_transfer
  - time from gl.message_raw["datetime"] (ISO-8601, consensus-deterministic)
"""

from genlayer import *
import datetime
import json
import re

_STATUS_OPEN = "OPEN"
_STATUS_CLOSED = "CLOSED_FOR_BIDS"
_STATUS_FINALIZED = "FINALIZED"
_STATUS_REFUNDED = "REFUNDED"

_VERDICTS = ("RESPONSIVE", "PARTIAL", "NON_RESPONSIVE")
_CONFIDENCE = ("LOW", "MEDIUM", "HIGH")
_RISK_FLAGS = (
    "GENERIC_FLUFF",
    "URI_UNREACHABLE",
    "URI_IRRELEVANT",
    "SPONSOR_IS_BIDDER",
    "COPYPASTA",
    "OVERCLAIM",
    "EMPTY_EVIDENCE",
)

_MAX_BIDS = 8
_LATEST = 20
_SCORE_TOLERANCE = 5

_REQ_ID = re.compile(r"^R[1-9][0-9]?$")
_BID_ID = re.compile(r"^[A-Za-z0-9_]{3,32}$")


@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass


def _hex(addr: Address) -> str:
    raw = getattr(addr, "as_hex", None)
    if isinstance(raw, str) and raw:
        return raw
    return str(addr)


def _now() -> int:
    raw = str(gl.message_raw["datetime"])
    return int(datetime.datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp())


def _load(raw: str) -> dict:
    return json.loads(raw)


def _dump(obj: dict) -> str:
    return json.dumps(obj, separators=(",", ":"))


def _key(rfp_id: str, bid_id: str) -> str:
    return rfp_id + ":" + bid_id


def _mentions(text: str, ident: str) -> bool:
    return re.search(r"(?<![A-Za-z0-9])" + ident + r"(?![A-Za-z0-9])", text) is not None


def _strip_markup(html: str) -> str:
    html = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?s)<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", html).strip()


def _fetch_evidence(url: str) -> str:
    """Best-effort page text. Returns "" on any failure; never raises."""
    try:
        res = gl.nondet.web.get(url)
        status = getattr(res, "status_code", 200)
        if isinstance(status, int) and status >= 400:
            return ""
        body = getattr(res, "body", res)
        if isinstance(body, bytes):
            body = body.decode("utf-8", "replace")
        return _strip_markup(str(body))[:6000]
    except Exception:
        return ""


def _id_list(raw: object, allowed: list, field: str) -> list:
    if not isinstance(raw, list):
        raise gl.vm.UserError(field + " must be a list")
    out = []
    for item in raw:
        ident = str(item).strip()
        if ident not in allowed:
            raise gl.vm.UserError(field + " contains an unknown requirement id")
        if ident not in out:
            out.append(ident)
    return out


def _normalize(raw: object, req_ids: list) -> dict:
    """Validate a model verdict against the locked schema, or raise."""
    if not isinstance(raw, dict):
        raise gl.vm.UserError("model did not return a JSON object")
    verdict = str(raw.get("verdict", "")).strip()
    if verdict not in _VERDICTS:
        raise gl.vm.UserError("illegal verdict")
    score_raw = raw.get("score")
    if isinstance(score_raw, bool):
        raise gl.vm.UserError("score must be an integer")
    try:
        score = int(score_raw)
    except (TypeError, ValueError):
        raise gl.vm.UserError("score must be an integer")
    if score < 0 or score > 100:
        raise gl.vm.UserError("score out of range")
    met = _id_list(raw.get("requirements_met", []), req_ids, "requirements_met")
    missing = _id_list(raw.get("requirements_missing", []), req_ids, "requirements_missing")
    unclear = _id_list(raw.get("requirements_unclear", []), req_ids, "requirements_unclear")
    if verdict == "RESPONSIVE" and (missing or unclear or not met):
        raise gl.vm.UserError("RESPONSIVE requires every requirement met")
    if verdict == "PARTIAL" and (not met or not missing):
        raise gl.vm.UserError("PARTIAL requires at least one met and one missing")
    reasons_raw = raw.get("reasons", [])
    if not isinstance(reasons_raw, list):
        raise gl.vm.UserError("reasons must be a list")
    reasons = [str(r).strip()[:160] for r in reasons_raw if str(r).strip()][:3]
    flags_raw = raw.get("risk_flags", [])
    if not isinstance(flags_raw, list):
        raise gl.vm.UserError("risk_flags must be a list")
    flags = []
    for f in flags_raw:
        f = str(f).strip()
        if f in _RISK_FLAGS and f not in flags:
            flags.append(f)
    confidence = str(raw.get("confidence", "")).strip()
    if confidence not in _CONFIDENCE:
        raise gl.vm.UserError("illegal confidence")
    return {
        "verdict": verdict,
        "score": score,
        "requirements_met": met,
        "requirements_missing": missing,
        "requirements_unclear": unclear,
        "evidence_used": "ONCHAIN_SUMMARY",
        "reasons": reasons,
        "risk_flags": flags,
        "confidence": confidence,
    }


_PROMPT = """You are an impartial GenLayer validator scoring bid responsiveness against a frozen RFP rubric.

Use ONLY the requirement IDs supplied.
Do not invent requirements.
Do not score writing style, enthusiasm, or future promises unless a requirement explicitly asks for them.
If the evidence URI cannot be fetched or is irrelevant, judge the on-chain summary only.
A mandatory requirement with no evidence is missing.

RFP title:
{title}

RFP summary:
{summary}

Requirements text:
{requirements_text}

Requirement IDs:
{requirement_ids}

Bid summary:
{bid_summary}

Evidence URI:
{evidence_uri}

Fetched evidence page text (empty if unavailable):
{evidence_text}

Return valid JSON only with keys:
verdict, score, requirements_met, requirements_missing, requirements_unclear,
evidence_used, reasons, risk_flags, confidence

Rules:
- RESPONSIVE: every mandatory requirement is met with evidence.
- PARTIAL: at least one met and at least one missing.
- NON_RESPONSIVE: none met, or generic fluff, or nothing assessable.
- score integer 0-100.
- reasons: max 3, cite IDs.
- risk_flags from the allowed list only: GENERIC_FLUFF, URI_UNREACHABLE, URI_IRRELEVANT, SPONSOR_IS_BIDDER, COPYPASTA, OVERCLAIM, EMPTY_EVIDENCE
- evidence_used: ONCHAIN_SUMMARY, URI, or BOTH
- confidence: LOW, MEDIUM, or HIGH
"""


class RfpFitEscrow(gl.Contract):
    next_rfp_id: u256
    rfps: TreeMap[str, str]
    bids: TreeMap[str, str]
    verdicts: TreeMap[str, str]
    bid_index: TreeMap[str, str]
    total_bids: u256
    total_judged: u256
    total_paid: u256
    total_refunded: u256

    def __init__(self) -> None:
        self.next_rfp_id = u256(1)
        self.total_bids = u256(0)
        self.total_judged = u256(0)
        self.total_paid = u256(0)
        self.total_refunded = u256(0)

    # ---------------------------------------------------------------- writes

    @gl.public.write.payable
    def create_rfp(
        self,
        title: str,
        summary: str,
        requirements_text: str,
        requirement_ids_csv: str,
        deadline_ts: u256,
    ) -> str:
        value = int(gl.message.value)
        if value <= 0:
            raise gl.vm.UserError("a prize must be sent with create_rfp")
        title = title.strip()
        summary = summary.strip()
        requirements_text = requirements_text.strip()
        if not 3 <= len(title) <= 80:
            raise gl.vm.UserError("title must be 3..80 chars")
        if not 20 <= len(summary) <= 800:
            raise gl.vm.UserError("summary must be 20..800 chars")
        if not 40 <= len(requirements_text) <= 4000:
            raise gl.vm.UserError("requirements_text must be 40..4000 chars")

        req_ids = [p.strip() for p in requirement_ids_csv.split(",") if p.strip()]
        if not 2 <= len(req_ids) <= 8:
            raise gl.vm.UserError("provide 2..8 requirement ids")
        seen = []
        for ident in req_ids:
            if not _REQ_ID.match(ident):
                raise gl.vm.UserError("requirement ids look like R1, R2, ... R99")
            if ident in seen:
                raise gl.vm.UserError("duplicate requirement id " + ident)
            if not _mentions(requirements_text, ident):
                raise gl.vm.UserError(ident + " does not appear in requirements_text")
            seen.append(ident)

        now = _now()
        deadline = int(deadline_ts)
        if deadline <= now:
            raise gl.vm.UserError("deadline must be in the future")

        rfp_id = str(int(self.next_rfp_id))
        self.next_rfp_id = u256(int(self.next_rfp_id) + 1)
        self.rfps[rfp_id] = _dump(
            {
                "id": rfp_id,
                "sponsor": _hex(gl.message.sender_address),
                "title": title,
                "summary": summary,
                "requirements_text": requirements_text,
                "requirement_ids": req_ids,
                "deadline_ts": deadline,
                "prize_wei": str(value),
                "status": _STATUS_OPEN,
                "bid_count": 0,
                "judged_count": 0,
                "winner_bid_id": "",
                "winner_address": "",
                "finalized": False,
                "created_ts": now,
            }
        )
        self.bid_index[rfp_id] = "[]"
        return rfp_id

    @gl.public.write
    def submit_bid(self, rfp_id: str, bid_id: str, summary: str, evidence_uri: str) -> str:
        rfp = self._rfp(rfp_id)
        now = _now()
        if rfp["status"] != _STATUS_OPEN or now >= rfp["deadline_ts"]:
            raise gl.vm.UserError("bidding is closed for this RFP")
        if not _BID_ID.match(bid_id):
            raise gl.vm.UserError("bid_id must be 3..32 chars, letters, digits, underscore")
        summary = summary.strip()
        if not 40 <= len(summary) <= 2000:
            raise gl.vm.UserError("bid summary must be 40..2000 chars")
        evidence_uri = evidence_uri.strip()
        if len(evidence_uri) > 300:
            raise gl.vm.UserError("evidence_uri must be at most 300 chars")
        if evidence_uri and not evidence_uri.startswith("https://"):
            raise gl.vm.UserError("evidence_uri must start with https://")
        key = _key(rfp_id, bid_id)
        if key in self.bids:
            raise gl.vm.UserError("bid_id already used for this RFP")
        if rfp["bid_count"] >= _MAX_BIDS:
            raise gl.vm.UserError("this RFP already has the maximum of 8 bids")

        self.bids[key] = _dump(
            {
                "rfp_id": rfp_id,
                "bid_id": bid_id,
                "bidder": _hex(gl.message.sender_address),
                "summary": summary,
                "evidence_uri": evidence_uri,
                "created_ts": now,
            }
        )
        ids = _load(self.bid_index[rfp_id])
        ids.append(bid_id)
        self.bid_index[rfp_id] = _dump_list(ids)
        rfp["bid_count"] = len(ids)
        self.rfps[rfp_id] = _dump(rfp)
        self.total_bids = u256(int(self.total_bids) + 1)
        return bid_id

    @gl.public.write
    def close_if_expired(self, rfp_id: str) -> str:
        rfp = self._rfp(rfp_id)
        if rfp["status"] == _STATUS_OPEN and _now() >= rfp["deadline_ts"]:
            rfp["status"] = _STATUS_CLOSED
            self.rfps[rfp_id] = _dump(rfp)
        return rfp["status"]

    @gl.public.write
    def judge_bid(self, rfp_id: str, bid_id: str) -> str:
        rfp = self._rfp(rfp_id)
        if _now() < rfp["deadline_ts"]:
            raise gl.vm.UserError("judgement opens after the deadline")
        if rfp["finalized"]:
            raise gl.vm.UserError("RFP is already finalized")
        key = _key(rfp_id, bid_id)
        if key not in self.bids:
            raise gl.vm.UserError("unknown bid")
        if key in self.verdicts:
            raise gl.vm.UserError("bid already judged")
        bid = _load(self.bids[key])

        # Copy everything out of storage: the nondet block cannot read it.
        title = rfp["title"]
        rfp_summary = rfp["summary"]
        requirements_text = rfp["requirements_text"]
        req_ids = list(rfp["requirement_ids"])
        bid_summary = bid["summary"]
        uri = bid["evidence_uri"]

        def evaluate() -> dict:
            page = _fetch_evidence(uri) if uri else ""
            prompt = _PROMPT.format(
                title=title,
                summary=rfp_summary,
                requirements_text=requirements_text,
                requirement_ids=", ".join(req_ids),
                bid_summary=bid_summary,
                evidence_uri=uri if uri else "NONE",
                evidence_text=page if page else "(none)",
            )
            last = "model output unusable"
            for _ in range(2):
                raw = gl.nondet.exec_prompt(prompt, response_format="json")
                if isinstance(raw, str):
                    try:
                        raw = json.loads(raw)
                    except ValueError:
                        last = "model output was not JSON"
                        continue
                try:
                    verdict = _normalize(raw, req_ids)
                except gl.vm.UserError as exc:
                    last = str(exc)
                    continue
                if uri and page:
                    verdict["evidence_used"] = "BOTH"
                else:
                    verdict["evidence_used"] = "ONCHAIN_SUMMARY"
                    if uri and "URI_UNREACHABLE" not in verdict["risk_flags"]:
                        verdict["risk_flags"].append("URI_UNREACHABLE")
                return verdict
            raise gl.vm.UserError("judgement failed: " + last)

        def leader_fn() -> dict:
            return evaluate()

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            lead = leader_result.calldata
            try:
                _normalize(lead, req_ids)
                mine = evaluate()
            except Exception:
                return False
            if lead["verdict"] != mine["verdict"]:
                return False
            return abs(int(lead["score"]) - int(mine["score"])) <= _SCORE_TOLERANCE

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        verdict = _normalize(result, req_ids)
        # Evidence provenance is not part of consensus; carry the leader's value.
        used = str(result.get("evidence_used", "ONCHAIN_SUMMARY"))
        verdict["evidence_used"] = used if used in ("ONCHAIN_SUMMARY", "URI", "BOTH") else "ONCHAIN_SUMMARY"
        if "URI_UNREACHABLE" in result.get("risk_flags", []) and "URI_UNREACHABLE" not in verdict["risk_flags"]:
            verdict["risk_flags"].append("URI_UNREACHABLE")
        if bid["bidder"].lower() == rfp["sponsor"].lower() and "SPONSOR_IS_BIDDER" not in verdict["risk_flags"]:
            verdict["risk_flags"].append("SPONSOR_IS_BIDDER")

        stored = _dump(verdict)
        self.verdicts[key] = stored
        if rfp["status"] == _STATUS_OPEN:
            rfp["status"] = _STATUS_CLOSED
        rfp["judged_count"] = rfp["judged_count"] + 1
        self.rfps[rfp_id] = _dump(rfp)
        self.total_judged = u256(int(self.total_judged) + 1)
        return stored

    @gl.public.write
    def finalize(self, rfp_id: str) -> str:
        rfp = self._rfp(rfp_id)
        if rfp["finalized"]:
            raise gl.vm.UserError("RFP is already finalized")
        if _now() < rfp["deadline_ts"]:
            raise gl.vm.UserError("finalize opens after the deadline")
        if rfp["judged_count"] != rfp["bid_count"]:
            raise gl.vm.UserError("every bid must be judged before finalize")

        winner_bid = ""
        winner_addr = ""
        best = -1
        for bid_id in sorted(_load(self.bid_index[rfp_id])):
            verdict = _load(self.verdicts[_key(rfp_id, bid_id)])
            if verdict["verdict"] == "RESPONSIVE" and verdict["score"] > best:
                best = verdict["score"]
                winner_bid = bid_id
        prize = int(rfp["prize_wei"])
        if int(self.balance) < prize:
            raise gl.vm.UserError("contract balance is below the escrowed prize")

        # Effects before the transfer: a second call reverts on `finalized`.
        if winner_bid:
            winner_addr = _load(self.bids[_key(rfp_id, winner_bid)])["bidder"]
            recipient = winner_addr
            action = "PAY_WINNER"
            rfp["status"] = _STATUS_FINALIZED
            rfp["winner_bid_id"] = winner_bid
            rfp["winner_address"] = winner_addr
            self.total_paid = u256(int(self.total_paid) + prize)
        else:
            recipient = rfp["sponsor"]
            action = "REFUND_SPONSOR"
            rfp["status"] = _STATUS_REFUNDED
            self.total_refunded = u256(int(self.total_refunded) + prize)
        rfp["finalized"] = True
        self.rfps[rfp_id] = _dump(rfp)

        _Recipient(Address(recipient)).emit_transfer(value=u256(prize))
        return _dump(
            {
                "action": action,
                "recipient": recipient,
                "amount_wei": str(prize),
                "bid_id": winner_bid,
            }
        )

    # ----------------------------------------------------------------- views

    @gl.public.view
    def get_rfp(self, rfp_id: str) -> str:
        return self.rfps[rfp_id] if rfp_id in self.rfps else ""

    @gl.public.view
    def get_bid(self, rfp_id: str, bid_id: str) -> str:
        key = _key(rfp_id, bid_id)
        return self.bids[key] if key in self.bids else ""

    @gl.public.view
    def get_verdict(self, rfp_id: str, bid_id: str) -> str:
        key = _key(rfp_id, bid_id)
        return self.verdicts[key] if key in self.verdicts else ""

    @gl.public.view
    def get_bid_ids(self, rfp_id: str) -> str:
        return self.bid_index[rfp_id] if rfp_id in self.bid_index else "[]"

    @gl.public.view
    def get_latest_rfp_ids(self) -> str:
        last = int(self.next_rfp_id) - 1
        first = max(1, last - _LATEST + 1)
        return _dump_list([str(i) for i in range(last, first - 1, -1)])

    @gl.public.view
    def get_stats(self) -> str:
        return _dump(
            {
                "total_rfps": int(self.next_rfp_id) - 1,
                "total_bids": int(self.total_bids),
                "total_judged": int(self.total_judged),
                "total_paid": str(int(self.total_paid)),
                "total_refunded": str(int(self.total_refunded)),
            }
        )

    # --------------------------------------------------------------- helpers

    def _rfp(self, rfp_id: str) -> dict:
        if rfp_id not in self.rfps:
            raise gl.vm.UserError("unknown RFP")
        return _load(self.rfps[rfp_id])


def _dump_list(items: list) -> str:
    return json.dumps(items, separators=(",", ":"))
