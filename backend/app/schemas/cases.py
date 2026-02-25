from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class CaseCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = Field(default="medium")
    entity_kind: Optional[str] = None
    entity_key: Optional[str] = None
    canonical_event_id: Optional[int] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


class CaseResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str
    severity: str
    entity_kind: Optional[str]
    entity_key: Optional[str]
    canonical_event_id: Optional[int]
    meta: Dict[str, Any]


class CaseNoteCreateRequest(BaseModel):
    author: str = "system"
    note: str


class CaseNoteResponse(BaseModel):
    id: int
    case_id: int
    author: str
    note: str


class CaseUpdateRequest(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    assignee: Optional[str] = None