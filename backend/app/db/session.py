from sqlmodel import SQLModel, create_engine, Session
from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)


def create_db_and_tables() -> None:
    # Ensure all models are imported so metadata is complete
    import app.models  # noqa: F401
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session