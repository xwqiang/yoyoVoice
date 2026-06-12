import random
from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Child, DailyPlanItem, LearningAttempt, LearningSession, Word
from app.services.daily_plan import get_child_word_pool
from app.services.mastery_service import update_mastery
from app.services.xp_service import award_xp
from app.services.achievement_service import check_and_unlock


def get_or_create_session(db: Session, child_id: int) -> LearningSession:
    today = date.today()
    session = (
        db.query(LearningSession)
        .filter(
            LearningSession.child_id == child_id,
            func.date(LearningSession.started_at) == today,
        )
        .order_by(LearningSession.id.desc())
        .first()
    )
    if not session:
        session = LearningSession(child_id=child_id)
        db.add(session)
        db.flush()
    return session


def record_attempt(
    db: Session,
    child_id: int,
    word_id: int,
    module_type: str,
    is_correct: bool,
    score: float,
    user_answer: str | None = None,
    duration_ms: int | None = None,
    plan_item_id: int | None = None,
    plan_item: DailyPlanItem | None = None,
    commit: bool = True,
) -> dict:
    """Record attempt and return gamification data alongside the attempt."""
    session = get_or_create_session(db, child_id)
    attempt = LearningAttempt(
        session_id=session.id,
        child_id=child_id,
        word_id=word_id,
        module_type=module_type,
        is_correct=1 if is_correct else 0,
        score=score,
        user_answer=user_answer,
        duration_ms=duration_ms,
    )
    db.add(attempt)

    item_completed = False
    if is_correct and plan_item:
        plan_item.status = "completed"
        item_completed = True
    elif is_correct and plan_item_id:
        item = db.query(DailyPlanItem).filter(DailyPlanItem.id == plan_item_id).first()
        if item:
            item.status = "completed"
            item_completed = True

    if is_correct and item_completed:
        _update_streak(db, child_id)

    update_mastery(db, child_id, word_id, module_type, is_correct, score)

    xp_data = {"xp_earned": 0, "level_up": False, "level": 1, "total_xp": 0, "xp_to_next": 100}
    new_achievements: list[dict] = []

    if is_correct:
        child = db.query(Child).filter(Child.id == child_id).first()
        if child:
            xp_data = award_xp(db, child, module_type)
            new_achievements = check_and_unlock(db, child, module_type)

    if commit:
        db.commit()
        db.refresh(attempt)
    else:
        db.flush()

    return {
        "attempt": attempt,
        "xp_earned": xp_data["xp_earned"],
        "total_xp": xp_data["total_xp"],
        "level": xp_data["level"],
        "level_up": xp_data["level_up"],
        "xp_to_next": xp_data["xp_to_next"],
        "new_achievements": new_achievements,
    }


def _update_streak(db: Session, child_id: int) -> None:
    child = db.query(Child).filter(Child.id == child_id).first()
    if not child:
        return
    today_str = date.today().isoformat()
    if child.last_study_date == today_str:
        return
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    if child.last_study_date == yesterday:
        child.streak_days += 1
    else:
        child.streak_days = 1
    child.last_study_date = today_str


def _has_meaning(word: Word) -> bool:
    return bool(word.meaning_zh and word.meaning_zh.strip())


def _pool_words_except(db: Session, child: Child, word: Word) -> list[Word]:
    pool = get_child_word_pool(db, child)
    return [w for w in pool if w.id != word.id]


def get_distractor_words(db: Session, child: Child, word: Word, count: int = 3) -> list[str]:
    # 先从孩子当前词池找干扰项，再从全局词库补齐，避免出现“选项1/2/3”占位词。
    pool_others = [
        w for w in _pool_words_except(db, child, word) if w.meaning_zh and w.meaning_zh != word.meaning_zh
    ]
    random.shuffle(pool_others)
    meanings: list[str] = []
    seen: set[str] = set()

    for w in pool_others:
        meaning = (w.meaning_zh or "").strip()
        if not meaning or meaning in seen:
            continue
        seen.add(meaning)
        meanings.append(meaning)
        if len(meanings) >= count:
            return meanings

    global_candidates = (
        db.query(Word)
        .filter(
            Word.id != word.id,
            Word.meaning_zh.isnot(None),
            Word.meaning_zh != "",
            Word.meaning_zh != word.meaning_zh,
        )
        .order_by(func.random())
        .limit(50)
        .all()
    )
    for w in global_candidates:
        meaning = (w.meaning_zh or "").strip()
        if not meaning or meaning in seen:
            continue
        seen.add(meaning)
        meanings.append(meaning)
        if len(meanings) >= count:
            break

    return meanings


