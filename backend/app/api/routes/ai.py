from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.db.session import get_session
from app.models.alerts import Alert
from app.services.ai_copilot import AICopilotError, ollama_chat_json

router = APIRouter()


@router.get("/ai/health")
def ai_health():
    return {"ok": True}


@router.post("/ai/alerts/{alert_id}/draft")
def ai_draft_for_alert(
    alert_id: int,
    session: Session = Depends(get_session),
    model: str | None = Query(None, description="Override model name, e.g. llama3.1"),
):
    alert = session.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="alert_not_found")

    now = datetime.now(timezone.utc)

    evidence = {
        "alert": {
            "id": alert.id,
            "severity": alert.severity,
            "status": alert.status,
            "title": alert.title,
            "entity_kind": alert.entity_kind,
            "entity_key": alert.entity_key,
            "created_at": alert.created_at.isoformat() if alert.created_at else None,
            "updated_at": alert.updated_at.isoformat() if alert.updated_at else None,
            "occurrences": getattr(alert, "occurrences", None),
            "last_seen_at": (
                getattr(alert, "last_seen_at", None).isoformat()
                if getattr(alert, "last_seen_at", None)
                else None
            ),
            "case_id": alert.case_id,
        },
        "payload": alert.payload or {},
        "generated_at": now.isoformat(),
    }

    try:
        out = ollama_chat_json(evidence=evidence, model=model)
        return {"ok": True, "draft": out}
    except AICopilotError as e:
        raise HTTPException(status_code=503, detail=str(e))