from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import DailyPlan, DailyPlanItem, Word
from app.schemas.daily_plan import (
    DailyPlanItemResponse,
    DailyPlanResponse,
    DailyPlanUpdateRequest,
    GeneratePlanRequest,
)
from app.schemas.word import WordResponse
from app.services.child_access import get_child_for_user, get_current_user
from app.services.daily_plan import generate_daily_plan, get_pool_word_ids, get_today_plan, plan_to_response
from app.models import User

router = APIRouter(prefix="/api/children/{child_id}/daily-plans", tags=["daily-plans"])


def _serialize_plan(plan) -> DailyPlanResponse:
    data = plan_to_response(plan)
    items = []
    for item in data["items"]:
        items.append(
            DailyPlanItemResponse(
                id=item.id,
                word_id=item.word_id,
                module_type=item.module_type,
                sort_order=item.sort_order,
                status=item.status,
                is_review=item.is_review,
                word=WordResponse.model_validate(item.word),
            )
        )
    return DailyPlanResponse(
        id=data["id"],
        child_id=data["child_id"],
        plan_date=data["plan_date"],
        items=items,
        total=data["total"],
        completed=data["completed"],
    )


@router.get("/today", response_model=DailyPlanResponse | None)
def today_plan(
    child_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = get_child_for_user(db, child_id, user)
    plan = get_today_plan(db, child)
    if not plan:
        return None
    return _serialize_plan(plan)


@router.post("/generate", response_model=DailyPlanResponse)
def generate_plan(
    child_id: int,
    body: GeneratePlanRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = get_child_for_user(db, child_id, user)
    plan = generate_daily_plan(
        db,
        child,
        plan_date=body.plan_date or date.today(),
        new_words=body.new_words,
        review_words=body.review_words,
        use_all_custom_words=body.use_all_custom_words,
        custom_list_id=body.custom_list_id,
        force=body.force,
    )
    return _serialize_plan(plan)


@router.put("/{plan_date}", response_model=DailyPlanResponse)
def update_plan(
    child_id: int,
    plan_date: date,
    body: DailyPlanUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = get_child_for_user(db, child_id, user)
    plan = (
        db.query(DailyPlan)
        .filter(DailyPlan.child_id == child.id, DailyPlan.plan_date == plan_date)
        .first()
    )
    if not plan:
        plan = DailyPlan(child_id=child.id, plan_date=plan_date)
        db.add(plan)
        db.flush()
    db.query(DailyPlanItem).filter(DailyPlanItem.plan_id == plan.id).delete()
    pool_ids = get_pool_word_ids(db, child)
    for i, item in enumerate(body.items):
        if item.word_id not in pool_ids:
            raise HTTPException(status_code=400, detail=f"单词 {item.word_id} 不在当前词表中")
        word = db.query(Word).filter(Word.id == item.word_id).first()
        if not word:
            raise HTTPException(status_code=404, detail=f"单词 {item.word_id} 不存在")
        db.add(
            DailyPlanItem(
                plan_id=plan.id,
                word_id=item.word_id,
                module_type=item.module_type,
                sort_order=i,
                is_review=item.is_review,
            )
        )
    db.commit()
    from app.services.daily_plan import get_plan_with_items
    plan = get_plan_with_items(db, plan.id)
    return _serialize_plan(plan)
