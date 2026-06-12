from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.word import WordCreate


class RecommendRequest(BaseModel):
    child_id: int
    limit: int = Field(default=5, ge=1, le=20)


class RecommendationItem(BaseModel):
    word_id: int
    word_en: str
    module: str
    reason: str
    priority: int


class RecommendResponse(BaseModel):
    recommendations: list[RecommendationItem]
    source: str = "ai"  # ai | rule


class ImportWordsRequest(BaseModel):
    text: str = Field(min_length=1)


class ImportWordsResponse(BaseModel):
    words: list[WordCreate]
    source: str = "ai"


class WeeklyReportRequest(BaseModel):
    child_id: int
    days: int = Field(default=7, ge=1, le=30)


class WeeklyReportResponse(BaseModel):
    summary: str
    strengths: list[str]
    weaknesses: list[str]
    suggested_daily_new_words: int
    suggested_daily_review_words: int
    source: str = "ai"
