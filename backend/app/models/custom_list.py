from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CustomWordList(Base):
    __tablename__ = "custom_word_lists"

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    child: Mapped["Child"] = relationship(
        back_populates="custom_lists",
        foreign_keys=[child_id],
    )
    items: Mapped[list["CustomWordListItem"]] = relationship(
        back_populates="word_list", order_by="CustomWordListItem.sort_order"
    )


class CustomWordListItem(Base):
    __tablename__ = "custom_word_list_items"
    __table_args__ = (UniqueConstraint("list_id", "word_id", name="uq_list_word"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    list_id: Mapped[int] = mapped_column(ForeignKey("custom_word_lists.id"), index=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id"), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    word_list: Mapped["CustomWordList"] = relationship(back_populates="items")
    word: Mapped["Word"] = relationship()


from app.models.child import Child  # noqa: E402
from app.models.word import Word  # noqa: E402
