from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import User
from app.models.roles import ROLE_PARENT
from app.schemas.auth import CreateParentRequest, ParentUserResponse
from app.services.auth import create_parent_user
from app.services.child_access import require_admin

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[ParentUserResponse])
def list_parents(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return (
        db.query(User)
        .filter(User.role == ROLE_PARENT)
        .order_by(User.created_at.desc())
        .all()
    )


@router.post("", response_model=ParentUserResponse, status_code=status.HTTP_201_CREATED)
def create_parent(
    body: CreateParentRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        return create_parent_user(
            db,
            body.username,
            body.password,
            body.display_name,
            body.account_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_parent(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id, User.role == ROLE_PARENT).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="家长账号不存在")
    db.delete(user)
    db.commit()
