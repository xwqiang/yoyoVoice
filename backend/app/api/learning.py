from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import PronunciationResult, User, Word
from app.schemas.learning import (
    AchievementOut,
    GamificationData,
    LearnCardResponse,
    LearnCompleteRequest,
    LearningCheckResponse,
    MeaningCheckRequest,
    MeaningQuizResponse,
    PronunciationQuizResponse,
    PronunciationResultResponse,
    SpellingCheckRequest,
    SpellingQuizResponse,
)
from app.schemas.word import WordResponse
from app.services.azure_speech import assess_pronunciation, pronunciation_message
from app.services.child_access import get_child_for_user, get_current_user
from app.services.learning import (
    build_meaning_quiz,
    build_spelling_letters,
    record_attempt,
)
from app.services.learning_events import log_learning_event
from app.services.mastery_service import ensure_word_learned
from app.services.validators import ensure_word_in_pool, resolve_plan_item

router = APIRouter(prefix="/api/learning", tags=["learning"])


def _get_child_and_word(db: Session, user: User, child_id: int, word_id: int):
    child = get_child_for_user(db, child_id, user)
    word = ensure_word_in_pool(db, child, word_id)
    return child, word


def _build_gamification(result: dict) -> GamificationData:
    return GamificationData(
        xp_earned=result["xp_earned"],
        total_xp=result["total_xp"],
        level=result["level"],
        level_up=result["level_up"],
        xp_to_next=result["xp_to_next"],
        new_achievements=[AchievementOut(**a) for a in result["new_achievements"]],
    )


