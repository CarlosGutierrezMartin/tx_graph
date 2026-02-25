from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
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


@router.get("/alerts")
def list_alerts(
    session: Session = Depends(get_session),
    status: str = Query("open"),
    severity: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    stmt = select(Alert).order_by(Alert.created_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(Alert.status == status)
    if severity:
        stmt = stmt.where(Alert.severity == severity)

    alerts = session.exec(stmt).all()
    return {"alerts": [a.model_dump() for a in alerts]}


@router.get("/alerts/{alert_id}")
def get_alert(alert_id: int, session: Session = Depends(get_session)):
    a = session.get(Alert, alert_id)
    if not a:
        raise HTTPException(status_code=404, detail="alert_not_found")
    return {"alert": a.model_dump()}


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
        return {"ok": True, "status": a.status, "note": "already_resolved"}

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

    # Idempotent case creation
    existing_case = session.exec(select(Case).where(Case.canonical_event_id == ce.id)).first()
    if existing_case:
        alert.case_id = existing_case.id
        alert.updated_at = datetime.now(timezone.utc)
        session.add(alert)
        session.commit()
        return {"case_id": existing_case.id, "created": False, "reason": "case_already_exists"}

    # Recompute evidence pack (same as investigation)
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