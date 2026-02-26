from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api_router
from app.db.session import create_db_and_tables

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


# Single source of truth for routes:
# health / ingest / entities / graph / investigations / cases / alerts / ai
app.include_router(api_router, prefix="/v1")