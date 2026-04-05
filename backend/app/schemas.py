from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class SubscribeIn(BaseModel):
    email: EmailStr
    mode: Literal["simple", "normal"] = "normal"
    keywords: list[str] = Field(default_factory=list, max_length=3)


class SubscribeOut(BaseModel):
    ok: bool = True
    message: str = "Check your inbox to confirm your subscription."


class ManageUpdateIn(BaseModel):
    mode: Literal["simple", "normal"] = "normal"
    keywords: list[str] = Field(default_factory=list, max_length=3)
