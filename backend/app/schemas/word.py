from typing import Optional

from pydantic import BaseModel, Field


class WordResponse(BaseModel):
    id: int
    word_en: str
    meaning_zh: str
    phonetic: Optional[str]
    example_sentence: Optional[str]
    image_url: Optional[str]

    model_config = {"from_attributes": True}


class WordCreate(BaseModel):
    word_en: str = Field(min_length=1, max_length=100)
    meaning_zh: str = Field(default="", max_length=200)
    phonetic: Optional[str] = None
    example_sentence: Optional[str] = None
    image_url: Optional[str] = None


class CustomListCreate(BaseModel):
    child_id: int
    name: str = Field(min_length=1, max_length=100)


class CustomListUpdate(BaseModel):
    name: Optional[str] = None


class CustomListItemAdd(BaseModel):
    word_id: int


class CustomListResponse(BaseModel):
    id: int
    child_id: int
    name: str
    word_count: int = 0

    model_config = {"from_attributes": True}


class CourseResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    level: str
    word_count: int = 0

    model_config = {"from_attributes": True}
