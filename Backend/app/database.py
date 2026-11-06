from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Entrega una sesión de base de datos por petición y la cierra al terminar (dependencia de FastAPI)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()