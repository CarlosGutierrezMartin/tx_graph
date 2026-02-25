from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models.alerts import Alert
from app.models.cases import AuditLog
from app.models.event_store import CanonicalEvent
from app.services.graph_read import neighborhood
from app.services.investigation import (
    fetch_counterparty_history,
    compute_velocity,
    compute_outlier_signal,
    recommend_actions,
    suggest_severity,
)
from app.services.case_factory import create_case_from_event


def alert_exists(session: Session, canonical_event_id: int, rule_id: str) -> bool:
    stmt = select(Alert).where(
        Alert.canonical_event_id == canonical_event_id,
        Alert.rule_id == rule_id,
    )
    return session.exec(stmt).first() is not None


def create_alert_from_event(
    session: Session,
    canonical_event_id: int,
    actor: str = "system",
    days: int = 30,
    rule_id: str = "velocity_outlier_v1",
) -> int | None:
    """
    Creates an alert for severity >= medium.
    For high/critical, also creates/links a case (idempotent).
    Returns alert_id or None if no alert created.
    """
    if alert_exists(session, canonical_event_id, rule_id):
        return None

    ce = session.get(CanonicalEvent, canonical_event_id)
    if not ce:
        return None

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

    # Only create alerts for medium+
    if severity == "low":
        return None

    narrative = [
        f"At {ce.occurred_at.isoformat()}, account '{ce.account_id}' sent {ce.amount:.2f} {ce.currency} to '{ce.counterparty_name}'.",
        f"Counterparty history window: last {days} days, total matching payments: {len(history)}.",
        f"Velocity: {velocity.count_10m} payments in 10m, {velocity.count_1h} in 1h, {velocity.count_24h} in 24h.",
    ]

    graph = neighborhood(kind="counterparty", key=ce.counterparty_name, hops=2, limit=200)

    payload = {
        "canonical_event_id": ce.id,
        "account_id": ce.account_id,
        "counterparty_name": ce.counterparty_name,
        "amount": ce.amount,
        "currency": ce.currency,
        "event_type": ce.event_type,
        "signals": {"velocity": velocity.__dict__, "outlier": outlier},
        "recommended_actions": actions,
        "narrative": narrative,
        "history_ids": [e.id for e in history],
        "graph_summary": {"nodes_count": len(graph.get("nodes", [])), "edges_count": len(graph.get("edges", []))},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    title = f"{severity.upper()} alert: {ce.event_type} to {ce.counterparty_name} ({ce.amount:.2f} {ce.currency})"
    description = "\n".join(narrative)

    alert = Alert(
        canonical_event_id=ce.id,
        entity_kind="counterparty",
        entity_key=ce.counterparty_name,
        rule_id=rule_id,
        severity=severity,
        status="open",
        title=title,
        description=description,
        payload=payload,
    )

    # Insert alert safely (race-safe)
    try:
        session.add(alert)
        session.commit()
        session.refresh(alert)
    except IntegrityError:
        session.rollback()
        return None

    # Audit
    session.add(
        AuditLog(
            actor=actor,
            action="alert_created",
            resource_type="alert",
            resource_id=str(alert.id),
            meta={"canonical_event_id": ce.id, "severity": severity, "rule_id": rule_id},
        )
    )
    session.commit()

    # For high/critical, create and link a case (idempotent)
    if severity in {"high", "critical"}:
        case_id = create_case_from_event(session=session, canonical_event_id=ce.id, actor=actor, days=days)
        if case_id:
            alert.case_id = case_id
            alert.updated_at = datetime.now(timezone.utc)
            session.add(alert)
            session.commit()

    return alert.id