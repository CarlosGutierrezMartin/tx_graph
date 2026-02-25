from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlmodel import SQLModel, Field, Column
from sqlalchemy.dialects.postgresql import JSONB


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Case(SQLModel, table=True):
    __tablename__ = "cases"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    description: Optional[str] = Field(default=None)

    status: str = Field(default="open", index=True)  # open | in_progress | closed
    severity: str = Field(default="medium", index=True)  # low | medium | high | critical

    # link to something in the graph / events
    entity_kind: Optional[str] = Field(default=None, index=True)  # counterparty | account | transaction
    entity_key: Optional[str] = Field(default=None, index=True)   # e.g., "Supplier Iberia SL"
    canonical_event_id: Optional[int] = Field(default=None, index=True)

    meta: Dict[str, Any] = Field(sa_column=Column(JSONB), default_factory=dict)

    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow, index=True)


class CaseNote(SQLModel, table=True):
    __tablename__ = "case_notes"

    id: Optional[int] = Field(default=None, primary_key=True)
    case_id: int = Field(index=True)
    author: str = Field(default="system", index=True)
    note: str

    created_at: datetime = Field(default_factory=utcnow, index=True)


class CaseAssignment(SQLModel, table=True):
    __tablename__ = "case_assignments"

    id: Optional[int] = Field(default=None, primary_key=True)
    case_id: int = Field(index=True)
    assignee: str = Field(index=True)

    created_at: datetime = Field(default_factory=utcnow, index=True)


class AuditLog(SQLModel, table=True):
    """
    Simple audit trail you can expand later.
    Useful for 'regulated environment' storytelling.
    """
    __tablename__ = "audit_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    actor: str = Field(default="system", index=True)
    action: str = Field(index=True)  # e.g. "case_created", "note_added"
    resource_type: str = Field(index=True)  # "case", "graph_query", etc.
    resource_id: Optional[str] = Field(default=None, index=True)

    meta: Dict[str, Any] = Field(sa_column=Column(JSONB), default_factory=dict)
    created_at: datetime = Field(default_factory=utcnow, index=True)