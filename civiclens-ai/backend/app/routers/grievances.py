import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import Grievance, GrievanceEvent, User, utcnow
from ..schemas import AnalysisOut, AnalyzeIn, GrievanceCreate, GrievanceOut, TrackOut
from ..services import grievance_ai
from ..services.llm import get_llm

router = APIRouter(prefix="/api/grievances", tags=["grievances"])

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I to avoid read-out mistakes


def new_tracking_id(db: Session) -> str:
    while True:
        tid = f"CL-{utcnow().year}-" + "".join(secrets.choice(_ALPHABET) for _ in range(6))
        if not db.scalar(select(Grievance.id).where(Grievance.tracking_id == tid)):
            return tid


@router.post("/analyze", response_model=AnalysisOut)
def analyze(body: AnalyzeIn, user: User = Depends(get_current_user)):
    """AI grievance assistant: category, department, priority, summary and a formal draft letter."""
    return grievance_ai.analyze(get_llm(), body.text, body.language)


@router.post("", response_model=GrievanceOut, status_code=201)
def create(body: GrievanceCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    analysis = None
    if not body.category or body.category not in grievance_ai.CATEGORIES or not body.title or not body.priority:
        analysis = grievance_ai.analyze(get_llm(), body.description, body.language)
    category = body.category if body.category in grievance_ai.CATEGORIES else (analysis or {}).get("category", "Other")
    g = Grievance(
        tracking_id=new_tracking_id(db),
        user_id=user.id,
        title=(body.title or (analysis or {}).get("title") or body.description[:80]).strip(),
        description=body.description.strip(),
        category=category,
        department=grievance_ai.CATEGORIES[category],
        priority=body.priority or (analysis or {}).get("priority", "medium"),
        status="submitted",
        location=(body.location or "").strip() or None,
        language=body.language,
        ai_summary=body.ai_summary or (analysis or {}).get("summary"),
        ai_draft=body.ai_draft or (analysis or {}).get("draft"),
    )
    g.events.append(GrievanceEvent(status="submitted", note="Complaint received.", actor_role="system"))
    db.add(g)
    db.commit()
    return g


@router.get("/mine", response_model=list[GrievanceOut])
def mine(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = (
        select(Grievance)
        .where(Grievance.user_id == user.id)
        .options(selectinload(Grievance.events))
        .order_by(desc(Grievance.created_at))
    )
    return list(db.scalars(stmt))


@router.get("/track/{tracking_id}", response_model=TrackOut)
def track(tracking_id: str, db: Session = Depends(get_db)):
    """Public status lookup. Exposes progress only, never the complaint text or the citizen's identity."""
    g = db.scalar(
        select(Grievance)
        .where(Grievance.tracking_id == tracking_id.strip().upper())
        .options(selectinload(Grievance.events))
    )
    if not g:
        raise HTTPException(404, "No complaint found with this tracking ID.")
    return g
