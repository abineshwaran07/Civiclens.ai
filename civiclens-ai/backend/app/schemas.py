from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer

# Timestamps are stored as naive UTC; send them to the browser with an explicit Z.
UTCDateTime = Annotated[datetime, PlainSerializer(lambda d: d.isoformat() + "Z", return_type=str)]

Priority = Literal["low", "medium", "high", "urgent"]
Status = Literal["submitted", "in_review", "in_progress", "resolved", "rejected"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=6, max_length=100)
    language: Literal["en", "ta"] = "en"


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(ORM):
    id: int
    name: str
    email: str
    role: str
    preferred_language: str


class TokenOut(BaseModel):
    access_token: str
    user: UserOut


# ---------- Chat ----------
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=12)


class SourceOut(BaseModel):
    id: int
    title: str
    section: str
    department: str | None = None
    url: str | None = None
    score: float
    snippet: str


class ChatOut(BaseModel):
    answer: str
    language: Literal["en", "ta"]
    grounded: bool
    mode: Literal["gemini", "offline"]
    sources: list[SourceOut]


# ---------- Schemes ----------
class SchemeOut(ORM):
    slug: str
    name: str
    name_ta: str | None
    department: str
    level: str
    category: str
    url: str | None
    sections: dict[str, str]


# ---------- Grievances ----------
class AnalyzeIn(BaseModel):
    text: str = Field(min_length=10, max_length=3000)
    language: Literal["en", "ta"] = "en"


class AnalysisOut(BaseModel):
    title: str
    category: str
    department: str
    priority: Priority
    summary: str
    draft: str
    missing_info: list[str]
    mode: Literal["gemini", "offline"]


class GrievanceCreate(BaseModel):
    description: str = Field(min_length=10, max_length=3000)
    location: str | None = Field(default=None, max_length=200)
    language: Literal["en", "ta"] = "en"
    title: str | None = Field(default=None, max_length=200)
    category: str | None = None
    priority: Priority | None = None
    ai_summary: str | None = None
    ai_draft: str | None = None


class EventOut(ORM):
    status: str
    note: str | None
    actor_role: str
    created_at: UTCDateTime


class GrievanceOut(ORM):
    id: int
    tracking_id: str
    title: str
    description: str
    category: str
    department: str
    priority: str
    status: str
    location: str | None
    language: str
    ai_summary: str | None
    ai_draft: str | None
    created_at: UTCDateTime
    updated_at: UTCDateTime
    resolved_at: UTCDateTime | None
    events: list[EventOut]


class OfficerGrievanceOut(GrievanceOut):
    citizen_name: str = ""
    citizen_email: str = ""


class OfficerGrievancePage(BaseModel):
    items: list[OfficerGrievanceOut]
    total: int


class TrackOut(BaseModel):
    tracking_id: str
    title: str
    category: str
    department: str
    priority: str
    status: str
    created_at: UTCDateTime
    updated_at: UTCDateTime
    events: list[EventOut]


class GrievanceUpdate(BaseModel):
    status: Status | None = None
    priority: Priority | None = None
    department: str | None = Field(default=None, max_length=200)
    note: str | None = Field(default=None, max_length=1000)


# ---------- Officer: knowledge base ----------
class DocumentIn(BaseModel):
    title: str = Field(min_length=3, max_length=250)
    department: str | None = Field(default=None, max_length=200)
    url: str | None = Field(default=None, max_length=400)
    text: str = Field(min_length=50, max_length=200_000)


class DocumentSourceOut(BaseModel):
    title: str
    department: str | None
    url: str | None
    chunks: int


class IngestOut(BaseModel):
    title: str
    chunks: int
    embedded: bool
