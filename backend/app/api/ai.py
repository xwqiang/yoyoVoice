from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Word
from app.schemas.ai import (
    ImportWordsRequest,
    ImportWordsResponse,
    RecommendRequest,
    RecommendResponse,
    WeeklyReportRequest,
    WeeklyReportResponse,
)
from app.schemas.word import WordCreate
from app.services.child_access import get_child_for_user, get_current_user
from app.services.cursor_ai import generate_weekly_report, get_recommendations, import_words_from_text
from app.services.word_service import bulk_get_or_create
from app.models import User

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(
    body: RecommendRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_child_for_user(db, body.child_id, user)
    items, source = await get_recommendations(db, body.child_id, body.limit)
    return RecommendResponse(recommendations=items, source=source)


@router.post("/import-words", response_model=ImportWordsResponse)
async def import_words(
    body: ImportWordsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    words, source = await import_words_from_text(body.text)
    return ImportWordsResponse(words=words, source=source)


@router.post("/import-words/save", response_model=list)
async def import_and_save_words(
    body: ImportWordsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    words, _ = await import_words_from_text(body.text)
    created = bulk_get_or_create(db, words)
    db.commit()
    return [{"id": w.id, "word_en": w.word_en, "meaning_zh": w.meaning_zh} for w in created]


@router.post("/weekly-report", response_model=WeeklyReportResponse)
async def weekly_report(
    body: WeeklyReportRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_child_for_user(db, body.child_id, user)
    return await generate_weekly_report(db, body.child_id, body.days)
