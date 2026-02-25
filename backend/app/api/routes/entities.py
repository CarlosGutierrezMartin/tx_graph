from fastapi import APIRouter, Query
from app.services.graph_read import search_entities

router = APIRouter()

@router.get("/entities/search")
def entities_search(q: str = Query(..., min_length=1), limit: int = 10):
    return {"results": search_entities(q=q, limit=min(limit, 50))}