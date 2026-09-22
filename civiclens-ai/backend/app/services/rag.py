"""Retrieval-augmented generation over verified government documents.

Pipeline:  question -> (rewrite follow-ups) -> retrieve top passages -> Gemini answers ONLY from them
           -> answer + numbered sources.  If nothing relevant is found the assistant says so instead of guessing.
"""
import logging
import math
import re
from collections import Counter
from dataclasses import dataclass

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import IS_POSTGRES
from ..models import DocChunk, Scheme
from ..schemas import ChatMessage
from .llm import LLM, detect_language

log = logging.getLogger("civiclens.rag")

SECTION_LABELS = {
    "overview": "Overview",
    "benefits": "Benefits",
    "eligibility": "Eligibility",
    "how_to_apply": "How to apply",
    "documents": "Documents required",
}

NO_ANSWER = {
    "en": (
        "I could not find verified information about this in the official documents I have. "
        "Please check the official portal or visit your nearest e-Sevai centre or taluk office. "
        "If this is a problem with a service, you can file a complaint here."
    ),
    "ta": (
        "இதுபற்றி என்னிடம் உள்ள அதிகாரப்பூர்வ ஆவணங்களில் சரிபார்க்கப்பட்ட தகவல் இல்லை. "
        "அதிகாரப்பூர்வ இணையதளத்தைப் பார்க்கவும் அல்லது அருகிலுள்ள இ-சேவை மையம் அல்லது வட்டாட்சியர் அலுவலகத்தை அணுகவும். "
        "சேவை தொடர்பான பிரச்சினை என்றால் இங்கேயே புகார் அளிக்கலாம்."
    ),
}

SYSTEM_PROMPT = """You are CivicLens, a citizen assistant for Indian government schemes and services, focused on Tamil Nadu.

Rules:
1. Use ONLY the numbered context passages. Never invent amounts, dates, eligibility rules, links or phone numbers.
2. If the passages do not answer the question, say you do not have verified information and point to the official portal, the nearest e-Sevai centre or the taluk office.
3. Reply in the language of the user's question. If the user writes in Tamil, reply in simple, clear Tamil script. If English, reply in simple English.
4. Be short. Start with a one-line answer, then at most 5 bullet points starting with "- ". Use plain words that a person with little schooling can follow.
5. Put the passage number in square brackets, like [1], right after each fact it supports.
6. End with one short line reminding the user to confirm details on the official portal before applying.
7. Never ask for or repeat Aadhaar numbers, bank details or passwords.
8. Stay on public services. Politely decline unrelated topics."""

REWRITE_PROMPT = (
    "Rewrite the user's last question as one standalone English search query about Indian / Tamil Nadu government "
    "schemes, using the conversation for context. Output only the query, nothing else."
)


@dataclass
class Hit:
    chunk: DocChunk
    score: float


# ----------------------------------------------------------------------------------------------
# Text utilities
# ----------------------------------------------------------------------------------------------
_STOP = set(
    "a an the and or of to in on for with is are was were be been it this that these those what how who when where "
    "which do does did can could should would i you we they my your our from at by as about into me please tell give "
    "get much many need needed required".split()
)
_SPLIT = re.compile(r"[\s,.;:!?()\[\]{}\"'/\\|<>+=*&^%$#@~`\-–—_]+")


def tokenize(text: str) -> list[str]:
    return [t for t in _SPLIT.split(text.lower()) if t and t not in _STOP]


def split_text(text: str, size: int = 700, overlap: int = 100) -> list[str]:
    """Split a long document into overlapping passages, preferring sentence boundaries."""
    text = re.sub(r"\s+", " ", text).strip()
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            cut = max(text.rfind(". ", start, end), text.rfind("। ", start, end))
            if cut > start + size // 2:
                end = cut + 1
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


# ----------------------------------------------------------------------------------------------
# Ingestion
# ----------------------------------------------------------------------------------------------
def _embed_or_none(llm: LLM, texts: list[str]) -> list[list[float] | None]:
    if not llm.available or not texts:
        return [None] * len(texts)
    try:
        return list(llm.embed(texts))
    except Exception:  # noqa: BLE001 - never block ingestion on an embedding hiccup
        log.exception("Embedding failed; chunks stored without vectors (run reindex later)")
        return [None] * len(texts)


