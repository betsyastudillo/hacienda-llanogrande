from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    base_url: str = "http://localhost:8000"
    payment_webhook_secret: str

    class Config:
        env_file = ".env"

settings = Settings()