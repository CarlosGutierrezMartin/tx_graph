from typing import Any, Dict
from pydantic import BaseModel, Field


class IngestEventRequest(BaseModel):
    source: str = Field(..., examples=["sandbox_transfer"])
    idempotency_key: str = Field(..., examples=["evt_001_unique"])
    payload: Dict[str, Any]


class IngestEventResponse(BaseModel):
    raw_event_id: int
    status: str