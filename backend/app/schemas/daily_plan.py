from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.word import WordResponse


class DailyPlanItemResponse(BaseModel):
    id: int
    word_id: int
    module_type: str
    sort_order: int
    status: str
    is_review: int
    word: WordResponse

    model_config = {"from_attributes": True}


class DailyPlanResponse(BaseModel):
    id: int
    child_id: int
    plan_date: date
    items: list[DailyPlanItemResponse]
    total: int = 0
    completed: int = 0

    model_config = {"from_attributes": True}


class GeneratePlanRequest(BaseModel):
    plan_date: Optional[date] = None
    new_words: Optional[int] = Field(default=None, ge=0, le=30)
    review_words: Optional[int] = Field(default=None, ge=0, le=20)
    use_all_custom_words: bool = False
    custom_list_id: Optional[int] = Field(default=None, ge=1)
    force: bool = False


class DailyPlanItemCreate(BaseModel):
    word_id: int
    module_type: str = Field(pattern="^(meaning|spelling|pronunciation)$")
    is_review: int = 0


class DailyPlanUpdateRequest(BaseModel):
    items: list[DailyPlanItemCreate]