@router.get("/learn/card", response_model=LearnCardResponse)
def learn_card(
    child_id: int,
    word_id: int,
    plan_item_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child, word = _get_child_and_word(db, user, child_id, word_id)
    resolve_plan_item(db, child_id, plan_item_id, word_id, "learn", allow_completed=True)
    log_learning_event(
        db,
        child_id=child_id,
        event_type="open_learn",
        module_type="learn",
        word_id=word_id,
        plan_item_id=plan_item_id,
    )
    db.commit()
    return LearnCardResponse(
        word_id=word.id,
        word_en=word.word_en,
        meaning_zh=word.meaning_zh,
        phonetic=word.phonetic,
        example_sentence=word.example_sentence,
        plan_item_id=plan_item_id,
    )


@router.post("/learn/complete", response_model=LearningCheckResponse)
def learn_complete(body: LearnCompleteRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    child, word = _get_child_and_word(db, user, body.child_id, body.word_id)
    plan_item = resolve_plan_item(db, body.child_id, body.plan_item_id, body.word_id, "learn")
    log_learning_event(
        db,
        child_id=body.child_id,
        event_type="learn_complete",
        module_type="learn",
        word_id=body.word_id,
        is_correct=True,
        duration_ms=body.duration_ms,
        plan_item_id=body.plan_item_id,
    )
    result = record_attempt(
        db,
        body.child_id,
        body.word_id,
        "learn",
        True,
        score=100.0,
        duration_ms=body.duration_ms,
        plan_item=plan_item,
    )
    return LearningCheckResponse(
        is_correct=True,
        correct_answer=word.word_en,
        score=100.0,
        message="学会啦！⭐",
        attempt_id=result["attempt"].id,
        gamification=_build_gamification(result),
    )


@router.get("/meaning/quiz", response_model=MeaningQuizResponse)
def meaning_quiz(
    child_id: int,
    word_id: int,
    plan_item_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child, word = _get_child_and_word(db, user, child_id, word_id)
    ensure_word_learned(db, child_id, word_id)
    resolve_plan_item(db, child_id, plan_item_id, word_id, "meaning", allow_completed=True)
    options, quiz_type = build_meaning_quiz(db, child, word)
    log_learning_event(
        db,
        child_id=child_id,
        event_type="open_quiz",
        module_type="meaning",
        word_id=word_id,
        plan_item_id=plan_item_id,
        meta={"quiz_type": quiz_type},
    )
    db.commit()
    return MeaningQuizResponse(
        word_id=word.id,
        word_en=word.word_en,
        meaning_zh=word.meaning_zh,
        phonetic=word.phonetic,
        example_sentence=word.example_sentence,
        options=options,
        quiz_type=quiz_type,
        plan_item_id=plan_item_id,
        needs_teaching=False,
    )


@router.post("/meaning/check", response_model=LearningCheckResponse)
def meaning_check(body: MeaningCheckRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    child, word = _get_child_and_word(db, user, body.child_id, body.word_id)
    plan_item = resolve_plan_item(db, body.child_id, body.plan_item_id, body.word_id, "meaning")
    has_meaning = bool(word.meaning_zh and word.meaning_zh.strip())
    correct_answer = word.meaning_zh if has_meaning else word.word_en
    is_correct = body.selected_meaning.strip() == correct_answer.strip()
    log_learning_event(
        db,
        child_id=body.child_id,
        event_type="submit_answer",
        module_type="meaning",
        word_id=body.word_id,
        is_correct=is_correct,
        duration_ms=body.duration_ms,
        plan_item_id=body.plan_item_id,
    )
    result = record_attempt(
        db,
        body.child_id,
        body.word_id,
        "meaning",
        is_correct,
        score=100.0 if is_correct else 0.0,
        user_answer=body.selected_meaning,
        duration_ms=body.duration_ms,
        plan_item=plan_item,
    )
    return LearningCheckResponse(
        is_correct=is_correct,
        correct_answer=correct_answer,
        score=100.0 if is_correct else 0.0,
        message="太棒了！⭐" if is_correct else "再试一次吧～",
        attempt_id=result["attempt"].id,
        gamification=_build_gamification(result),
    )


@router.get("/spelling/quiz", response_model=SpellingQuizResponse)
def spelling_quiz(
    child_id: int,
    word_id: int,
    plan_item_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child, word = _get_child_and_word(db, user, child_id, word_id)
    ensure_word_learned(db, child_id, word_id)
    resolve_plan_item(db, child_id, plan_item_id, word_id, "spelling", allow_completed=True)
    has_meaning = bool(word.meaning_zh and word.meaning_zh.strip())
    letters, letter_count = build_spelling_letters(word)
    log_learning_event(
        db,
        child_id=child_id,
        event_type="open_quiz",
        module_type="spelling",
        word_id=word_id,
        plan_item_id=plan_item_id,
        meta={"letter_count": letter_count},
    )
    db.commit()
    return SpellingQuizResponse(
        word_id=word.id,
        word_en=word.word_en,
        letters=letters,
        letter_count=letter_count,
        meaning_zh=word.meaning_zh if has_meaning else None,
        phonetic=word.phonetic,
        example_sentence=word.example_sentence,
        prompt_type="meaning" if has_meaning else "listen",
        plan_item_id=plan_item_id,
        needs_teaching=False,
    )


@router.post("/spelling/check", response_model=LearningCheckResponse)
def spelling_check(body: SpellingCheckRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    child, word = _get_child_and_word(db, user, body.child_id, body.word_id)
    plan_item = resolve_plan_item(db, body.child_id, body.plan_item_id, body.word_id, "spelling")
    is_correct = body.spelling.strip().lower() == word.word_en.strip().lower()
    log_learning_event(
        db,
        child_id=body.child_id,
        event_type="submit_answer",
        module_type="spelling",
        word_id=body.word_id,
        is_correct=is_correct,
        duration_ms=body.duration_ms,
        plan_item_id=body.plan_item_id,
        meta={"answer_length": len(body.spelling.strip())},
    )
    result = record_attempt(
        db,
        body.child_id,
        body.word_id,
        "spelling",
        is_correct,
        score=100.0 if is_correct else 0.0,
        user_answer=body.spelling,
        duration_ms=body.duration_ms,
        plan_item=plan_item,
    )
    return LearningCheckResponse(
        is_correct=is_correct,
        correct_answer=word.word_en,
        score=100.0 if is_correct else 0.0,
        message="太棒了！⭐" if is_correct else "再试一次吧～",
        attempt_id=result["attempt"].id,
        gamification=_build_gamification(result),
    )


@router.get("/pronunciation/quiz", response_model=PronunciationQuizResponse)
def pronunciation_quiz(
    child_id: int,
    word_id: int,
    plan_item_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child, word = _get_child_and_word(db, user, child_id, word_id)
    ensure_word_learned(db, child_id, word_id)
    resolve_plan_item(db, child_id, plan_item_id, word_id, "pronunciation", allow_completed=True)
    log_learning_event(
        db,
        child_id=child_id,
        event_type="open_quiz",
        module_type="pronunciation",
        word_id=word_id,
        plan_item_id=plan_item_id,
    )
    db.commit()
    return PronunciationQuizResponse(
        word_id=word.id,
        word_en=word.word_en,
        meaning_zh=word.meaning_zh or "",
        phonetic=word.phonetic,
        example_sentence=word.example_sentence,
        plan_item_id=plan_item_id,
        needs_teaching=False,
    )


@router.post("/pronunciation", response_model=PronunciationResultResponse)
async def pronunciation_check(
    child_id: int = Form(...),
    word_id: int = Form(...),
    plan_item_id: int | None = Form(None),
    duration_ms: int | None = Form(None),
    audio: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child, word = _get_child_and_word(db, user, child_id, word_id)
    plan_item = resolve_plan_item(db, child_id, plan_item_id, word_id, "pronunciation")

    audio_bytes = await audio.read()
    scores = assess_pronunciation(word.word_en, audio_bytes, audio.filename or "audio.webm")
    score = scores["pronunciation_score"]
    is_correct = score >= 60
    log_learning_event(
        db,
        child_id=child_id,
        event_type="submit_answer",
        module_type="pronunciation",
        word_id=word_id,
        is_correct=is_correct,
        duration_ms=duration_ms,
        plan_item_id=plan_item_id,
        meta={"pronunciation_score": score},
    )

    result = record_attempt(
        db,
        child_id,
        word_id,
        "pronunciation",
        is_correct,
        score=score,
        duration_ms=duration_ms,
        plan_item=plan_item,
        commit=False,
    )

    pron_result = PronunciationResult(
        attempt_id=result["attempt"].id,
        pronunciation_score=scores["pronunciation_score"],
        accuracy_score=scores["accuracy_score"],
        fluency_score=scores["fluency_score"],
        completeness_score=scores["completeness_score"],
        prosody_score=scores.get("prosody_score"),
        detail_json=scores.get("detail_json", "{}"),
    )
    db.add(pron_result)
    db.commit()
    db.refresh(result["attempt"])

    return PronunciationResultResponse(
        is_correct=is_correct,
        pronunciation_score=scores["pronunciation_score"],
        accuracy_score=scores["accuracy_score"],
        fluency_score=scores["fluency_score"],
        completeness_score=scores["completeness_score"],
        prosody_score=scores.get("prosody_score"),
        message=pronunciation_message(score),
        attempt_id=result["attempt"].id,
        word=WordResponse.model_validate(word),
        gamification=_build_gamification(result),
    )
