from datetime import datetime

from sqlalchemy.orm import Session

from app.models.learning import LearningAttempt
from app.models.word_mastery import WordMastery


def get_or_create_mastery(db: Session, child_id: int, word_id: int) -> WordMastery:
    mastery = (
        db.query(WordMastery)
        .filter(WordMastery.child_id == child_id, WordMastery.word_id == word_id)
        .first()
    )
    if not mastery:
        mastery = WordMastery(
            child_id=child_id,
            word_id=word_id,
            first_seen_at=datetime.utcnow(),
        )
        db.add(mastery)
        db.flush()
    return mastery


def is_word_learned(db: Session, child_id: int, word_id: int) -> bool:
    """Word counts as learned after completing 学一学, or any prior study (legacy flow)."""
    learned = (
        db.query(LearningAttempt)
        .filter(
            LearningAttempt.child_id == child_id,
            LearningAttempt.word_id == word_id,
            LearningAttempt.module_type == "learn",
            LearningAttempt.is_correct == 1,
        )
        .first()
    )
    if learned:
        return True
    return (
        db.query(LearningAttempt)
        .filter(
            LearningAttempt.child_id == child_id,
            LearningAttempt.word_id == word_id,
        )
        .first()
        is not None
    )


def get_learned_word_ids(db: Session, child_id: int) -> set[int]:
    learned_ids: set[int] = set()
    rows = (
        db.query(LearningAttempt.word_id, LearningAttempt.module_type, LearningAttempt.is_correct)
        .filter(LearningAttempt.child_id == child_id)
        .all()
    )
    for word_id, module_type, is_correct in rows:
        if module_type == "learn" and is_correct:
            learned_ids.add(word_id)
        elif module_type != "learn":
            learned_ids.add(word_id)
    return learned_ids


def ensure_word_learned(db: Session, child_id: int, word_id: int) -> None:
    from fastapi import HTTPException

    if not is_word_learned(db, child_id, word_id):
        raise HTTPException(
            status_code=403,
            detail="请先在「学一学」中学习这个单词，再来挑战吧",
        )


def update_mastery(
    db: Session,
    child_id: int,
    word_id: int,
    module_type: str,
    is_correct: bool,
    score: float = 0,
) -> WordMastery:
    """Update mastery score after an attempt."""
    mastery = get_or_create_mastery(db, child_id, word_id)
    mastery.attempt_count += 1
    mastery.last_practiced_at = datetime.utcnow()

    if is_correct:
        mastery.correct_streak += 1
    else:
        mastery.correct_streak = 0

    if module_type == "meaning":
        old = mastery.meaning_score
        if is_correct:
            mastery.meaning_score = min(100, old + 20)
        else:
            mastery.meaning_score = max(0, old - 10)
    elif module_type == "spelling":
        old = mastery.spelling_score
        if is_correct:
            mastery.spelling_score = min(100, old + 20)
        else:
            mastery.spelling_score = max(0, old - 10)
    elif module_type == "pronunciation":
        mastery.pronunciation_score = min(100, int(score))

    return mastery
