from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LearningSession(Base):
    __tablename__ = "learning_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    attempts: Mapped[list["LearningAttempt"]] = relationship(back_populates="session")


class LearningAttempt(Base):
    __tablename__ = "learning_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[Optional[int]] = mapped_column(ForeignKey("learning_sessions.id"), nullable=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), index=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id"), index=True)
    module_type: Mapped[str] = mapped_column(String(20))
    is_correct: Mapped[int] = mapped_column(Integer, default=0)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    user_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped[Optional["LearningSession"]] = relationship(back_populates="attempts")
    pronunciation_result: Mapped[Optional["PronunciationResult"]] = relationship(
        back_populates="attempt", uselist=False
    )


class LearningEvent(Base):
    __tablename__ = "learning_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), index=True)
    word_id: Mapped[Optional[int]] = mapped_column(ForeignKey("words.id"), nullable=True, index=True)
    module_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    event_type: Mapped[str] = mapped_column(String(50), index=True)
    is_correct: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    plan_item_id: Mapped[Optional[int]] = mapped_column(ForeignKey("daily_plan_items.id"), nullable=True, index=True)
    event_meta: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PronunciationResult(Base):
    __tablename__ = "pronunciation_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    attempt_id: Mapped[int] = mapped_column(ForeignKey("learning_attempts.id"), unique=True)
    pronunciation_score: Mapped[float] = mapped_column(Float)
    accuracy_score: Mapped[float] = mapped_column(Float)
    fluency_score: Mapped[float] = mapped_column(Float)
    completeness_score: Mapped[float] = mapped_column(Float)
    prosody_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    detail_json: Mapped[str] = mapped_column(Text, default="{}")

    attempt: Mapped["LearningAttempt"] = relationship(back_populates="pronunciation_result")
