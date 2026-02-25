from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlmodel import SQLModel, Field, Column
from sqlalchemy.dialects.postgresql import JSONB


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RawEvent(SQLModel, table=True):
    __tablename__ = "raw_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    source: str = Field(index=True)
    idempotency_key: str = Field(index=True, unique=True)
    payload: Dict[str, Any] = Field(sa_column=Column(JSONB), default_factory=dict)
    received_at: datetime = Field(default_factory=utcnow, index=True)


class CanonicalEvent(SQLModel, table=True):
    __tablename__ = "canonical_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    raw_event_id: int = Field(index=True)

    event_type: str = Field(index=True)
    occurred_at: datetime = Field(index=True)

    account_id: str = Field(index=True)
    counterparty_name: str = Field(index=True)
    amount: float
    currency: str = Field(index=True)

    canonical: Dict[str, Any] = Field(sa_column=Column(JSONB), default_factory=dict)
    created_at: datetime = Field(default_factory=utcnow, index=True)