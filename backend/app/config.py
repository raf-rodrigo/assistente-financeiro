from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./finance_assistant.db"
    openai_api_key: str = ""
    openai_model: str = "gpt-5.5"
    free_ai_messages_per_month: int = 10
    demo_user_email: str = "demo@local"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
