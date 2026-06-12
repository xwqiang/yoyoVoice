from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.word import WordResponse


class MeaningCheckRequest(BaseModel):
    child_id: int
    word_id: int
    selected_meaning: str
    plan_item_id: Optional[int] = None
    duration_ms: Optional[int] = None


class SpellingCheckRequest(BaseModel):
    child_id: int
    word_id: int
    spelling: str
    plan_item_id: Optional[int] = None
    duration_ms: Optional[int] = None


class AchievementOut(BaseModel):
    type: str
    title: str
    desc: str
    emoji: str


class GamificationData(BaseModel):
    xp_earned: int = 0
    total_xp: int = 0
    level: int = 1
    level_up: bool = False
    xp_to_next: int = 100
    new_achievements: list[AchievementOut] = []


class LearningCheckResponse(BaseModel):
    is_correct: bool
    correct_answer: str
    score: float
    message: str
    attempt_id: int
    gamification: GamificationData = Field(default_factory=GamificationData)


class MeaningQuizResponse(BaseModel):
    word_id: int
    word_en: str
    meaning_zh: Optional[str] = None
    phonetic: Optional[str] = None
    example_sentence: Optional[str] = None
    options: list[str]
    quiz_type: str = "meaning"
    plan_item_id: Optional[int] = None
    needs_teaching: bool = False


class SpellingQuizResponse(BaseModel):
    word_id: int
    word_en: str
    letters: list[str]
    letter_count: int
    meaning_zh: Optional[str] = None
    phonetic: Optional[str] = None
    example_sentence: Optional[str] = None
    prompt_type: str = "meaning"
    plan_item_id: Optional[int] = None
    needs_teaching: bool = False


class PronunciationQuizResponse(BaseModel):
    word_id: int
    word_en: str
    meaning_zh: str
    phonetic: Optional[str]
    example_sentence: Optional[str] = None
    plan_item_id: Optional[int] = None
    needs_teaching: bool = False


class PronunciationResultResponse(BaseModel):
    is_correct: bool
    pronunciation_score: float
    accuracy_score: float
    fluency_score: float
    completeness_score: float
    prosody_score: Optional[float]
    message: str
    attempt_id: int
    word: WordResponse
    gamification: GamificationData = Field(default_factory=GamificationData)
