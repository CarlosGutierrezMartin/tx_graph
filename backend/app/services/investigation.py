from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

from sqlmodel import Session, select

from app.models.event_store import CanonicalEvent


@dataclass(frozen=True)
class VelocitySignals:
    count_10m: int
    count_1h: int
    count_24h: int


def _median(values: List[float]) -> Optional[float]:
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    mid = n // 2
    if n % 2 == 1:
        return float(s[mid])
    return float((s[mid - 1] + s[mid]) / 2)


def _mad(values: List[float], med: float) -> Optional[float]:
    if not values:
        return None
    dev = [abs(x - med) for x in values]
    return _median(dev)


def _robust_z_score(x: float, med: float, mad: float) -> Optional[float]:
    """
    Robust z-score using MAD. If MAD is 0, z-score isn't meaningful.
    0.6745 is the constant to make MAD comparable to std dev under normality.
    """
    if mad is None or mad == 0:
        return None
    return 0.6745 * (x - med) / mad


def fetch_counterparty_history(
    session: Session,
    account_id: str,
    counterparty_name: str,
    days: int = 30,
    limit: int = 200,
) -> List[CanonicalEvent]:
    days = max(1, min(days, 365))
    since = datetime.now(timezone.utc) - timedelta(days=days)

    stmt = (
        select(CanonicalEvent)
        .where(CanonicalEvent.account_id == account_id)
        .where(CanonicalEvent.counterparty_name == counterparty_name)
        .where(CanonicalEvent.occurred_at >= since)
        .order_by(CanonicalEvent.occurred_at.asc())
        .limit(min(limit, 1000))
    )
    return list(session.exec(stmt).all())


def compute_velocity(history: List[CanonicalEvent], anchor_time: datetime) -> VelocitySignals:
    def in_window(dt: datetime, window: timedelta) -> bool:
        return (anchor_time - window) <= dt <= anchor_time

    c10m = sum(1 for e in history if in_window(e.occurred_at, timedelta(minutes=10)))
    c1h = sum(1 for e in history if in_window(e.occurred_at, timedelta(hours=1)))
    c24h = sum(1 for e in history if in_window(e.occurred_at, timedelta(hours=24)))

    return VelocitySignals(count_10m=c10m, count_1h=c1h, count_24h=c24h)


def compute_outlier_signal(current_amount: float, history_amounts: List[float]) -> Dict[str, Any]:
    """
    Returns robust stats and an outlier flag.
    """
    amounts = [float(x) for x in history_amounts if x is not None]
    med = _median(amounts)
    if med is None:
        return {"available": False}

    mad = _mad(amounts, med)
    z = _robust_z_score(current_amount, med, mad) if mad is not None else None

    # Rule of thumb: |robust z| >= 3 is strong outlier; >= 2 moderate
    is_outlier = (z is not None) and (abs(z) >= 3)
    is_unusual = (z is not None) and (abs(z) >= 2)

    return {
        "available": True,
        "median": med,
        "mad": mad,
        "robust_z": z,
        "is_unusual": is_unusual,
        "is_outlier": is_outlier,
    }


def recommend_actions(velocity: VelocitySignals, outlier: Dict[str, Any]) -> List[str]:
    actions = []

    if velocity.count_10m >= 3:
        actions.append("High velocity: verify if these payments were scheduled/batched; check for automation or compromise.")
    if velocity.count_1h >= 5:
        actions.append("Very high activity in 1h: consider temporarily flagging account for review and confirming beneficiary details.")
    if outlier.get("available") and outlier.get("is_outlier"):
        actions.append("Amount is a strong outlier: confirm invoice/approval and validate counterparty legitimacy.")
    elif outlier.get("available") and outlier.get("is_unusual"):
        actions.append("Amount is unusual vs normal: request supporting documentation (invoice/contract) before closing case.")

    if not actions:
        actions.append("No strong signals detected: review timeline and confirm this matches expected business behavior.")

    return actions


def suggest_severity(velocity: VelocitySignals, outlier: Dict[str, Any]) -> str:
    score = 0
    if velocity.count_10m >= 3:
        score += 2
    if velocity.count_1h >= 5:
        score += 2
    if outlier.get("available") and outlier.get("is_outlier"):
        score += 2
    elif outlier.get("available") and outlier.get("is_unusual"):
        score += 1

    if score >= 4:
        return "critical"
    if score >= 3:
        return "high"
    if score >= 2:
        return "medium"
    return "low"


def history_to_dict(history: List[CanonicalEvent]) -> List[Dict[str, Any]]:
    return [
        {
            "canonical_event_id": e.id,
            "occurred_at": e.occurred_at.isoformat(),
            "event_type": e.event_type,
            "amount": e.amount,
            "currency": e.currency,
            "raw_event_id": e.raw_event_id,
        }
        for e in history
    ]