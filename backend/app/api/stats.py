from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import DailyPlan, DailyPlanItem, User
from app.services.achievement_service import get_achievements
from app.services.child_access import get_child_for_user, get_current_user
from app.services.xp_service import xp_for_level, xp_to_next_level

router = APIRouter(prefix="/api/children", tags=["stats"])


class ChildStatsResponse(BaseModel):
    xp: int
    level: int
    xp_to_next: int
    xp_for_current_level: int
    streak_days: int
    today_completed: int
    today_total: int
    achievements: list[dict]


@router.get("/{child_id}/stats", response_model=ChildStatsResponse)
def child_stats(
    child_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = get_child_for_user(db, child_id, user)

    plan = (
        db.query(DailyPlan)
        .filter(DailyPlan.child_id == child.id, DailyPlan.plan_date == date.today())
        .first()
    )
    today_total = 0
    today_completed = 0
    if plan:
        items = db.query(DailyPlanItem).filter(DailyPlanItem.plan_id == plan.id).all()
        today_total = len(items)
        today_completed = sum(1 for i in items if i.status == "completed")

    achievements_list = get_achievements(db, child.id)

    return ChildStatsResponse(
        xp=child.xp,
        level=child.level,
        xp_to_next=xp_to_next_level(child.xp, child.level),
        xp_for_current_level=xp_for_level(child.level),
        streak_days=child.streak_days,
        today_completed=today_completed,
        today_total=today_total,
        achievements=achievements_list,
    )
