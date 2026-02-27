from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session, select
from app.db.session import get_session
from app.models.event_store import RawEvent
from app.schemas.ingest import IngestEventRequest, IngestEventResponse
from app.services.ingestion import normalize_and_upsert

router = APIRouter()


@router.post("/ingest", response_model=IngestEventResponse)
def ingest(
    req: IngestEventRequest, 
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
):
    # Idempotency: reject duplicates (or return existing id)
    existing = session.exec(
        select(RawEvent).where(RawEvent.idempotency_key == req.idempotency_key)
    ).first()

    if existing:
        # You could also return existing.id and status="duplicate"
        raise HTTPException(status_code=409, detail="Duplicate idempotency_key")

    raw = RawEvent(
        source=req.source,
        idempotency_key=req.idempotency_key,
        payload=req.payload,
    )
    session.add(raw)
    session.commit()
    session.refresh(raw)

    # Async processing natively via FastAPI
    background_tasks.add_task(normalize_and_upsert, raw.id)

    return IngestEventResponse(raw_event_id=raw.id, status="queued")