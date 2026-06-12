from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Child(Base):
    __tablename__ = "children"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    nickname: Mapped[str] = mapped_column(String(50))
    avatar_emoji: Mapped[str] = mapped_column(String(10), default="🧒")
    grade: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    pin_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    last_study_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    active_course_id: Mapped[Optional[int]] = mapped_column(ForeignKey("courses.id"), nullable=True)
    active_custom_list_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("custom_word_lists.id"), nullable=True
    )
    learning_mode: Mapped[str] = mapped_column(String(20), default="course")  # course | custom
    daily_new_words: Mapped[int] = mapped_column(Integer, default=5)
    daily_review_words: Mapped[int] = mapped_column(Integer, default=3)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    account: Mapped["Account"] = relationship(back_populates="children")
    daily_plans: Mapped[list["DailyPlan"]] = relationship(back_populates="child")
    custom_lists: Mapped[list["CustomWordList"]] = relationship(
        back_populates="child",
        foreign_keys="[CustomWordList.child_id]",
    )
    course_progress: Mapped[list["ChildCourseProgress"]] = relationship(back_populates="child")


from app.models.account import Account  # noqa: E402
from app.models.course import ChildCourseProgress  # noqa: E402
from app.models.custom_list import CustomWordList  # noqa: E402
from app.models.daily_plan import DailyPlan  # noqa: E402
