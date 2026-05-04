from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    app_name: str = "Knowledge Mesh API"
    database_url: str = Field(
        default="postgresql+psycopg://knowledge_mesh:knowledge_mesh@postgres:5432/knowledge_mesh",
        alias="DATABASE_URL",
    )
    api_internal_jwt_secret: str = Field(default="change-me-in-production", alias="API_INTERNAL_JWT_SECRET")
    api_cors_origins: str = Field(default="http://localhost:8080,http://localhost:3000", alias="API_CORS_ORIGINS")
    default_community_id: str = Field(default="campus-east", alias="DEFAULT_COMMUNITY_ID")
    auth_dev_mode: bool = Field(default=True, alias="AUTH_DEV_MODE")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.api_cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
