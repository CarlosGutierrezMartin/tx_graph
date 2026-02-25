from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models.cases import AuditLog, Case, CaseNote
from app.models.event_store import CanonicalEvent
from app.services.graph_read import neighborhood
from app.services.investigation import (
    compute_outlier_signal,
    compute_velocity,
    fetch_counterparty_history,
    recommend_actions,
    suggest_severity,
)


def case_exists_for_event(session: Session, canonical_event_id: int) -> bool:
    stmt = select(Case).where(Case.canonical_event_id == canonical_event_id)
    return session.exec(stmt).first() is not None


def create_case_from_event(
    session: Session, canonical_event_id: int, actor: str = "system", days: int = 30
) -> int | None:
    """
    Returns created case_id, or None if no case created (not severe or already exists).
    """

    # Fast path: if already exists, do nothing
    if case_exists_for_event(session, canonical_event_id):
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

    # Only auto-create for high/critical
    if severity not in {"high", "critical"}:
        return None

    narrative = [
        f"At {ce.occurred_at.isoformat()}, account '{ce.account_id}' sent {ce.amount:.2f} {ce.currency} to '{ce.counterparty_name}'.",
        f"Counterparty history window: last {days} days, total matching payments: {len(history)}.",
        f"Velocity: {velocity.count_10m} payments in 10m, {velocity.count_1h} in 1h, {velocity.count_24h} in 24h.",
    ]

    graph = neighborhood(kind="counterparty", key=ce.counterparty_name, hops=2, limit=200)

    evidence_pack = {
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
        "graph_summary": {
            "nodes_count": len(graph.get("nodes", [])),
            "edges_count": len(graph.get("edges", [])),
            "graph_context": graph,
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
        "auto_created": True,
    }

    title = f"{severity.upper()}: {ce.event_type} to {ce.counterparty_name} ({ce.amount:.2f} {ce.currency})"
    description = "\n".join(narrative)

    c = Case(
        title=title,
        description=description,
        severity=severity,
        status="open",
        entity_kind="counterparty",
        entity_key=ce.counterparty_name,
        canonical_event_id=ce.id,
        meta=evidence_pack,
    )

    # Step 5: race-condition safety — rely on DB UNIQUE constraint and handle IntegrityError
    try:
        session.add(c)
        session.commit()
        session.refresh(c)
    except IntegrityError:
        session.rollback()
        return None

    note_text = "Auto-created case. Recommended actions:\n- " + "\n- ".join(actions)
    session.add(CaseNote(case_id=c.id, author=actor, note=note_text))

    session.add(
        AuditLog(
            actor=actor,
            action="auto_case_created",
            resource_type="case",
            resource_id=str(c.id),
            meta={"canonical_event_id": ce.id, "severity": severity},
        )
    )

    session.commit()
    return c.id