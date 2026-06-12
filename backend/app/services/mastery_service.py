from datetime import datetime

from sqlalchemy.orm import Session

from app.models.word_mastery import WordMastery

TEACHING_THRESHOLD = 30


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


def needs_teaching(db: Session, child_id: int, word_id: int) -> bool:
    """Determine if teaching card should be shown before quiz."""
    mastery = (
        db.query(WordMastery)
        .filter(WordMastery.child_id == child_id, WordMastery.word_id == word_id)
        .first()
    )
    if not mastery or mastery.first_seen_at is None:
        return True
    if (
        mastery.meaning_score < TEACHING_THRESHOLD
        and mastery.spelling_score < TEACHING_THRESHOLD
        and mastery.pronunciation_score < TEACHING_THRESHOLD
    ):
        return True
    return False


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
