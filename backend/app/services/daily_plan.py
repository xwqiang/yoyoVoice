import json
from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Child,
    ChildCourseProgress,
    CourseWord,
    CustomWordList,
    CustomWordListItem,
    DailyPlan,
    DailyPlanItem,
    LearningAttempt,
    Word,
)
from app.models.word_mastery import WordMastery


ASSESSMENT_MODULE_TYPES = ["meaning", "spelling", "pronunciation"]
MODULE_TYPES = ["learn", *ASSESSMENT_MODULE_TYPES]
REVIEW_INTERVALS = [1, 3, 7]


def get_child_word_pool(db: Session, child: Child) -> list[Word]:
    if child.learning_mode == "custom":
        if not child.active_custom_list_id:
            return []
        items = (
            db.query(CustomWordListItem)
            .filter(CustomWordListItem.list_id == child.active_custom_list_id)
            .order_by(CustomWordListItem.sort_order)
            .all()
        )
        word_ids = [i.word_id for i in items]
    elif child.learning_mode == "course" and child.active_course_id:
        items = (
            db.query(CourseWord)
            .filter(CourseWord.course_id == child.active_course_id)
            .order_by(CourseWord.sort_order)
            .all()
        )
        word_ids = [i.word_id for i in items]
    else:
        return []
    if not word_ids:
        return []
    words = db.query(Word).filter(Word.id.in_(word_ids)).all()
    word_map = {w.id: w for w in words}
    return [word_map[wid] for wid in word_ids if wid in word_map]


def get_pool_word_ids(db: Session, child: Child) -> set[int]:
    return {w.id for w in get_child_word_pool(db, child)}


def get_mastered_word_ids(db: Session, child: Child) -> set[int]:
    mastered: set[int] = set()
    pool_ids = get_pool_word_ids(db, child)
    if child.active_course_id:
        progress = (
            db.query(ChildCourseProgress)
            .filter(
                ChildCourseProgress.child_id == child.id,
                ChildCourseProgress.course_id == child.active_course_id,
            )
            .first()
        )
        if progress and progress.mastered_word_ids:
            try:
                mastered.update(wid for wid in json.loads(progress.mastered_word_ids) if wid in pool_ids)
            except json.JSONDecodeError:
                pass
    return mastered


def get_introduced_word_ids(db: Session, child: Child) -> set[int]:
    """Words the child has already practiced — exclude from daily 'new word' picks."""
    pool_ids = get_pool_word_ids(db, child)
    if not pool_ids:
        return set()
    rows = (
        db.query(WordMastery.word_id)
        .filter(WordMastery.child_id == child.id, WordMastery.word_id.in_(pool_ids))
        .all()
    )
    return {row[0] for row in rows}


def _word_recently_correct(db: Session, child_id: int, word_id: int, since_days: int = 7) -> bool:
    since = date.today() - timedelta(days=since_days)
    return (
        db.query(LearningAttempt)
        .filter(
            LearningAttempt.child_id == child_id,
            LearningAttempt.word_id == word_id,
            LearningAttempt.is_correct == 1,
            LearningAttempt.created_at >= since,
        )
        .first()
        is not None
    )


def _review_due_days(days_ago: int) -> bool:
    for interval in REVIEW_INTERVALS:
        if days_ago == interval:
            return True
    return False


def get_review_words(db: Session, child: Child, limit: int) -> list[Word]:
    if limit <= 0:
        return []
    pool_ids = get_pool_word_ids(db, child)
    if not pool_ids:
        return []

    today = date.today()
    candidates: list[tuple[int, Word]] = []

    wrong_attempts = (
        db.query(LearningAttempt)
        .filter(
            LearningAttempt.child_id == child.id,
            LearningAttempt.is_correct == 0,
            LearningAttempt.word_id.in_(pool_ids),
        )
        .order_by(LearningAttempt.created_at.desc())
        .all()
    )

    seen: set[int] = set()
    for attempt in wrong_attempts:
        if attempt.word_id in seen:
            continue
        if _word_recently_correct(db, child.id, attempt.word_id):
            continue
        seen.add(attempt.word_id)
        days_ago = (today - attempt.created_at.date()).days
        if not _review_due_days(days_ago):
            continue
        word = db.query(Word).filter(Word.id == attempt.word_id).first()
        if word:
            candidates.append((days_ago, word))

    candidates.sort(key=lambda x: x[0])
    return [w for _, w in candidates[:limit]]


def get_new_words(db: Session, child: Child, limit: int, exclude_ids: set[int] | None = None) -> list[Word]:
    if limit <= 0:
        return []
    pool = get_child_word_pool(db, child)
    mastered = get_mastered_word_ids(db, child)
    introduced = get_introduced_word_ids(db, child)
    skip = mastered | introduced | (exclude_ids or set())
    new_words = [w for w in pool if w.id not in skip]
    return new_words[:limit]


