from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    database_url: str
    redis_url: str

    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str

    ai_enabled: bool = False

    log_level: str = "INFO"

    @field_validator("database_url", mode="before")
    @classmethod
    def fix_postgres_url(cls, v: str) -> str:
        """Render gives postgres://, SQLAlchemy+psycopg needs postgresql+psycopg://"""
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+psycopg://", 1)
        elif v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v


settings = Settings()