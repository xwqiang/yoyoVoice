from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
AUDIO_DIR = DATA_DIR / "audio"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    secret_key: str = "dev-secret-change-in-production"
    database_url: str = f"sqlite:///{DATA_DIR / 'yoyovoice.db'}"
    cors_origins: str = "*"
    azure_speech_key: str = ""
    azure_speech_region: str = "eastus"
    cursor_api_key: str = ""
    cursor_model: str = "composer-2.5"
    openai_api_key: str = ""
    openai_base_url: str = ""
    openai_model: str = "gpt-4o-mini"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days for family LAN use

    @property
    def ai_api_key(self) -> str:
        return self.openai_api_key or self.cursor_api_key

    @property
    def ai_model(self) -> str:
        if self.openai_api_key:
            return self.openai_model
        return self.cursor_model

    @property
    def ai_base_url(self) -> str | None:
        if self.openai_base_url:
            return self.openai_base_url
        if self.cursor_api_key and not self.openai_api_key:
            return "https://api.cursor.com/v1"
        return None

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
