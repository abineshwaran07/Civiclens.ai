from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Scheme
from ..schemas import SchemeOut

router = APIRouter(prefix="/api/schemes", tags=["schemes"])


@router.get("", response_model=list[SchemeOut])
def list_schemes(q: str | None = None, category: str | None = None, level: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Scheme).order_by(Scheme.name)
    if category:
        stmt = stmt.where(Scheme.category == category)
    if level:
        stmt = stmt.where(Scheme.level == level)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Scheme.name.ilike(like), Scheme.name_ta.ilike(like), Scheme.department.ilike(like), Scheme.category.ilike(like)))
    return list(db.scalars(stmt))


@router.get("/{slug}", response_model=SchemeOut)
def get_scheme(slug: str, db: Session = Depends(get_db)):
    scheme = db.scalar(select(Scheme).where(Scheme.slug == slug))
    if not scheme:
        raise HTTPException(404, "Scheme not found.")
    return scheme