def generate_daily_plan(
    db: Session,
    child: Child,
    plan_date: date | None = None,
    new_words: int | None = None,
    review_words: int | None = None,
    use_all_custom_words: bool = False,
    custom_list_id: int | None = None,
    force: bool = False,
) -> DailyPlan:
    plan_date = plan_date or date.today()
    new_count = max(0, new_words if new_words is not None else child.daily_new_words)
    review_count = max(0, review_words if review_words is not None else child.daily_review_words)

    if use_all_custom_words:
        target_list_id = custom_list_id or child.active_custom_list_id
        if not target_list_id:
            raise HTTPException(status_code=400, detail="请先选择自定义词表")
        selected_list = (
            db.query(CustomWordList)
            .filter(CustomWordList.id == target_list_id, CustomWordList.child_id == child.id)
            .first()
        )
        if not selected_list:
            raise HTTPException(status_code=400, detail="所选自定义词表不存在或不属于该孩子")
        child.learning_mode = "custom"
        child.active_custom_list_id = target_list_id
        child.active_course_id = None

    pool = get_child_word_pool(db, child)
    if not pool:
        raise HTTPException(
            status_code=400,
            detail="当前没有可用词表，请先为孩子选择课程或自定义词表并添加单词",
        )

    existing = (
        db.query(DailyPlan)
        .options(joinedload(DailyPlan.items))
        .filter(DailyPlan.child_id == child.id, DailyPlan.plan_date == plan_date)
        .first()
    )

    if existing and not force:
        completed = sum(1 for i in existing.items if i.status == "completed")
        if completed > 0:
            raise HTTPException(
                status_code=400,
                detail=f"今日计划已有 {completed} 项完成，如需重新生成请使用 force=true",
            )

    if existing:
        db.query(DailyPlanItem).filter(DailyPlanItem.plan_id == existing.id).delete()
        plan = existing
    else:
        plan = DailyPlan(child_id=child.id, plan_date=plan_date)
        db.add(plan)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            plan = (
                db.query(DailyPlan)
                .filter(DailyPlan.child_id == child.id, DailyPlan.plan_date == plan_date)
                .first()
            )
            if not plan:
                raise
            db.query(DailyPlanItem).filter(DailyPlanItem.plan_id == plan.id).delete()

    if use_all_custom_words:
        review_list = []
        new_list = pool
    else:
        review_list = get_review_words(db, child, review_count)
        review_ids = {w.id for w in review_list}
        new_list = get_new_words(db, child, new_count, exclude_ids=review_ids)

    sort_order = 0
    for word in review_list:
        for module in ASSESSMENT_MODULE_TYPES:
            db.add(
                DailyPlanItem(
                    plan_id=plan.id,
                    word_id=word.id,
                    module_type=module,
                    sort_order=sort_order,
                    is_review=1,
                )
            )
            sort_order += 1

    for word in new_list:
        db.add(
            DailyPlanItem(
                plan_id=plan.id,
                word_id=word.id,
                module_type="learn",
                sort_order=sort_order,
                is_review=0,
            )
        )
        sort_order += 1
        for module in ASSESSMENT_MODULE_TYPES:
            db.add(
                DailyPlanItem(
                    plan_id=plan.id,
                    word_id=word.id,
                    module_type=module,
                    sort_order=sort_order,
                    is_review=0,
                )
            )
            sort_order += 1

    if sort_order == 0:
        raise HTTPException(
            status_code=400,
            detail="没有可安排的单词，请检查词表内容或调整新词/复习词数量",
        )

    db.commit()
    return get_plan_with_items(db, plan.id)


def get_plan_with_items(db: Session, plan_id: int) -> DailyPlan:
    return (
        db.query(DailyPlan)
        .options(joinedload(DailyPlan.items).joinedload(DailyPlanItem.word))
        .filter(DailyPlan.id == plan_id)
        .first()
    )


def get_today_plan(db: Session, child: Child) -> DailyPlan | None:
    return (
        db.query(DailyPlan)
        .options(joinedload(DailyPlan.items).joinedload(DailyPlanItem.word))
        .filter(DailyPlan.child_id == child.id, DailyPlan.plan_date == date.today())
        .first()
    )


def plan_to_response(plan: DailyPlan) -> dict:
    items = sorted(plan.items, key=lambda i: i.sort_order)
    completed = sum(1 for i in items if i.status == "completed")
    return {
        "id": plan.id,
        "child_id": plan.child_id,
        "plan_date": plan.plan_date,
        "items": items,
        "total": len(items),
        "completed": completed,
    }
