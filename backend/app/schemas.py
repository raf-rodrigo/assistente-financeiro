from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models import TransactionType


class TransactionCreate(BaseModel):
    kind: TransactionType
    category: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=180)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    occurred_on: date


class TransactionRead(TransactionCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Summary(BaseModel):
    income: Decimal
    expenses: Decimal
    balance: Decimal
    unexpected: Decimal
    savings_rate: float
    month: str


class AskRequest(BaseModel):
    message: str = Field(min_length=4, max_length=1200)


class AskResponse(BaseModel):
    answer: str
    remaining_free_messages: int | None
    requires_subscription: bool = False


class SubscriptionUpdate(BaseModel):
    is_subscribed: bool


class UserRead(BaseModel):
    email: str
    email_confirmed: bool
    is_subscribed: bool
    free_limit: int
    used_this_month: int


class RegisterRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    consent_lgpd: bool


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    token: str | None = None
    email: str
    email_confirmed: bool
    message: str
    confirmation_token: str | None = None


class ConfirmEmailRequest(BaseModel):
    token: str
