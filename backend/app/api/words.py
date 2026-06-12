from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models import Child, CustomWordList, CustomWordListItem, Word
from app.schemas.word import (
    CustomListCreate,
    CustomListItemAdd,
    CustomListResponse,
    CustomListUpdate,
    WordCreate,
    WordResponse,
)
from app.services.child_access import get_child_for_user, get_current_user
from app.services.word_service import bulk_get_or_create, get_or_create_word
from app.models import User

router = APIRouter(prefix="/api", tags=["words"])


@router.post("/words", response_model=WordResponse, status_code=status.HTTP_201_CREATED)
def create_word(
    body: WordCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    word = get_or_create_word(db, body)
    db.commit()
    db.refresh(word)
    return word


@router.post("/words/bulk", response_model=list[WordResponse])
def bulk_create_words(
    words: list[WordCreate],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    created = bulk_get_or_create(db, words)
    db.commit()
    for w in created:
        db.refresh(w)
    return created


@router.get("/custom-lists", response_model=list[CustomListResponse])
def list_custom_lists(
    child_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(CustomWordList)
    if child_id:
        get_child_for_user(db, child_id, user)
        q = q.filter(CustomWordList.child_id == child_id)
    else:
        child_ids = [c.id for c in db.query(Child).filter(Child.account_id == user.account_id).all()]
        q = q.filter(CustomWordList.child_id.in_(child_ids))
    lists = q.all()
    result = []
    for lst in lists:
        count = db.query(CustomWordListItem).filter(CustomWordListItem.list_id == lst.id).count()
        result.append(CustomListResponse(id=lst.id, child_id=lst.child_id, name=lst.name, word_count=count))
    return result


@router.post("/custom-lists", response_model=CustomListResponse, status_code=status.HTTP_201_CREATED)
def create_custom_list(
    body: CustomListCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = get_child_for_user(db, body.child_id, user)
    lst = CustomWordList(child_id=body.child_id, name=body.name)
    db.add(lst)
    db.commit()
    db.refresh(lst)
    child.learning_mode = "custom"
    child.active_custom_list_id = lst.id
    child.active_course_id = None
    db.commit()
    return CustomListResponse(id=lst.id, child_id=lst.child_id, name=lst.name, word_count=0)


@router.patch("/custom-lists/{list_id}", response_model=CustomListResponse)
def update_custom_list(
    list_id: int,
    body: CustomListUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lst = db.query(CustomWordList).filter(CustomWordList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="词表不存在")
    get_child_for_user(db, lst.child_id, user)
    if body.name:
        lst.name = body.name
    db.commit()
    count = db.query(CustomWordListItem).filter(CustomWordListItem.list_id == lst.id).count()
    return CustomListResponse(id=lst.id, child_id=lst.child_id, name=lst.name, word_count=count)


@router.delete("/custom-lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_custom_list(
    list_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lst = db.query(CustomWordList).filter(CustomWordList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="词表不存在")
    child = get_child_for_user(db, lst.child_id, user)
    db.query(CustomWordListItem).filter(CustomWordListItem.list_id == list_id).delete()
    db.delete(lst)
    if child.active_custom_list_id == list_id:
        child.active_custom_list_id = None
    db.commit()


@router.get("/custom-lists/{list_id}/words", response_model=list[WordResponse])
def custom_list_words(
    list_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lst = db.query(CustomWordList).filter(CustomWordList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="词表不存在")
    get_child_for_user(db, lst.child_id, user)
    items = (
        db.query(CustomWordListItem)
        .options(joinedload(CustomWordListItem.word))
        .filter(CustomWordListItem.list_id == list_id)
        .order_by(CustomWordListItem.sort_order)
        .all()
    )
    return [i.word for i in items]


@router.post("/custom-lists/{list_id}/words", response_model=WordResponse)
def add_word_to_list(
    list_id: int,
    body: CustomListItemAdd,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lst = db.query(CustomWordList).filter(CustomWordList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="词表不存在")
    get_child_for_user(db, lst.child_id, user)
    word = db.query(Word).filter(Word.id == body.word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="单词不存在")
    existing = (
        db.query(CustomWordListItem)
        .filter(CustomWordListItem.list_id == list_id, CustomWordListItem.word_id == body.word_id)
        .first()
    )
    if existing:
        return word
    max_order = (
        db.query(func.max(CustomWordListItem.sort_order))
        .filter(CustomWordListItem.list_id == list_id)
        .scalar()
    )
    item = CustomWordListItem(list_id=list_id, word_id=body.word_id, sort_order=(max_order or -1) + 1)
    db.add(item)
    db.commit()
    return word


@router.delete("/custom-lists/{list_id}/words/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_word_from_list(
    list_id: int,
    word_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lst = db.query(CustomWordList).filter(CustomWordList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="词表不存在")
    get_child_for_user(db, lst.child_id, user)
    db.query(CustomWordListItem).filter(
        CustomWordListItem.list_id == list_id, CustomWordListItem.word_id == word_id
    ).delete()
    db.commit()
