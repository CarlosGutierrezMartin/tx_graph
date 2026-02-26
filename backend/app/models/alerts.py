from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Dict, Any

from sqlmodel import SQLModel, Field, Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import UniqueConstraint


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Alert(SQLModel, table=True):
    __tablename__ = "alerts"
    __table_args__ = (
        UniqueConstraint("canonical_event_id", "rule_id", name="alerts_event_rule_unique"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)

    # Link to the originating event (if applicable)
    canonical_event_id: Optional[int] = Field(default=None, index=True)

    # What entity is being flagged
    entity_kind: str = Field(default="counterparty", index=True)  # counterparty|account|transaction
    entity_key: str = Field(index=True)  # e.g. "Supplier Iberia SL"

    rule_id: str = Field(default="velocity_outlier_v1", index=True)

    severity: str = Field(default="medium", index=True)  # low|medium|high|critical
    status: str = Field(default="open", index=True)      # open|acked|resolved

    title: str = Field(index=True)
    description: Optional[str] = Field(default=None)

    # Store the evidence pack (signals, narrative, recommended actions, small graph summary)
    payload: Dict[str, Any] = Field(sa_column=Column(JSONB), default_factory=dict)

    case_id: Optional[int] = Field(default=None, index=True)

    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow, index=True)
    acked_at: Optional[datetime] = Field(default=None, index=True)
    resolved_at: Optional[datetime] = Field(default=None, index=True)
    occurrences: int = Field(default=1, index=True)
    last_seen_at: Optional[datetime] = Field(default=None, index=True)
    latest_canonical_event_id: Optional[int] = Field(default=None, index=True)