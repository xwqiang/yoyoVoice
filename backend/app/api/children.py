from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import (
    Child,
    ChildCourseProgress,
    Course,
    CustomWordList,
    CustomWordListItem,
    DailyPlan,
    DailyPlanItem,
    LearningAttempt,
    LearningSession,
)
from app.schemas.child import ChildCreate, ChildResponse, ChildUpdate, SwitchSourceRequest
from app.schemas.word import WordResponse
from app.services.child_access import get_child_for_user, get_current_user
from app.services.daily_plan import get_child_word_pool
from app.services.mastery_service import get_learned_word_ids
from app.models import User

router = APIRouter(prefix="/api/children", tags=["children"])


def _delete_child_data(db: Session, child_id: int) -> None:
    plan_ids = [p.id for p in db.query(DailyPlan).filter(DailyPlan.child_id == child_id).all()]
    if plan_ids:
        db.query(DailyPlanItem).filter(DailyPlanItem.plan_id.in_(plan_ids)).delete(synchronize_session=False)
    db.query(DailyPlan).filter(DailyPlan.child_id == child_id).delete()
    db.query(LearningAttempt).filter(LearningAttempt.child_id == child_id).delete()
    db.query(LearningSession).filter(LearningSession.child_id == child_id).delete()
    db.query(ChildCourseProgress).filter(ChildCourseProgress.child_id == child_id).delete()
    list_ids = [l.id for l in db.query(CustomWordList).filter(CustomWordList.child_id == child_id).all()]
    if list_ids:
        db.query(CustomWordListItem).filter(CustomWordListItem.list_id.in_(list_ids)).delete(synchronize_session=False)
    db.query(CustomWordList).filter(CustomWordList.child_id == child_id).delete()


@router.get("", response_model=list[ChildResponse])
def list_children(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Child).filter(Child.account_id == user.account_id).all()


@router.post("", response_model=ChildResponse, status_code=status.HTTP_201_CREATED)
def create_child(
    body: ChildCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = Child(account_id=user.account_id, **body.model_dump())
    course = db.query(Course).order_by(Course.sort_order).first()
    if course:
        child.learning_mode = "course"
        child.active_course_id = course.id
    db.add(child)
    db.commit()
    db.refresh(child)
    return child


@router.get("/{child_id}/word-pool", response_model=list[WordResponse])
def child_word_pool(
    child_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = get_child_for_user(db, child_id, user)
    return get_child_word_pool(db, child)


@router.get("/{child_id}/learned-words")
def child_learned_words(
    child_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_child_for_user(db, child_id, user)
    return {"word_ids": sorted(get_learned_word_ids(db, child_id))}


@router.get("/{child_id}", response_model=ChildResponse)
def get_child(
    child_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_child_for_user(db, child_id, user)


@router.patch("/{child_id}", response_model=ChildResponse)
def update_child(
    child_id: int,
    body: ChildUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = get_child_for_user(db, child_id, user)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(child, k, v)
    db.commit()
    db.refresh(child)
    return child


@router.delete("/{child_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_child(
    child_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = get_child_for_user(db, child_id, user)
    _delete_child_data(db, child.id)
    db.delete(child)
    db.commit()


@router.post("/{child_id}/switch-source", response_model=ChildResponse)
def switch_source(
    child_id: int,
    body: SwitchSourceRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = get_child_for_user(db, child_id, user)
    if body.learning_mode == "course":
        if not body.course_id:
            raise HTTPException(status_code=400, detail="请选择课程")
        course = db.query(Course).filter(Course.id == body.course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="课程不存在")
        child.learning_mode = "course"
        child.active_course_id = body.course_id
        child.active_custom_list_id = None
    else:
        if not body.custom_list_id:
            raise HTTPException(status_code=400, detail="请选择自定义词表")
        lst = (
            db.query(CustomWordList)
            .filter(CustomWordList.id == body.custom_list_id, CustomWordList.child_id == child.id)
            .first()
        )
        if not lst:
            raise HTTPException(status_code=404, detail="词表不存在")
        child.learning_mode = "custom"
        child.active_custom_list_id = body.custom_list_id
        child.active_course_id = None

    # 切换学习源后，当天计划可能仍包含旧词表单词，直接清空避免学生端命中过期任务。
    today_plan = (
        db.query(DailyPlan)
        .filter(DailyPlan.child_id == child.id, DailyPlan.plan_date == date.today())
        .first()
    )
    if today_plan:
        db.query(DailyPlanItem).filter(DailyPlanItem.plan_id == today_plan.id).delete(synchronize_session=False)
        db.delete(today_plan)

    db.commit()
    db.refresh(child)
    return child
