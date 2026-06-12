from typing import Optional

from pydantic import BaseModel, Field


class ChildCreate(BaseModel):
    nickname: str = Field(min_length=1, max_length=50)
    avatar_emoji: str = Field(default="🧒", max_length=10)
    grade: Optional[str] = None
    pin_code: Optional[str] = None
    daily_new_words: int = Field(default=5, ge=1, le=30)
    daily_review_words: int = Field(default=3, ge=0, le=20)


class ChildUpdate(BaseModel):
    nickname: Optional[str] = None
    avatar_emoji: Optional[str] = None
    grade: Optional[str] = None
    pin_code: Optional[str] = None
    daily_new_words: Optional[int] = Field(default=None, ge=1, le=30)
    daily_review_words: Optional[int] = Field(default=None, ge=0, le=20)


class SwitchSourceRequest(BaseModel):
    learning_mode: str = Field(pattern="^(course|custom)$")
    course_id: Optional[int] = None
    custom_list_id: Optional[int] = None


class ChildResponse(BaseModel):
    id: int
    account_id: int
    nickname: str
    avatar_emoji: str
    grade: Optional[str]
    pin_code: Optional[str]
    streak_days: int
    learning_mode: str
    active_course_id: Optional[int]
    active_custom_list_id: Optional[int]
    daily_new_words: int
    daily_review_words: int

    model_config = {"from_attributes": True}
