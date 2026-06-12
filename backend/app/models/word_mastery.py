from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WordMastery(Base):
    __tablename__ = "word_mastery"
    __table_args__ = (UniqueConstraint("child_id", "word_id", name="uq_child_word_mastery"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), index=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id"), index=True)
    meaning_score: Mapped[int] = mapped_column(Integer, default=0)
    spelling_score: Mapped[int] = mapped_column(Integer, default=0)
    pronunciation_score: Mapped[int] = mapped_column(Integer, default=0)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    correct_streak: Mapped[int] = mapped_column(Integer, default=0)
    first_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_practiced_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    word: Mapped["Word"] = relationship()


from app.models.word import Word  # noqa: E402
