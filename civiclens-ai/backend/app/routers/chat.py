from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import ChatIn, ChatOut
from ..services import rag
from ..services.llm import get_llm

router = APIRouter(prefix="/api", tags=["assistant"])


@router.post("/chat", response_model=ChatOut)
def chat(body: ChatIn, db: Session = Depends(get_db)):
    """Citizen assistant. Open to everyone so people can get answers without creating an account."""
    return rag.answer_question(db, get_llm(), body.message.strip(), body.history)
