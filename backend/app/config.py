"""Application settings, loaded from environment / .env file."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EventLoop API"
    environment: str = "development"
    frontend_origin: str = "http://localhost:5173"

    # Filled in later steps
    mongodb_uri: str = ""
    mongodb_db: str = "eventloop"
    jina_api_key: str = ""
    groq_api_key: str = ""
    supabase_url: str = ""
    supabase_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
