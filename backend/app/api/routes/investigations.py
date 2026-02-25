from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select  # <-- added select

from app.db.session import get_session
from app.models.cases import AuditLog, Case, CaseNote
from app.models.event_store import CanonicalEvent
from app.services.graph_read import neighborhood
from app.services.investigation import (
    compute_outlier_signal,
    compute_velocity,
    fetch_counterparty_history,
    history_to_dict,
    recommend_actions,
    suggest_severity,
)

router = APIRouter()


@router.post("/investigations/transactions/{canonical_event_id}/create-case")
def create_case_from_investigation(
    canonical_event_id: int,
    session: Session = Depends(get_session),
    days: int = Query(30, ge=1, le=365),
    actor: str = Query("system", description="Who is creating the case"),
):
    ce = session.get(CanonicalEvent, canonical_event_id)
    if not ce:
        raise HTTPException(status_code=404, detail="canonical_event_not_found")

    # Step 4: Idempotency — return existing case if one already exists for this event
    existing = session.exec(
        select(Case).where(Case.canonical_event_id == ce.id)
    ).first()
    if existing:
        return {
            "case_id": existing.id,
            "severity": existing.severity,
            "title": existing.title,
            "note_id": None,
            "created": False,
            "reason": "case_already_exists_for_canonical_event",
        }

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
            "graph_context": graph,  # keep for demo
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
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
    session.add(c)
    session.commit()
    session.refresh(c)

    note_text = "Recommended actions:\n- " + "\n- ".join(actions)
    n = CaseNote(case_id=c.id, author=actor, note=note_text)
    session.add(n)

    session.add(
        AuditLog(
            actor=actor,
            action="case_created_from_investigation",
            resource_type="case",
            resource_id=str(c.id),
            meta={"canonical_event_id": ce.id, "severity": severity},
        )
    )

    session.commit()
    session.refresh(n)

    return {"case_id": c.id, "severity": severity, "title": title, "note_id": n.id, "created": True}


@router.get("/investigations/transactions/{canonical_event_id}/timeline")
def transaction_timeline(
    canonical_event_id: int,
    session: Session = Depends(get_session),
    days: int = Query(30, ge=1, le=365),
):
    ce = session.get(CanonicalEvent, canonical_event_id)
    if not ce:
        raise HTTPException(status_code=404, detail="canonical_event_not_found")

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

    if outlier.get("available"):
        if "robust_z" in outlier:
            narrative.append(
                f"Amount unusualness (robust z): {round(float(outlier['robust_z']), 2)} "
                f"(median={round(float(outlier['median']),2)}, MAD={round(float(outlier['mad']),2)})."
            )
        elif "ratio_to_median" in outlier:
            narrative.append(
                f"Amount unusualness (ratio to median): {round(float(outlier['ratio_to_median']), 2)} "
                f"(median={round(float(outlier['median']),2)})."
            )
    else:
        narrative.append("Not enough history to compute outlier signal.")

    graph = neighborhood(kind="counterparty", key=ce.counterparty_name, hops=2, limit=200)

    return {
        "canonical_event_id": ce.id,
        "suggested_severity": severity,
        "signals": {"velocity": velocity.__dict__, "outlier": outlier},
        "recommended_actions": actions,
        "narrative": narrative,
        "history": history_to_dict(history),
        "graph_context": graph,
        "event": ce.canonical,
    }