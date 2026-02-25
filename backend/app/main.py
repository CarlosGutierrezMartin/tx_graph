from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.session import create_db_and_tables
from app.api.routes.health import router as health_router
from app.api.routes.ingest import router as ingest_router
from app.api.routes.entities import router as entities_router
from app.api.routes.graph import router as graph_router
from app.api.routes.investigations import router as investigations_router
from app.api.routes.cases import router as cases_router
from app.api.routes.alerts import router as alerts_router  # <-- add this

app = FastAPI(title="Transaction Intelligence Graph (MVP)")

# Dev-only: allow local prototype to call API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

app.include_router(health_router, prefix="/v1", tags=["system"])
app.include_router(ingest_router, prefix="/v1", tags=["ingest"])
app.include_router(entities_router, prefix="/v1", tags=["graph"])
app.include_router(graph_router, prefix="/v1", tags=["graph"])
app.include_router(investigations_router, prefix="/v1", tags=["investigations"])
app.include_router(cases_router, prefix="/v1", tags=["cases"])
app.include_router(alerts_router, prefix="/v1", tags=["alerts"])  # <-- add this