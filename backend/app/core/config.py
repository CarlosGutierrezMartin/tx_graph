from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    database_url: str
    redis_url: str

    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str

    log_level: str = "INFO"


settings = Settings()