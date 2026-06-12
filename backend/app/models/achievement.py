from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Achievement(Base):
    __tablename__ = "achievements"
    __table_args__ = (UniqueConstraint("child_id", "achievement_type", name="uq_child_achievement"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), index=True)
    achievement_type: Mapped[str] = mapped_column(String(50))
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


ACHIEVEMENT_DEFS = {
    "first_word": {"title": "First Step", "desc": "Complete your first word", "emoji": "🌱"},
    "words_10": {"title": "Word Explorer", "desc": "Learn 10 words", "emoji": "🗺️"},
    "words_50": {"title": "Word Master", "desc": "Learn 50 words", "emoji": "🏆"},
    "words_100": {"title": "Word Legend", "desc": "Learn 100 words", "emoji": "👑"},
    "streak_3": {"title": "On Fire", "desc": "3-day streak", "emoji": "🔥"},
    "streak_7": {"title": "Week Warrior", "desc": "7-day streak", "emoji": "⚡"},
    "streak_30": {"title": "Month Champion", "desc": "30-day streak", "emoji": "🌟"},
    "level_5": {"title": "Rising Star", "desc": "Reach level 5", "emoji": "⭐"},
    "level_10": {"title": "Super Learner", "desc": "Reach level 10", "emoji": "🚀"},
    "perfect_session": {"title": "Perfect!", "desc": "Complete a session with no mistakes", "emoji": "💎"},
    "pronunciation_star": {"title": "Clear Voice", "desc": "Get 3 stars on pronunciation", "emoji": "🎤"},
    "spelling_ace": {"title": "Spelling Bee", "desc": "Spell 10 words correctly in a row", "emoji": "✏️"},
}
