from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DailyPlan(Base):
    __tablename__ = "daily_plans"
    __table_args__ = (UniqueConstraint("child_id", "plan_date", name="uq_child_plan_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), index=True)
    plan_date: Mapped[date] = mapped_column(Date, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    child: Mapped["Child"] = relationship(back_populates="daily_plans")
    items: Mapped[list["DailyPlanItem"]] = relationship(
        back_populates="plan", order_by="DailyPlanItem.sort_order"
    )


class DailyPlanItem(Base):
    __tablename__ = "daily_plan_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("daily_plans.id"), index=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id"), index=True)
    module_type: Mapped[str] = mapped_column(String(20))  # learn | meaning | spelling | pronunciation
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | completed
    is_review: Mapped[int] = mapped_column(Integer, default=0)  # 0=new, 1=review

    plan: Mapped["DailyPlan"] = relationship(back_populates="items")
    word: Mapped["Word"] = relationship()


from app.models.child import Child  # noqa: E402
from app.models.word import Word  # noqa: E402
