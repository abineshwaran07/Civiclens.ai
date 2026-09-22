# CivicLens AI

**Making Digital Public Services Simple, Accessible and Multilingual for Every Citizen.**

Built for the Google hackathon track **AI for Digital Public Infrastructure & Governance**.

A citizen asks about a government scheme in Tamil or English, by voice or text, and gets an answer taken from official documents with the source shown. If no source exists, the assistant says so instead of guessing. The same app lets a citizen file a complaint (AI picks the department, sets priority and drafts the letter), track it with an ID, and lets officers manage complaints and grow the knowledge base.

## Features

| For citizens | For officers |
|---|---|
| Voice or text assistant (Tamil / English) with cited sources | Dashboard: totals, overdue, average resolution time, 14-day trend, category and priority charts |
| Browse 18 Central and Tamil Nadu schemes and services | Complaint list with search and filters, status updates and notes to the citizen |
| AI complaint assistant: category, department, priority, summary, formal draft, missing details | Knowledge base: paste text or upload PDF and it is searchable at once |
| Public tracking by ID (shows progress only, never the complaint text or identity) | Role-gated: citizens cannot call officer APIs (403) |

**How answers stay honest:** retrieval-augmented generation over verified documents only. Gemini writes the answer from retrieved passages and must cite them as `[1]`, `[2]`. Below a relevance threshold the answer is a refusal that points to the official portal.

## Architecture

```
React + Vite + Tailwind  ->  FastAPI  ->  RAG: Gemini embeddings + pgvector (Postgres)
 (voice via Web Speech)        |             or BM25 keyword search (offline demo)
                               |->  Gemini 2.5 Flash: grounded answers, complaint analysis (JSON)
                               |->  PostgreSQL / SQLite: users, schemes, chunks, grievances, events
```

Offline demo mode (no API key) runs the whole app with keyword retrieval and a rule-based complaint classifier, so it always works on stage. Add `GEMINI_API_KEY` and it switches to vector search and Gemini answers automatically.

## Run locally

Needs Python 3.11+ and Node 20+.

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # optionally add GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000
```
On first start it creates the tables, loads the 18 schemes and adds demo data.

**Frontend** (second terminal)
```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173, proxies /api to :8000
```

**Demo logins**

| Role | Email | Password |
|---|---|---|
| Citizen | citizen@civiclens.demo | Citizen@123 |
| Officer | officer@civiclens.demo | Officer@123 |

The login page has one-click buttons for both.

## Tests
```bash
cd backend && pip install -r requirements-dev.txt && python -m pytest -q
```
12 tests: retrieval and refusal, Tamil questions, auth, role gating, the full complaint lifecycle, dashboard numbers, knowledge-base upload, and the Gemini path with a fake client.

## Configuration

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Enables Gemini answers and embeddings. Empty = offline demo mode |
| `DATABASE_URL` | `sqlite:///./civiclens.db` (default) or `postgresql://user:pass@host/db` (pgvector used automatically) |
| `JWT_SECRET` | Set a long random value in production |
| `SEED_DEMO_DATA` | `false` in production (demo users have public passwords) |
| `SLA_DAYS` | Days before an open complaint counts as overdue (default 7) |

Seed manually: `python -m scripts.seed [--no-demo] [--reindex [--force]]`

## Deploy

One container serves both the API and the built React app.

```bash
# Build the frontend into the backend (writes backend/app/static)
cd frontend && npm run build

# Google Cloud Run (uses the Dockerfile at the repo root)
gcloud run deploy civiclens --source . --region asia-south1 --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=...,JWT_SECRET=...,DATABASE_URL=...,SEED_DEMO_DATA=false
```
Use Cloud SQL for PostgreSQL (enable the `vector` extension) for `DATABASE_URL`. A local Postgres stack is in `docker-compose.yml`.

## Project layout
```
backend/app/services/rag.py           retrieval, chunking, grounded answers, citations
backend/app/services/grievance_ai.py  complaint classifier and letter drafting
backend/app/routers/                  auth, chat, schemes, grievances, officer
backend/data/schemes.json             verified knowledge base (18 schemes)
frontend/src/pages/                   Home, Assistant, Schemes, Complaint, Track, MyComplaints, Officer
frontend/src/lib/i18n.tsx             English and Tamil UI strings
```

## Known limits
- Scheme data is a curated snapshot. Confirm amounts and rules on the official portal (the app says this on every page).
- Voice input uses the browser's speech recognition (Chrome, Edge, Safari). Firefox shows the text box only.
- Tamil answers in offline mode quote the English source text. With a Gemini key the answer is written in Tamil.
