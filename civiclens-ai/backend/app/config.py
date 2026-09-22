from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database: SQLite for quick local runs, PostgreSQL + pgvector for real deployments.
    database_url: str = "sqlite:///./civiclens.db"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_expire_minutes: int = 60 * 24

    # Google Gemini. Leave the key empty to run in offline demo mode.
    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-2.5-flash"
    gemini_embed_model: str = "gemini-embedding-001"
    gemini_thinking_budget: int = 0  # 0 = fastest. Set to -1 to disable this override.
    embed_dim: int = 768

    # Retrieval
    top_k: int = 5
    min_vector_score: float = 0.45  # cosine similarity needed to treat a chunk as relevant
    min_lexical_score: float = 2.0  # BM25 score needed in offline mode

    # App behaviour
    cors_origins: str = "http://localhost:5173,http://localhost:8000"
    auto_seed: bool = True
    seed_demo_data: bool = True
    sla_days: int = 7


@lru_cache
def get_settings() -> Settings:
    return Settings()
