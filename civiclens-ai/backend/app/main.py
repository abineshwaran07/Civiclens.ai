import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import IS_POSTGRES, SessionLocal, get_db, init_db
from .models import DocChunk, Scheme
from .routers import auth, chat, grievances, officer, schemes
from .services import rag
from .services.grievance_ai import CATEGORIES
from .services.llm import get_llm

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("civiclens")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    settings, llm = get_settings(), get_llm()
    with SessionLocal() as db:
        if settings.auto_seed:
            from scripts.seed import seed_all

            seed_all(db, llm, settings.seed_demo_data)
        if llm.available:
            n = rag.reindex_embeddings(db, llm)  # fills in vectors for chunks stored before a key was added
            if n:
                log.info("Computed embeddings for %s chunks", n)
    log.info("CivicLens API ready (mode: %s, db: %s)", llm.mode, "postgresql" if IS_POSTGRES else "sqlite")
    yield


app = FastAPI(title="CivicLens AI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, chat.router, schemes.router, grievances.router, officer.router):
    app.include_router(r)


@app.get("/api/health", tags=["meta"])
def health(db: Session = Depends(get_db)):
    llm = get_llm()
    return {
        "status": "ok",
        "mode": llm.mode,
        "database": "postgresql" if IS_POSTGRES else "sqlite",
        "schemes": db.scalar(select(func.count()).select_from(Scheme)),
        "chunks": db.scalar(select(func.count()).select_from(DocChunk)),
    }


@app.get("/api/meta", tags=["meta"])
def meta():
    return {"categories": list(CATEGORIES), "departments": CATEGORIES}


# Serve the built React app when present (single-container deployment, e.g. Cloud Run).
STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    if (STATIC_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404)
        candidate = (STATIC_DIR / full_path).resolve()
        if full_path and candidate.is_file() and str(candidate).startswith(str(STATIC_DIR.resolve())):
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
