from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Child, LearningAttempt
from app.models.achievement import Achievement, ACHIEVEMENT_DEFS
from app.models.word_mastery import WordMastery


def check_and_unlock(db: Session, child: Child, module_type: str) -> list[dict]:
    """Check all achievement conditions and unlock any new ones. Returns newly unlocked."""
    newly_unlocked = []

    total_mastered = (
        db.query(WordMastery)
        .filter(
            WordMastery.child_id == child.id,
            WordMastery.attempt_count > 0,
        )
        .count()
    )

    checks = [
        ("first_word", total_mastered >= 1),
        ("words_10", total_mastered >= 10),
        ("words_50", total_mastered >= 50),
        ("words_100", total_mastered >= 100),
        ("streak_3", child.streak_days >= 3),
        ("streak_7", child.streak_days >= 7),
        ("streak_30", child.streak_days >= 30),
        ("level_5", child.level >= 5),
        ("level_10", child.level >= 10),
    ]

    existing = set(
        row[0]
        for row in db.query(Achievement.achievement_type)
        .filter(Achievement.child_id == child.id)
        .all()
    )

    for achievement_type, condition in checks:
        if condition and achievement_type not in existing:
            achievement = Achievement(
                child_id=child.id,
                achievement_type=achievement_type,
                unlocked_at=datetime.utcnow(),
            )
            db.add(achievement)
            existing.add(achievement_type)
            defn = ACHIEVEMENT_DEFS.get(achievement_type, {})
            newly_unlocked.append({
                "type": achievement_type,
                "title": defn.get("title", achievement_type),
                "desc": defn.get("desc", ""),
                "emoji": defn.get("emoji", "🏅"),
            })

    return newly_unlocked


def get_achievements(db: Session, child_id: int) -> list[dict]:
    """Get all unlocked achievements for a child."""
    rows = (
        db.query(Achievement)
        .filter(Achievement.child_id == child_id)
        .order_by(Achievement.unlocked_at.desc())
        .all()
    )
    result = []
    for row in rows:
        defn = ACHIEVEMENT_DEFS.get(row.achievement_type, {})
        result.append({
            "type": row.achievement_type,
            "title": defn.get("title", row.achievement_type),
            "desc": defn.get("desc", ""),
            "emoji": defn.get("emoji", "🏅"),
            "unlocked_at": row.unlocked_at.isoformat() if row.unlocked_at else None,
        })
    return result
