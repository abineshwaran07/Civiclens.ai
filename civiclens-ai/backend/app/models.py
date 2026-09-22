from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .config import get_settings
from .database import IS_POSTGRES, Base

if IS_POSTGRES:
    from pgvector.sqlalchemy import Vector

    EmbeddingType = Vector(get_settings().embed_dim)
else:
    EmbeddingType = JSON(none_as_null=True)  # SQLite: vectors stored as JSON lists, compared in Python


def utcnow() -> datetime:
    """Naive UTC timestamp (stored without tzinfo, serialised with a trailing Z)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(300))
    role: Mapped[str] = mapped_column(String(20), default="citizen")  # citizen | officer
    preferred_language: Mapped[str] = mapped_column(String(5), default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Scheme(Base):
    __tablename__ = "schemes"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    name_ta: Mapped[str | None] = mapped_column(String(300), nullable=True)
    department: Mapped[str] = mapped_column(String(200))
    level: Mapped[str] = mapped_column(String(30))  # Central | Tamil Nadu
    category: Mapped[str] = mapped_column(String(80), index=True)
    url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    sections: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class DocChunk(Base):
    """One retrievable passage of a verified government document."""

    __tablename__ = "doc_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    scheme_id: Mapped[int | None] = mapped_column(ForeignKey("schemes.id", ondelete="CASCADE"), nullable=True)
    source_title: Mapped[str] = mapped_column(String(250), index=True)
    source_url: Mapped[str | None] = mapped_column(String(400), nullable=True)
    department: Mapped[str | None] = mapped_column(String(200), nullable=True)
    section: Mapped[str] = mapped_column(String(60), default="Document")
    content: Mapped[str] = mapped_column(Text)
    embedding = mapped_column(EmbeddingType, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Grievance(Base):
    __tablename__ = "grievances"

    id: Mapped[int] = mapped_column(primary_key=True)
    tracking_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(60), index=True)
    department: Mapped[str] = mapped_column(String(200))
    priority: Mapped[str] = mapped_column(String(10), default="medium")  # low | medium | high | urgent
    status: Mapped[str] = mapped_column(String(20), default="submitted", index=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    language: Mapped[str] = mapped_column(String(5), default="en")
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_draft: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped[User] = relationship()
    events: Mapped[list["GrievanceEvent"]] = relationship(
        back_populates="grievance", order_by="GrievanceEvent.created_at", cascade="all, delete-orphan"
    )


class GrievanceEvent(Base):
    __tablename__ = "grievance_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    grievance_id: Mapped[int] = mapped_column(ForeignKey("grievances.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    actor_role: Mapped[str] = mapped_column(String(20), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    grievance: Mapped[Grievance] = relationship(back_populates="events")