def upsert_scheme(db: Session, llm: LLM, data: dict) -> Scheme:
    scheme = db.scalar(select(Scheme).where(Scheme.slug == data["id"]))
    if scheme is None:
        scheme = Scheme(slug=data["id"])
        db.add(scheme)
    scheme.name = data["name"]
    scheme.name_ta = data.get("name_ta")
    scheme.department = data["department"]
    scheme.level = data["level"]
    scheme.category = data["category"]
    scheme.url = data.get("url")
    scheme.sections = data["sections"]
    db.flush()

    for old in db.scalars(select(DocChunk).where(DocChunk.scheme_id == scheme.id)):
        db.delete(old)

    header = scheme.name + (f" ({scheme.name_ta})" if scheme.name_ta else "")
    pieces = [
        (label, f"{header} — {label}: {data['sections'][key]}")
        for key, label in SECTION_LABELS.items()
        if data["sections"].get(key)
    ]
    vectors = _embed_or_none(llm, [p[1] for p in pieces])
    for (label, content), vec in zip(pieces, vectors):
        db.add(
            DocChunk(
                scheme_id=scheme.id,
                source_title=scheme.name,
                source_url=scheme.url,
                department=scheme.department,
                section=label,
                content=content,
                embedding=vec,
            )
        )
    db.commit()
    return scheme


def ingest_document(db: Session, llm: LLM, title: str, department: str | None, url: str | None, text: str) -> tuple[int, bool]:
    """Add a free-text document (for example a circular or scheme guideline) to the knowledge base."""
    for old in db.scalars(select(DocChunk).where(DocChunk.scheme_id.is_(None), DocChunk.source_title == title)):
        db.delete(old)
    pieces = split_text(text)
    vectors = _embed_or_none(llm, pieces)
    for piece, vec in zip(pieces, vectors):
        db.add(
            DocChunk(
                scheme_id=None, source_title=title, source_url=url, department=department,
                section="Document", content=piece, embedding=vec,
            )
        )
    db.commit()
    return len(pieces), all(v is not None for v in vectors)


def reindex_embeddings(db: Session, llm: LLM, force: bool = False) -> int:
    """(Re)compute embeddings, e.g. after adding a Gemini key to a database seeded offline."""
    stmt = select(DocChunk) if force else select(DocChunk).where(DocChunk.embedding.is_(None))
    chunks = list(db.scalars(stmt))
    if not chunks or not llm.available:
        return 0
    vectors = llm.embed([c.content for c in chunks])
    for c, v in zip(chunks, vectors):
        c.embedding = v
    db.commit()
    return len(chunks)


# ----------------------------------------------------------------------------------------------
# Retrieval
# ----------------------------------------------------------------------------------------------
def _vector_search(db: Session, llm: LLM, query: str, k: int) -> list[Hit] | None:
    has_vectors = db.scalar(select(func.count()).select_from(DocChunk).where(DocChunk.embedding.is_not(None)))
    if not has_vectors:
        return None
    qv = llm.embed([query], query=True)[0]
    if IS_POSTGRES:
        dist = DocChunk.embedding.cosine_distance(qv)
        rows = db.execute(
            select(DocChunk, (1 - dist).label("score"))
            .where(DocChunk.embedding.is_not(None))
            .order_by(dist)
            .limit(k)
        ).all()
        return [Hit(r[0], float(r[1])) for r in rows]
    chunks = list(db.scalars(select(DocChunk).where(DocChunk.embedding.is_not(None))))
    matrix = np.asarray([c.embedding for c in chunks], dtype=np.float32)
    sims = matrix @ np.asarray(qv, dtype=np.float32)
    order = np.argsort(-sims)[:k]
    return [Hit(chunks[i], float(sims[i])) for i in order]


def _bm25_scores(query_tokens: list[str], docs: list[list[str]], k1: float = 1.5, b: float = 0.75) -> list[float]:
    n = len(docs)
    avgdl = sum(len(d) for d in docs) / max(n, 1)
    df: Counter = Counter()
    for d in docs:
        df.update(set(d))
    scores = []
    for d in docs:
        tf = Counter(d)
        s = 0.0
        for t in set(query_tokens):
            if t in tf:
                idf = math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))
                s += idf * tf[t] * (k1 + 1) / (tf[t] + k1 * (1 - b + b * len(d) / max(avgdl, 1)))
        scores.append(s)
    return scores


# Question intent -> the section label it is probably about. Used only to *rank* passages, never to decide
# whether a passage is relevant at all (otherwise "what documents are needed for a visa" would match).
_INTENTS = [
    ("benefits", re.compile(r"how much|amount|money|benefit|rupees|\brs\b|receive|payment|instal|\bgive[sn]?\b|provide|\boffer|\bget\b|பலன்|(?<!உரிமைத் )தொகை|எவ்வளவு", re.I)),
    ("eligibility", re.compile(r"eligib|who can|qualif|criteria|தகுதி|யார்", re.I)),
    ("apply", re.compile(r"(?<!who can )\bapply|application|register|registration|enrol|how to get|process|(?<!யார் )விண்ணப்ப|எப்படி", re.I)),
    ("documents", re.compile(r"document|papers|proof|bring|ஆவண", re.I)),
]
# Section label (as stored on each chunk) that answers each intent.
_INTENT_SECTION = {"benefits": "benefits", "eligibility": "eligibility", "apply": "how to apply", "documents": "documents required"}
_SECTION_BOOST = 3.0  # larger than the usual BM25 spread between sections of one scheme
_LABEL_TOKENS = {"benefits", "benefit", "eligibility", "eligible", "apply", "application", "documents", "document", "overview", "how"}


