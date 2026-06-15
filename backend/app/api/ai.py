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
from app.config import settings
from app.services.cursor_ai import generate_weekly_report, get_recommendations, import_words_from_text
from app.services.word_service import bulk_get_or_create
from app.models import User

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/test-llm")
async def test_llm():
    """Debug endpoint: test Cursor SDK call end-to-end."""
    import asyncio
    from app.services.cursor_ai import _call_cursor_sdk

    errors = []
    result = None

    if settings.cursor_api_key:
        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(_call_cursor_sdk, "Say hello in one word."),
                timeout=30,
            )
        except asyncio.TimeoutError:
            errors.append("Cursor SDK timed out after 30s")
        except Exception as e:
            errors.append(f"cursor_sdk ({type(e).__name__}): {e}")

    return {
        "cursor_api_key_set": bool(settings.cursor_api_key),
        "openai_api_key_set": bool(settings.openai_api_key),
        "model": settings.cursor_model,
        "result": result,
        "errors": errors,
    }


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
