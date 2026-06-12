from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    level: Mapped[str] = mapped_column(String(20), default="beginner")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    words: Mapped[list["CourseWord"]] = relationship(back_populates="course", order_by="CourseWord.sort_order")


class CourseWord(Base):
    __tablename__ = "course_words"
    __table_args__ = (UniqueConstraint("course_id", "word_id", name="uq_course_word"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), index=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id"), index=True)
    unit: Mapped[str] = mapped_column(String(50), default="Unit 1")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    course: Mapped["Course"] = relationship(back_populates="words")
    word: Mapped["Word"] = relationship()


class ChildCourseProgress(Base):
    __tablename__ = "child_course_progress"
    __table_args__ = (UniqueConstraint("child_id", "course_id", name="uq_child_course"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), index=True)
    current_sort_order: Mapped[int] = mapped_column(Integer, default=0)
    mastered_word_ids: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of word ids

    child: Mapped["Child"] = relationship(back_populates="course_progress")


from app.models.child import Child  # noqa: E402
from app.models.word import Word  # noqa: E402
