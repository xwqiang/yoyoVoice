from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Word
from app.schemas.word import WordCreate


def get_or_create_word(db: Session, data: WordCreate) -> Word:
    key = data.word_en.strip().lower()
    existing = db.query(Word).filter(func.lower(Word.word_en) == key).first()
    if existing:
        if data.meaning_zh and not (existing.meaning_zh or "").strip():
            existing.meaning_zh = data.meaning_zh
        if data.phonetic and not existing.phonetic:
            existing.phonetic = data.phonetic
        if data.example_sentence and not existing.example_sentence:
            existing.example_sentence = data.example_sentence
        return existing
    word = Word(**data.model_dump())
    db.add(word)
    db.flush()
    return word


def bulk_get_or_create(db: Session, items: list[WordCreate]) -> list[Word]:
    result: list[Word] = []
    for item in items:
        result.append(get_or_create_word(db, item))
    return result
