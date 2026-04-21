from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )

    app_name: str = "VeriFrame Python Backend"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    mongodb_connection_string: str | None = Field(default=None, validation_alias="MONGODB_CONNECTION_STRING")
    mongodb_database_name: str = Field(default="veriframe", validation_alias="MONGODB_DATABASE_NAME")
    vite_use_python_backend: bool = Field(default=False, validation_alias="VITE_USE_PYTHON_BACKEND")
    
    model_path: str | None = None


settings = Settings()