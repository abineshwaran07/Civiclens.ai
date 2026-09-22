import io

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pypdf import PdfReader
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import require_officer
from ..models import DocChunk, Grievance, GrievanceEvent, User, utcnow
from ..schemas import (
    DocumentIn,
    DocumentSourceOut,
    GrievanceUpdate,
    IngestOut,
    OfficerGrievanceOut,
    OfficerGrievancePage,
)
from ..services import rag, stats
from ..services.llm import get_llm

router = APIRouter(prefix="/api/officer", tags=["officer"], dependencies=[Depends(require_officer)])


def _officer_view(g: Grievance) -> OfficerGrievanceOut:
    out = OfficerGrievanceOut.model_validate(g, from_attributes=True)
    out.citizen_name, out.citizen_email = g.user.name, g.user.email
    return out


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    return stats.overview(db)


@router.get("/grievances", response_model=OfficerGrievancePage)
def list_grievances(
    status: str | None = None,
    category: str | None = None,
    priority: str | None = None,
    q: str | None = None,
    limit: int = 25,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    filters = []
    if status:
        filters.append(Grievance.status == status)
    if category:
        filters.append(Grievance.category == category)
    if priority:
        filters.append(Grievance.priority == priority)
    if q:
        like = f"%{q.strip()}%"
        filters.append(or_(Grievance.tracking_id.ilike(like), Grievance.title.ilike(like), Grievance.description.ilike(like), Grievance.location.ilike(like)))

    total = db.scalar(select(func.count()).select_from(Grievance).where(*filters)) or 0
    rows = db.scalars(
        select(Grievance)
        .where(*filters)
        .options(selectinload(Grievance.events), selectinload(Grievance.user))
        .order_by(desc(Grievance.created_at))
        .limit(min(max(limit, 1), 100))
        .offset(max(offset, 0))
    )
    return OfficerGrievancePage(items=[_officer_view(g) for g in rows], total=total)


@router.patch("/grievances/{grievance_id}", response_model=OfficerGrievanceOut)
def update_grievance(grievance_id: int, body: GrievanceUpdate, db: Session = Depends(get_db)):
    g = db.scalar(
        select(Grievance)
        .where(Grievance.id == grievance_id)
        .options(selectinload(Grievance.events), selectinload(Grievance.user))
    )
    if not g:
        raise HTTPException(404, "Complaint not found.")
    changed = False
    if body.priority and body.priority != g.priority:
        g.priority, changed = body.priority, True
    if body.department and body.department != g.department:
        g.department, changed = body.department, True
    status_changed = bool(body.status and body.status != g.status)
    if status_changed:
        g.status = body.status  # type: ignore[assignment]
        g.resolved_at = utcnow() if body.status == "resolved" else None
    if status_changed or (body.note and body.note.strip()):
        g.events.append(
            GrievanceEvent(status=g.status, note=(body.note or "").strip() or None, actor_role="officer")
        )
        changed = True
    if changed:
        g.updated_at = utcnow()
    db.commit()
    db.refresh(g)
    return _officer_view(g)


# ----- Knowledge base -----
@router.get("/documents", response_model=list[DocumentSourceOut])
def list_documents(db: Session = Depends(get_db)):
    rows = db.execute(
        select(DocChunk.source_title, func.max(DocChunk.department), func.max(DocChunk.source_url), func.count())
        .group_by(DocChunk.source_title)
        .order_by(DocChunk.source_title)
    ).all()
    return [DocumentSourceOut(title=r[0], department=r[1], url=r[2], chunks=r[3]) for r in rows]


@router.post("/documents", response_model=IngestOut, status_code=201)
def add_document(body: DocumentIn, db: Session = Depends(get_db)):
    n, embedded = rag.ingest_document(db, get_llm(), body.title.strip(), body.department, body.url, body.text)
    return IngestOut(title=body.title, chunks=n, embedded=embedded)


@router.post("/documents/upload", response_model=IngestOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    department: str | None = Form(None),
    url: str | None = Form(None),
    db: Session = Depends(get_db),
):
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(413, "File is larger than 10 MB.")
    name = (file.filename or "").lower()
    if name.endswith(".pdf"):
        try:
            text = "\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(raw)).pages)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(400, "Could not read this PDF.") from exc
    elif name.endswith((".txt", ".md")):
        text = raw.decode("utf-8", errors="ignore")
    else:
        raise HTTPException(400, "Upload a PDF or a .txt file.")
    if len(text.strip()) < 50:
        raise HTTPException(400, "No readable text found in the file (scanned PDFs need OCR first).")
    n, embedded = rag.ingest_document(db, get_llm(), title.strip(), department, url, text)
    return IngestOut(title=title, chunks=n, embedded=embedded)
