from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import asc, case, desc, func
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.alerts import Alert
from app.models.cases import Case, CaseNote, AuditLog
from app.models.event_store import CanonicalEvent
from app.services.investigation import (
    fetch_counterparty_history,
    compute_velocity,
    compute_outlier_signal,
    recommend_actions,
    suggest_severity,
)

router = APIRouter()

# SLA targets (minutes). Tune later, but these are realistic for a demo.
SLA_TARGETS = {
    "critical": {"ack": 5, "resolve": 60},
    "high": {"ack": 15, "resolve": 240},
    "medium": {"ack": 60, "resolve": 1440},
    "low": {"ack": 240, "resolve": 2880},
}


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _mins(delta_seconds: float) -> int:
    return max(0, int(delta_seconds // 60))


def compute_sla(alert: Alert, now: datetime) -> Dict[str, Any]:
    created_at = _aware(alert.created_at)
    acked_at = _aware(alert.acked_at)
    resolved_at = _aware(alert.resolved_at)

    if created_at is None:
        return {"available": False}

    sev = (alert.severity or "low").lower()
    targets = SLA_TARGETS.get(sev, SLA_TARGETS["low"])
    ack_target = targets["ack"]
    resolve_target = targets["resolve"]

    age_minutes = _mins((now - created_at).total_seconds())
    time_to_ack_minutes = _mins((acked_at - created_at).total_seconds()) if acked_at else None
    time_to_resolve_minutes = _mins((resolved_at - created_at).total_seconds()) if resolved_at else None

    breach_ack = False
    breach_resolve = False

    if alert.status == "open":
        breach_ack = age_minutes > ack_target
        breach_resolve = age_minutes > resolve_target
    elif alert.status == "acked":
        breach_resolve = age_minutes > resolve_target
    elif alert.status == "resolved":
        if time_to_ack_minutes is not None:
            breach_ack = time_to_ack_minutes > ack_target
        if time_to_resolve_minutes is not None:
            breach_resolve = time_to_resolve_minutes > resolve_target

    return {
        "available": True,
        "age_minutes": age_minutes,
        "ack_target_minutes": ack_target,
        "resolve_target_minutes": resolve_target,
        "time_to_ack_minutes": time_to_ack_minutes,
        "time_to_resolve_minutes": time_to_resolve_minutes,
        "breach_ack": breach_ack,
        "breach_resolve": breach_resolve,
        "sla_breached": breach_ack or breach_resolve,
    }


def decorate_alert(alert: Alert, now: datetime) -> Dict[str, Any]:
    d = alert.model_dump()
    d["sla"] = compute_sla(alert, now)
    return d


def severity_rank_expr():
    return case(
        (Alert.severity == "critical", 3),
        (Alert.severity == "high", 2),
        (Alert.severity == "medium", 1),
        else_=0,
    )


# -------------------------
# LIST ALERTS (flat inbox)
# -------------------------
@router.get("/alerts")
def list_alerts(
    session: Session = Depends(get_session),
    status: str = Query("open"),
    severity: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    stmt = select(Alert)

    if status:
        stmt = stmt.where(Alert.status == status)
    if severity:
        stmt = stmt.where(Alert.severity == severity)

    sev_rank = severity_rank_expr()

    if status == "resolved":
        stmt = stmt.order_by(desc(Alert.resolved_at), desc(Alert.created_at))
    else:
        stmt = stmt.order_by(desc(sev_rank), asc(Alert.created_at))

    stmt = stmt.limit(limit)

    alerts = session.exec(stmt).all()
    now = datetime.now(timezone.utc)
    return {"alerts": [decorate_alert(a, now) for a in alerts]}


# -------------------------
# CLUSTERS (grouped inbox)
# IMPORTANT: must be defined BEFORE /alerts/{alert_id}
# -------------------------
SEV_FROM_RANK = {0: "low", 1: "medium", 2: "high", 3: "critical"}


def compute_cluster_sla(severity: str, status: str, created_at: datetime, now: datetime):
    a = Alert(
        severity=severity,
        status=status,
        created_at=created_at,
        acked_at=None,
        resolved_at=None,
    )
    return compute_sla(a, now)


@router.get("/alerts/clusters")
def list_alert_clusters(
    session: Session = Depends(get_session),
    status: str = Query("open"),
    limit: int = Query(50, ge=1, le=200),
):
    stmt = select(
        Alert.entity_kind.label("entity_kind"),
        Alert.entity_key.label("entity_key"),
        Alert.rule_id.label("rule_id"),
        func.count(Alert.id).label("alerts_count"),
        func.coalesce(func.sum(Alert.occurrences), 0).label("occurrences_sum"),
        func.min(Alert.created_at).label("oldest_created_at"),
        func.max(Alert.last_seen_at).label("last_seen_at"),
        func.max(Alert.latest_canonical_event_id).label("latest_canonical_event_id"),
        func.max(Alert.case_id).label("case_id_any"),
        func.max(severity_rank_expr()).label("sev_rank"),
    )

    # allow status="" to mean "all"
    if status:
        stmt = stmt.where(Alert.status == status)

    stmt = (
        stmt.group_by(Alert.entity_kind, Alert.entity_key, Alert.rule_id)
        .order_by(desc(func.max(severity_rank_expr())), asc(func.min(Alert.created_at)))
        .limit(limit)
    )

    rows = session.exec(stmt).all()
    now = datetime.now(timezone.utc)

    clusters = []
    for r in rows:
        sev = SEV_FROM_RANK.get(int(r.sev_rank or 0), "low")
        oldest = r.oldest_created_at
        cluster_status = status or "open"
        sla = compute_cluster_sla(sev, cluster_status, oldest, now) if oldest else {"available": False}

        clusters.append(
            {
                "entity_kind": r.entity_kind,
                "entity_key": r.entity_key,
                "rule_id": r.rule_id,
                "severity": sev,
                "alerts_count": int(r.alerts_count or 0),
                "occurrences": int(r.occurrences_sum or 0),
                "oldest_created_at": oldest.isoformat() if oldest else None,
                "last_seen_at": (r.last_seen_at.isoformat() if r.last_seen_at else None),
                "latest_canonical_event_id": r.latest_canonical_event_id,
                "case_id": r.case_id_any,
                "sla": sla,
            }
        )

    return {"clusters": clusters}


@router.get("/alerts/cluster")
def list_alerts_in_cluster(
    session: Session = Depends(get_session),
    entity_kind: str = Query(...),
    entity_key: str = Query(...),
    rule_id: str = Query(...),
    status: str = Query("open"),
    limit: int = Query(200, ge=1, le=500),
):
    stmt = (
        select(Alert)
        .where(Alert.entity_kind == entity_kind)
        .where(Alert.entity_key == entity_key)
        .where(Alert.rule_id == rule_id)
    )
    if status:
        stmt = stmt.where(Alert.status == status)

    stmt = stmt.order_by(asc(Alert.created_at)).limit(limit)

    alerts = session.exec(stmt).all()
    now = datetime.now(timezone.utc)
    return {"alerts": [decorate_alert(a, now) for a in alerts]}


# -------------------------
# SINGLE ALERT (must be after static /clusters routes)
# -------------------------
@router.get("/alerts/{alert_id}")
def get_alert(alert_id: int, session: Session = Depends(get_session)):
    a = session.get(Alert, alert_id)
    if not a:
        raise HTTPException(status_code=404, detail="alert_not_found")
    now = datetime.now(timezone.utc)
    return {"alert": decorate_alert(a, now)}


@router.post("/alerts/{alert_id}/ack")
def ack_alert(
    alert_id: int,
    session: Session = Depends(get_session),
    actor: str = Query("system"),
):
    a = session.get(Alert, alert_id)
    if not a:
        raise HTTPException(status_code=404, detail="alert_not_found")

    if a.status == "resolved":
        raise HTTPException(status_code=409, detail="alert_already_resolved")

    a.status = "acked"
    a.acked_at = a.acked_at or datetime.now(timezone.utc)
    a.updated_at = datetime.now(timezone.utc)
    session.add(a)

    session.add(
        AuditLog(
            actor=actor,
            action="alert_acked",
            resource_type="alert",
            resource_id=str(alert_id),
            meta={"severity": a.severity},
        )
    )

    session.commit()
    return {"ok": True, "status": a.status}


@router.post("/alerts/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    session: Session = Depends(get_session),
    actor: str = Query("system"),
):
    a = session.get(Alert, alert_id)
    if not a:
        raise HTTPException(status_code=404, detail="alert_not_found")

    a.status = "resolved"
    a.resolved_at = datetime.now(timezone.utc)
    a.updated_at = datetime.now(timezone.utc)
    session.add(a)

    session.add(
        AuditLog(
            actor=actor,
            action="alert_resolved",
            resource_type="alert",
            resource_id=str(alert_id),
            meta={"severity": a.severity},
        )
    )

    session.commit()
    return {"ok": True, "status": a.status}


@router.post("/alerts/{alert_id}/create-case")
def create_case_from_alert(
    alert_id: int,
    session: Session = Depends(get_session),
    actor: str = Query("system"),
    days: int = Query(30, ge=1, le=365),
):
    alert = session.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="alert_not_found")

    if alert.case_id:
        return {"case_id": alert.case_id, "created": False, "reason": "already_linked"}

    if not alert.canonical_event_id:
        raise HTTPException(status_code=400, detail="alert_missing_canonical_event_id")

    ce = session.get(CanonicalEvent, alert.canonical_event_id)
    if not ce:
        raise HTTPException(status_code=404, detail="canonical_event_not_found")

    existing_case = session.exec(select(Case).where(Case.canonical_event_id == ce.id)).first()
    if existing_case:
        alert.case_id = existing_case.id
        alert.updated_at = datetime.now(timezone.utc)
        session.add(alert)
        session.commit()
        return {"case_id": existing_case.id, "created": False, "reason": "case_already_exists"}

    history = fetch_counterparty_history(
        session=session,
        account_id=ce.account_id,
        counterparty_name=ce.counterparty_name,
        days=days,
        limit=300,
    )
    velocity = compute_velocity(history=history, anchor_time=ce.occurred_at)
    amounts = [e.amount for e in history if e.id != ce.id]
    outlier = compute_outlier_signal(current_amount=ce.amount, history_amounts=amounts)
    actions = recommend_actions(velocity=velocity, outlier=outlier)
    severity = suggest_severity(velocity=velocity, outlier=outlier)

    narrative = [
        f"At {ce.occurred_at.isoformat()}, account '{ce.account_id}' sent {ce.amount:.2f} {ce.currency} to '{ce.counterparty_name}'.",
        f"Counterparty history window: last {days} days, total matching payments: {len(history)}.",
        f"Velocity: {velocity.count_10m} payments in 10m, {velocity.count_1h} in 1h, {velocity.count_24h} in 24h.",
    ]

    title = f"{severity.upper()}: {ce.event_type} to {ce.counterparty_name} ({ce.amount:.2f} {ce.currency})"
    description = "\n".join(narrative)

    c = Case(
        title=title,
        description=description,
        severity=severity,
        status="open",
        entity_kind=alert.entity_kind,
        entity_key=alert.entity_key,
        canonical_event_id=ce.id,
        meta={"from_alert_id": alert.id, "alert_payload": alert.payload},
    )
    session.add(c)
    session.commit()
    session.refresh(c)

    session.add(CaseNote(case_id=c.id, author=actor, note="Created from alert.\n- " + "\n- ".join(actions)))
    session.add(
        AuditLog(
            actor=actor,
            action="case_created_from_alert",
            resource_type="case",
            resource_id=str(c.id),
            meta={"alert_id": alert.id, "canonical_event_id": ce.id, "severity": severity},
        )
    )

    alert.case_id = c.id
    alert.updated_at = datetime.now(timezone.utc)
    session.add(alert)

    session.commit()
    return {"case_id": c.id, "created": True}