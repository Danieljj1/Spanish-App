from sqlalchemy import Column, Integer, String
from database import Base


class Progress(Base):
    __tablename__ = "progress"

    id = Column(Integer, primary_key=True, default=1)
    xp = Column(Integer, nullable=False, default=0)
    streak = Column(Integer, nullable=False, default=0)
    last_practice_date = Column(String, nullable=True)
    total_sessions = Column(Integer, nullable=False, default=0)
    level = Column(Integer, nullable=False, default=1)
