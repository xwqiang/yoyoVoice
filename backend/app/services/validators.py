from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models import Child, DailyPlan, DailyPlanItem, Word
from app.services.daily_plan import get_child_word_pool


def ensure_word_in_pool(db: Session, child: Child, word_id: int) -> Word:
    pool_ids = {w.id for w in get_child_word_pool(db, child)}
    if word_id not in pool_ids:
        raise HTTPException(status_code=400, detail="该单词不在当前学习计划中")
    word = db.query(Word).filter(Word.id == word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="单词不存在")
    return word


def resolve_plan_item(
    db: Session,
    child_id: int,
    plan_item_id: int | None,
    word_id: int,
    module_type: str,
    *,
    allow_completed: bool = False,
) -> DailyPlanItem | None:
    if not plan_item_id:
        return None
    item = (
        db.query(DailyPlanItem)
        .options(joinedload(DailyPlanItem.plan))
        .filter(DailyPlanItem.id == plan_item_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="学习任务不存在")
    if item.plan.child_id != child_id:
        raise HTTPException(status_code=403, detail="无权操作该学习任务")
    if item.word_id != word_id:
        raise HTTPException(status_code=400, detail="单词与学习任务不匹配")
    if item.module_type != module_type:
        raise HTTPException(status_code=400, detail="模块类型与学习任务不匹配")
    if item.status == "completed" and not allow_completed:
        raise HTTPException(status_code=400, detail="该任务已完成")
    return item
