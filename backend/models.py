from sqlalchemy import Column, Integer, String, DateTime
from database import Base
from datetime import datetime

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String)
    phone = Column(String)

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String)

class Unsubscribe(Base):
    __tablename__ = "unsubscribes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    unsubscribed_at = Column(DateTime, default=datetime.utcnow)