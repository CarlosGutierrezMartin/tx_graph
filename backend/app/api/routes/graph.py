from fastapi import APIRouter, Query, HTTPException
from app.services.graph_read import neighborhood

router = APIRouter()

@router.get("/graph/neighborhood")
def graph_neighborhood(
    kind: str = Query(..., description="counterparty|account|transaction"),
    key: str = Query(..., description="entity key, e.g. counterparty name"),
    hops: int = 2,
    limit: int = 200,
):
    try:
        return neighborhood(kind=kind, key=key, hops=hops, limit=limit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))