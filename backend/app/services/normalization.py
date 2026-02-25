from datetime import datetime, timezone
from typing import Dict, Any


def to_utc(dt_str: str) -> datetime:
    # Expect ISO 8601 in payload
    # Example: "2026-02-24T12:34:56Z"
    if dt_str.endswith("Z"):
        dt_str = dt_str.replace("Z", "+00:00")
    return datetime.fromisoformat(dt_str).astimezone(timezone.utc)


def normalize_raw_payload(source: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    MVP: assume a simple transfer-like payload.
    You can later add a router by source/event_type.
    """
    # Minimal required fields with defaults for demo
    occurred_at = payload.get("occurred_at") or datetime.now(timezone.utc).isoformat()
    amount = float(payload.get("amount", 0))
    currency = payload.get("currency", "EUR")
    account_id = str(payload.get("account_id", "acct_demo"))
    counterparty_name = str(payload.get("counterparty_name", "Unknown"))

    canonical = {
        "event_type": payload.get("event_type", "TRANSFER_OUT"),
        "occurred_at": occurred_at,
        "amount": amount,
        "currency": currency,
        "account_id": account_id,
        "counterparty": {"name": counterparty_name},
        "source": source,
        "raw": payload,
    }
    return canonical