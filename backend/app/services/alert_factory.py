from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models.alerts import Alert
from app.models.cases import AuditLog
from app.models.event_store import CanonicalEvent
from app.services.case_factory import create_case_from_event
from app.services.graph_read import neighborhood
from app.services.investigation import (
    compute_outlier_signal,
    compute_velocity,
    fetch_counterparty_history,
    recommend_actions,
    suggest_severity,
)

SEV_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}
COOLDOWN_MINUTES = 30  # dedupe window


def alert_exists(session: Session, canonical_event_id: int, rule_id: str) -> bool:
    stmt = select(Alert).where(
        Alert.canonical_event_id == canonical_event_id,
        Alert.rule_id == rule_id,
    )
    return session.exec(stmt).first() is not None


def _latest_active_alert(
    session: Session,
    entity_kind: str,
    entity_key: str,
    rule_id: str,
) -> Alert | None:
    stmt = (
        select(Alert)
        .where(Alert.entity_kind == entity_kind)
        .where(Alert.entity_key == entity_key)
        .where(Alert.rule_id == rule_id)
        .where(Alert.status.in_(["open", "acked"]))
        .order_by(Alert.created_at.desc())
        .limit(1)
    )
    return session.exec(stmt).first()


def _latest_active_high_alert(
    session: Session,
    entity_kind: str,
    entity_key: str,
    rule_id: str,
) -> Alert | None:
    stmt = (
        select(Alert)
        .where(Alert.entity_kind == entity_kind)
        .where(Alert.entity_key == entity_key)
        .where(Alert.rule_id == rule_id)
        .where(Alert.status.in_(["open", "acked"]))
        .where(Alert.severity.in_(["high", "critical"]))
        .order_by(Alert.created_at.desc())
        .limit(1)
    )
    return session.exec(stmt).first()


def create_alert_from_event(
    session: Session,
    canonical_event_id: int,
    actor: str = "system",
    days: int = 30,
    rule_id: str = "velocity_outlier_v1",
) -> int | None:
    """
    Creates an alert for severity >= medium.

    Dedupe + cooldown:
      - If there's an existing OPEN/ACKED alert for same entity+rule within COOLDOWN_MINUTES,
        update it (increment occurrences, bump last_seen_at, possibly escalate severity).

    Noise suppression:
      - If there's an existing OPEN/ACKED HIGH/CRITICAL alert for the same entity+rule,
        do NOT create MEDIUM alerts. Instead, bump/update the high/critical alert.

    For high/critical, also creates/links a case (idempotent).
    Returns alert_id or None if no alert created.
    """
    if alert_exists(session, canonical_event_id, rule_id):
        return None

    ce = session.get(CanonicalEvent, canonical_event_id)
    if not ce:
        return None

    # Build investigation context
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

    now = datetime.now(timezone.utc)

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
        "created_at": now.isoformat(),
    }

    title = f"{severity.upper()} alert: {ce.event_type} to {ce.counterparty_name} ({ce.amount:.2f} {ce.currency})"
    description = "\n".join(narrative)

    entity_kind = "counterparty"
    entity_key = ce.counterparty_name

    # --- 1) COOLDOWN DEDUPE: update existing recent open/acked alert ---
    existing = _latest_active_alert(session, entity_kind=entity_kind, entity_key=entity_key, rule_id=rule_id)
    if existing:
        last_seen = existing.last_seen_at or existing.created_at
        if last_seen and (now - last_seen) <= timedelta(minutes=COOLDOWN_MINUTES):
            existing.occurrences = int(existing.occurrences or 1) + 1
            existing.last_seen_at = now
            existing.latest_canonical_event_id = ce.id

            # escalate only (never downgrade)
            if SEV_RANK.get(severity, 0) > SEV_RANK.get(existing.severity or "low", 0):
                existing.severity = severity
                existing.title = title

            existing.payload = payload
            existing.description = description
            existing.updated_at = now

            session.add(existing)
            session.add(
                AuditLog(
                    actor=actor,
                    action="alert_deduped_updated",
                    resource_type="alert",
                    resource_id=str(existing.id),
                    meta={"canonical_event_id": ce.id, "severity": severity, "rule_id": rule_id},
                )
            )
            session.commit()

            # If it is/gets high/critical and has no case, link/create case
            if existing.severity in {"high", "critical"} and not existing.case_id:
                case_id = create_case_from_event(session=session, canonical_event_id=ce.id, actor=actor, days=days)
                if case_id:
                    existing.case_id = case_id
                    existing.updated_at = datetime.now(timezone.utc)
                    session.add(existing)
                    session.commit()

            return existing.id

    # --- 2) NOISE SUPPRESSION: if high/critical is active, never create medium ---
    if severity == "medium":
        high_existing = _latest_active_high_alert(session, entity_kind=entity_kind, entity_key=entity_key, rule_id=rule_id)
        if high_existing:
            high_existing.occurrences = int(high_existing.occurrences or 1) + 1
            high_existing.last_seen_at = now
            high_existing.latest_canonical_event_id = ce.id

            # Keep severity (do not downgrade)
            high_existing.payload = payload
            high_existing.description = description
            high_existing.updated_at = now

            session.add(high_existing)
            session.add(
                AuditLog(
                    actor=actor,
                    action="alert_noise_suppressed_bumped_high",
                    resource_type="alert",
                    resource_id=str(high_existing.id),
                    meta={"canonical_event_id": ce.id, "incoming_severity": severity, "rule_id": rule_id},
                )
            )
            session.commit()
            return high_existing.id

    # --- 3) CREATE NEW ALERT ---
    alert = Alert(
        canonical_event_id=ce.id,
        latest_canonical_event_id=ce.id,
        occurrences=1,
        last_seen_at=now,
        entity_kind=entity_kind,
        entity_key=entity_key,
        rule_id=rule_id,
        severity=severity,
        status="open",
        title=title,
        description=description,
        payload=payload,
    )

    try:
        session.add(alert)
        session.commit()
        session.refresh(alert)
    except IntegrityError:
        session.rollback()
        return None

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