def get_distractor_en_words(db: Session, child: Child, word: Word, count: int = 3) -> list[str]:
    pool_others = _pool_words_except(db, child, word)
    random.shuffle(pool_others)
    names: list[str] = []
    seen: set[str] = set()

    for w in pool_others:
        name = (w.word_en or "").strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        names.append(name)
        if len(names) >= count:
            return names

    global_candidates = (
        db.query(Word)
        .filter(
            Word.id != word.id,
            Word.word_en.isnot(None),
            Word.word_en != "",
        )
        .order_by(func.random())
        .limit(50)
        .all()
    )
    for w in global_candidates:
        name = (w.word_en or "").strip()
        key = name.lower()
        if not name or key in seen:
            continue
        seen.add(key)
        names.append(name)
        if len(names) >= count:
            break

    return names


def build_spelling_letters(word: Word) -> tuple[list[str], int]:
    """Return shuffled letter tiles and the target word length for 拼一拼."""
    letters = [c.lower() for c in word.word_en.strip() if c.isalpha()]
    if not letters:
        letters = list(word.word_en.strip().lower())
    shuffled = letters.copy()
    random.shuffle(shuffled)
    if shuffled == letters and len(set(letters)) > 1:
        random.shuffle(shuffled)
    return shuffled, len(letters)


def build_meaning_quiz(db: Session, child: Child, word: Word) -> tuple[list[str], str]:
    if _has_meaning(word):
        distractors = get_distractor_words(db, child, word, 3)
        if len(distractors) >= 3:
            options = distractors + [word.meaning_zh]
            random.shuffle(options)
            return options, "meaning"
        # 干扰释义不足时降级为英文识别，避免给到占位选项。
    distractors = get_distractor_en_words(db, child, word, 3)
    options = distractors + [word.word_en]
    random.shuffle(options)
    return options, "recognition"


def get_wrong_attempt_count(db: Session, child_id: int, word_id: int, module_type: str) -> int:
    return (
        db.query(LearningAttempt)
        .filter(
            LearningAttempt.child_id == child_id,
            LearningAttempt.word_id == word_id,
            LearningAttempt.module_type == module_type,
            LearningAttempt.is_correct == 0,
        )
        .count()
    )


def get_child_stats(db: Session, child_id: int, days: int = 14) -> dict:
    since = date.today() - timedelta(days=days)
    pool_ids = None
    child = db.query(Child).filter(Child.id == child_id).first()
    if child:
        pool_ids = {w.id for w in get_child_word_pool(db, child)}

    attempts = (
        db.query(LearningAttempt)
        .filter(
            LearningAttempt.child_id == child_id,
            func.date(LearningAttempt.created_at) >= since,
        )
        .all()
    )
    if pool_ids is not None:
        attempts = [a for a in attempts if a.word_id in pool_ids]

    by_word: dict[int, dict] = {}
    by_module: dict[str, dict] = {}
    for a in attempts:
        by_word.setdefault(a.word_id, {"total": 0, "correct": 0, "modules": {}})
        by_word[a.word_id]["total"] += 1
        if a.is_correct:
            by_word[a.word_id]["correct"] += 1
        by_word[a.word_id]["modules"][a.module_type] = by_word[a.word_id]["modules"].get(
            a.module_type, {"total": 0, "correct": 0}
        )
        by_word[a.word_id]["modules"][a.module_type]["total"] += 1
        if a.is_correct:
            by_word[a.word_id]["modules"][a.module_type]["correct"] += 1

        by_module.setdefault(a.module_type, {"total": 0, "correct": 0})
        by_module[a.module_type]["total"] += 1
        if a.is_correct:
            by_module[a.module_type]["correct"] += 1

    return {"by_word": by_word, "by_module": by_module, "total_attempts": len(attempts)}


def rule_based_recommendations(db: Session, child_id: int, limit: int = 5) -> list[dict]:
    stats = get_child_stats(db, child_id)
    weak: list[tuple[float, int, str]] = []
    for word_id, data in stats["by_word"].items():
        for module, mdata in data["modules"].items():
            mrate = mdata["correct"] / mdata["total"] if mdata["total"] else 0
            if mrate < 0.7:
                weak.append((mrate, word_id, module))
    weak.sort(key=lambda x: x[0])
    results = []
    seen = set()
    for _, word_id, module in weak:
        key = (word_id, module)
        if key in seen:
            continue
        seen.add(key)
        word = db.query(Word).filter(Word.id == word_id).first()
        if word:
            results.append(
                {
                    "word_id": word_id,
                    "word_en": word.word_en,
                    "module": module,
                    "reason": f"近期{module}正确率较低",
                    "priority": len(results) + 1,
                }
            )
        if len(results) >= limit:
            break
    return results
