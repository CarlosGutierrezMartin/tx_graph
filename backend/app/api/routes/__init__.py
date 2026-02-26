from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.ingest import router as ingest_router
from app.api.routes.entities import router as entities_router
from app.api.routes.graph import router as graph_router
from app.api.routes.investigations import router as investigations_router
from app.api.routes.cases import router as cases_router
from app.api.routes.alerts import router as alerts_router
from app.api.routes.ai import router as ai_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(ingest_router)
api_router.include_router(entities_router)
api_router.include_router(graph_router)
api_router.include_router(investigations_router)
api_router.include_router(cases_router)
api_router.include_router(alerts_router)
api_router.include_router(ai_router)