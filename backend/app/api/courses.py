from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models import Course, CourseWord
from app.schemas.word import CourseResponse, WordResponse
from app.services.child_access import get_current_user
from app.models import User

router = APIRouter(prefix="/api/courses", tags=["courses"])


@router.get("", response_model=list[CourseResponse])
def list_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    courses = db.query(Course).order_by(Course.sort_order).all()
    result = []
    for c in courses:
        count = db.query(CourseWord).filter(CourseWord.course_id == c.id).count()
        result.append(CourseResponse(
            id=c.id, title=c.title, description=c.description, level=c.level, word_count=count
        ))
    return result


@router.get("/{course_id}/words", response_model=list[WordResponse])
def course_words(
    course_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = (
        db.query(CourseWord)
        .options(joinedload(CourseWord.word))
        .filter(CourseWord.course_id == course_id)
        .order_by(CourseWord.sort_order)
        .all()
    )
    return [i.word for i in items]
