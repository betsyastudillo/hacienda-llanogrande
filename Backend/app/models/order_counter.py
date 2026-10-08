from sqlalchemy import Column, Integer
from app.database import Base


class OrderCounter(Base):
  __tablename__ = "order_counters"

  year = Column(Integer, primary_key=True)
  last_number = Column(Integer, nullable=False, default=0)