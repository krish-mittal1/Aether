from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Collab Code Editor API"
    api_prefix: str = "/api"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:3000"
    redis_url: str = "redis://redis:6379/0"
    executor_url: str = "http://executor:8080"
    database_url: str = "postgresql://postgres:postgres@postgres:5432/collab"
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
