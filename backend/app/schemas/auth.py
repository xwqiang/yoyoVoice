from datetime import datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str


class CreateParentRequest(BaseModel):
    username: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=6)
    display_name: str = Field(default="家长", max_length=100)
    account_name: str = Field(default="我的家庭", max_length=100)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    display_name: str
    account_id: int
    role: str

    model_config = {"from_attributes": True}


class ParentUserResponse(BaseModel):
    id: int
    username: str
    display_name: str
    account_id: int
    created_at: datetime

    model_config = {"from_attributes": True}