def _lexical_search(db: Session, query: str, k: int) -> list[Hit]:
    chunks = list(db.scalars(select(DocChunk)))
    if not chunks:
        return []
    docs = [tokenize(c.content) for c in chunks]
    q_tokens = [t for t in tokenize(query) if t not in _LABEL_TOKENS]
    intent_tokens = [label for label, rx in _INTENTS if rx.search(query)]
    base = _bm25_scores(q_tokens, docs)
    boost = _bm25_scores(intent_tokens, docs) if intent_tokens else [0.0] * len(chunks)
    wanted = {_INTENT_SECTION[i] for i in intent_tokens}
    for i, c in enumerate(chunks):
        if (c.section or "").strip().lower() in wanted:
            boost[i] += _SECTION_BOOST
    floor = get_settings().min_lexical_score
    ranked = sorted((i for i in range(len(chunks)) if base[i] >= floor), key=lambda i: -(base[i] + boost[i]))
    return [Hit(chunks[i], base[i] + boost[i]) for i in ranked[:k]]


def retrieve(db: Session, llm: LLM, query: str, k: int | None = None) -> list[Hit]:
    s = get_settings()
    k = k or s.top_k
    if llm.available:
        try:
            hits = _vector_search(db, llm, query, k)
            if hits is not None:
                return [h for h in hits if h.score >= s.min_vector_score]
        except Exception:  # noqa: BLE001
            log.exception("Vector search failed, using keyword search")
    return _lexical_search(db, query, k)


# ----------------------------------------------------------------------------------------------
# Answering
# ----------------------------------------------------------------------------------------------
def _body(chunk: DocChunk) -> str:
    if chunk.scheme_id and ": " in chunk.content:
        return chunk.content.split(": ", 1)[1]
    return chunk.content


def _source_out(idx: int, h: Hit) -> dict:
    body = _body(h.chunk)
    return {
        "id": idx,
        "title": h.chunk.source_title,
        "section": h.chunk.section,
        "department": h.chunk.department,
        "url": h.chunk.source_url,
        "score": round(h.score, 3),
        "snippet": body[:240] + ("…" if len(body) > 240 else ""),
    }


def _extractive_answer(hits: list[Hit]) -> str:
    lines = ["Here is what the official documents say:"]
    for i, h in enumerate(hits[:2], 1):
        lines.append(f"- **{h.chunk.source_title}, {h.chunk.section}:** {_body(h.chunk)} [{i}]")
    return "\n".join(lines)


def _rewrite_query(llm: LLM, question: str, history: list[ChatMessage]) -> str:
    if not history or not llm.available:
        return question
    convo = "\n".join(f"{m.role}: {m.content}" for m in history[-6:])
    try:
        out = llm.generate(f"{REWRITE_PROMPT}\n\nConversation:\n{convo}\nuser: {question}", temperature=0.0)
        return out.strip().splitlines()[0][:300] or question
    except Exception:  # noqa: BLE001
        return question


def answer_question(db: Session, llm: LLM, question: str, history: list[ChatMessage]) -> dict:
    lang = detect_language(question)
    query = _rewrite_query(llm, question, history)
    hits = retrieve(db, llm, query)

    if not hits:
        return {"answer": NO_ANSWER[lang], "language": lang, "grounded": False, "mode": llm.mode, "sources": []}

    mode = llm.mode
    text: str | None = None
    if llm.available:
        ctx = "\n\n".join(
            f"[{i}] {h.chunk.source_title} — {h.chunk.section} (official source: {h.chunk.source_url or 'n/a'})\n{h.chunk.content}"
            for i, h in enumerate(hits, 1)
        )
        convo = "\n".join(f"{m.role}: {m.content}" for m in history[-6:]) or "(none)"
        prompt = f"Context passages:\n{ctx}\n\nConversation so far:\n{convo}\n\nCurrent question: {question}"
        try:
            text = llm.generate(prompt, system=SYSTEM_PROMPT)
        except Exception:  # noqa: BLE001
            log.exception("Gemini answer failed; falling back to extractive answer")
    if not text:
        text, mode = _extractive_answer(hits), "offline"

    cited = []
    for m in re.finditer(r"\[(\d+)\]", text):
        n = int(m.group(1))
        if 1 <= n <= len(hits) and n not in cited:
            cited.append(n)
    chosen = cited or list(range(1, min(len(hits), 3) + 1))
    sources = [_source_out(n, hits[n - 1]) for n in chosen]
    return {"answer": text, "language": lang, "grounded": True, "mode": mode, "sources": sources}
