from sqlmodel import Session

from app.core.config import settings
from app.db.session import engine
from app.models.event_store import RawEvent, CanonicalEvent
from app.services.normalization import normalize_raw_payload, to_utc
from app.services.graph import upsert_transaction
from app.services.alert_factory import create_alert_from_event  # alerts (and linked cases)

def normalize_and_upsert(raw_event_id: int) -> dict:
    """
    Load raw event -> normalize -> write canonical row -> upsert graph -> create alert (and case for high/critical).
    Runs as a FastAPI BackgroundTask instead of a Celery worker.
    """
    # 1) Load raw event + write canonical event (Postgres)
    with Session(engine) as session:
        raw = session.get(RawEvent, raw_event_id)
        if not raw:
            return {"ok": False, "error": "raw_event_not_found", "raw_event_id": raw_event_id}

        canonical = normalize_raw_payload(raw.source, raw.payload)

        ce = CanonicalEvent(
            raw_event_id=raw.id,
            event_type=str(canonical["event_type"]),
            occurred_at=to_utc(str(canonical["occurred_at"])),
            account_id=str(canonical["account_id"]),
            counterparty_name=str(canonical["counterparty"]["name"]),
            amount=float(canonical["amount"]),
            currency=str(canonical["currency"]),
            canonical=canonical,
        )
        session.add(ce)
        session.commit()
        session.refresh(ce)

    # 2) Upsert into Neo4j graph (outside SQL session)
    upsert_transaction(ce.id, canonical)

    # 3) Create alert (and possibly link/create case for high/critical)
    with Session(engine) as session:
        create_alert_from_event(
            session=session,
            canonical_event_id=ce.id,
            actor="system",
            days=30,
        )

    return {"ok": True, "raw_event_id": raw_event_id, "canonical_event_id": ce.id}
