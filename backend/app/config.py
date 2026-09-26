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
    # Supabase project URL, e.g. https://xxxx.supabase.co - used to fetch the
    # JWKS for verifying tokens signed with the new asymmetric keys.
    supabase_url: str = ""
    # HS256 secret from Supabase → Project Settings → JWT Keys → Reveal JWT Secret.
    # Only used as a fallback for tokens still signed with the legacy HS256 secret.
    supabase_jwt_secret: str = ""
    # Admin-level Supabase key. Backend-only, NEVER expose to the frontend.
    # From dashboard → Project Settings → API Keys → "Secret key" (the one
    # marked service_role). Used to hard-delete a user's Supabase account.
    supabase_service_role_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
