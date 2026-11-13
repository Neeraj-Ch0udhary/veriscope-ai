from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    app_name: str = "VeriScope AI"
    upload_dir: Path = BASE_DIR / "storage" / "uploads"
    max_upload_mb: int = 20
    max_rows: int = 500_000
    max_cols: int = 200
    allowed_extensions: tuple[str, ...] = (".csv", ".xlsx")
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)