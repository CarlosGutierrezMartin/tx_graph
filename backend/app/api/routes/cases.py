from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.cases import Case, CaseNote, CaseAssignment, AuditLog
from app.schemas.cases import (
    CaseCreateRequest, CaseResponse,
    CaseNoteCreateRequest, CaseNoteResponse,
    CaseUpdateRequest
)

router = APIRouter()

def log(session: Session, action: str, resource_type: str, resource_id: str | None, meta: dict):
    session.add(AuditLog(action=action, resource_type=resource_type, resource_id=resource_id, meta=meta))

@router.post("/cases", response_model=CaseResponse)
def create_case(req: CaseCreateRequest, session: Session = Depends(get_session)):
    c = Case(
        title=req.title,
        description=req.description,
        severity=req.severity,
        entity_kind=req.entity_kind,
        entity_key=req.entity_key,
        canonical_event_id=req.canonical_event_id,
        meta=req.meta,
    )
    session.add(c)
    session.commit()
    session.refresh(c)

    log(session, "case_created", "case", str(c.id), {"severity": c.severity})
    session.commit()
    session.refresh(c)

    return c

@router.get("/cases")
def list_cases(session: Session = Depends(get_session), limit: int = 50):
    rows = session.exec(select(Case).order_by(Case.created_at.desc()).limit(min(limit, 200))).all()
    return {"cases": [r.model_dump() for r in rows]}

@router.get("/cases/{case_id}")
def get_case(case_id: int, session: Session = Depends(get_session)):
    c = session.get(Case, case_id)
    if not c:
        raise HTTPException(status_code=404, detail="case_not_found")

    notes = session.exec(select(CaseNote).where(CaseNote.case_id == case_id).order_by(CaseNote.created_at.asc())).all()
    assigns = session.exec(select(CaseAssignment).where(CaseAssignment.case_id == case_id).order_by(CaseAssignment.created_at.desc())).all()

    return {
        "case": c.model_dump(),
        "notes": [n.model_dump() for n in notes],
        "assignments": [a.model_dump() for a in assigns],
    }

@router.post("/cases/{case_id}/notes", response_model=CaseNoteResponse)
def add_note(case_id: int, req: CaseNoteCreateRequest, session: Session = Depends(get_session)):
    c = session.get(Case, case_id)
    if not c:
        raise HTTPException(status_code=404, detail="case_not_found")

    n = CaseNote(case_id=case_id, author=req.author, note=req.note)
    session.add(n)

    c.updated_at = datetime.now(timezone.utc)
    session.add(c)

    log(session, "note_added", "case", str(case_id), {"author": req.author})
    session.commit()
    session.refresh(n)

    return n

@router.patch("/cases/{case_id}")
def update_case(case_id: int, req: CaseUpdateRequest, session: Session = Depends(get_session)):
    c = session.get(Case, case_id)
    if not c:
        raise HTTPException(status_code=404, detail="case_not_found")

    changed = {}
    if req.status:
        c.status = req.status
        changed["status"] = req.status
    if req.severity:
        c.severity = req.severity
        changed["severity"] = req.severity
    if req.assignee:
        session.add(CaseAssignment(case_id=case_id, assignee=req.assignee))
        changed["assignee"] = req.assignee

    if changed:
        c.updated_at = datetime.now(timezone.utc)
        session.add(c)
        log(session, "case_updated", "case", str(case_id), changed)
        session.commit()

    return {"ok": True, "updated": changed}