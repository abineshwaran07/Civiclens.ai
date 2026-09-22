import numpy as np
from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.models import DocChunk
from app.services import grievance_ai, rag
from app.services.llm import LLM


def test_health_and_seed(client):
    r = client.get("/api/health").json()
    assert r["status"] == "ok" and r["mode"] == "offline"
    assert r["schemes"] == 18 and r["chunks"] >= 80


def test_scheme_list_and_filter(client):
    all_ = client.get("/api/schemes").json()
    assert len(all_) == 18
    health = client.get("/api/schemes", params={"category": "Health"}).json()
    assert {s["slug"] for s in health} == {"pm-jay", "cmchis"}
    assert client.get("/api/schemes/pm-kisan").json()["sections"]["benefits"].startswith("Rs 6,000")
    assert client.get("/api/schemes/nope").status_code == 404


def test_chat_grounded_answer_with_sources(client):
    r = client.post("/api/chat", json={"message": "How much money does PM-KISAN give to farmers?"}).json()
    assert r["grounded"] is True
    assert "6,000" in r["answer"]
    assert r["sources"][0]["title"].startswith("PM-KISAN")
    assert r["sources"][0]["url"] == "https://pmkisan.gov.in"


def test_chat_ranks_sections_by_question_intent(client):
    """The home-page sample questions must surface the section that actually answers them."""
    cases = {
        "What does PM-KISAN give and who can apply?": {"Benefits", "Eligibility"},
        "Documents needed for an Ayushman card": {"Documents required"},
        "மகளிர் உரிமைத் தொகைக்கு யார் விண்ணப்பிக்கலாம்?": {"Eligibility"},
        "குடும்ப அட்டையில் உறுப்பினரைச் சேர்ப்பது எப்படி?": {"How to apply"},
    }
    for question, expected in cases.items():
        r = client.post("/api/chat", json={"message": question}).json()
        top_sections = {s["section"] for s in r["sources"][:2]}
        assert expected <= top_sections, (question, top_sections)


def test_chat_tamil_question(client):
    r = client.post("/api/chat", json={"message": "புதுமைப் பெண் திட்டம் பற்றி சொல்லுங்கள்"}).json()
    assert r["language"] == "ta" and r["grounded"] is True
    assert any("Pudhumai Penn" in s["title"] for s in r["sources"])


def test_chat_refuses_when_no_source(client):
    r = client.post("/api/chat", json={"message": "Who won the cricket world cup?"}).json()
    assert r["grounded"] is False and r["sources"] == []
    assert "could not find verified information" in r["answer"]


def test_auth_flow(client):
    body = {"name": "Test User", "email": "Test.User@example.com", "password": "secret1", "language": "ta"}
    r = client.post("/api/auth/register", json=body)
    assert r.status_code == 201 and r.json()["user"]["role"] == "citizen"
    assert client.post("/api/auth/register", json=body).status_code == 409
    assert client.post("/api/auth/login", json={"email": "test.user@example.com", "password": "bad"}).status_code == 401
    token = r.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["email"] == "test.user@example.com"
    assert client.get("/api/auth/me").status_code == 401


def test_grievance_analysis_offline():
    llm = LLM()
    out = grievance_ai.analyze(llm, "Garbage has not been collected for a week and mosquitoes are spreading", "en")
    assert out["category"] == "Sanitation & Waste" and out["mode"] == "offline"
    out = grievance_ai.analyze(llm, "A live wire is hanging low on our street after the storm", "en")
    assert out["priority"] == "urgent" and out["category"] == "Electricity"
    out = grievance_ai.analyze(llm, "எங்கள் தெருவில் குடிநீர் வரவில்லை", "ta")
    assert out["category"] == "Water Supply" and out["missing_info"][0].startswith("எந்த")


def test_full_grievance_lifecycle(client, citizen, officer):
    text = "There is a big pothole on the main road near the school and two-wheelers keep slipping."
    assert client.post("/api/grievances/analyze", json={"text": text}).status_code == 401
    analysis = client.post("/api/grievances/analyze", json={"text": text}, headers=citizen).json()
    assert analysis["category"] == "Roads & Transport"
    before = client.get("/api/officer/stats", headers=officer).json()

    created = client.post(
        "/api/grievances",
        json={"description": text, "location": "Main Road, Erode", "title": analysis["title"], "category": analysis["category"], "priority": "high"},
        headers=citizen,
    )
    assert created.status_code == 201
    g = created.json()
    assert g["tracking_id"].startswith("CL-") and g["status"] == "submitted" and g["events"][0]["status"] == "submitted"

    # Public tracking shows progress but never the complaint text.
    tracked = client.get(f"/api/grievances/track/{g['tracking_id'].lower()}").json()
    assert tracked["status"] == "submitted" and "description" not in tracked
    assert client.get("/api/grievances/track/CL-0000-NOPE").status_code == 404

    mine = client.get("/api/grievances/mine", headers=citizen).json()
    assert any(x["tracking_id"] == g["tracking_id"] for x in mine)

    # Role protection
    assert client.get("/api/officer/stats", headers=citizen).status_code == 403
    assert client.get("/api/officer/stats").status_code == 401

    page = client.get("/api/officer/grievances", params={"q": g["tracking_id"]}, headers=officer).json()
    assert page["total"] == 1 and page["items"][0]["citizen_name"] == "Demo Citizen"

    upd = client.patch(
        f"/api/officer/grievances/{g['id']}", json={"status": "resolved", "note": "Pothole filled."}, headers=officer
    )
    assert upd.status_code == 200 and upd.json()["status"] == "resolved" and upd.json()["resolved_at"]

    tracked = client.get(f"/api/grievances/track/{g['tracking_id']}").json()
    assert tracked["status"] == "resolved" and tracked["events"][-1]["note"] == "Pothole filled."
    after = client.get("/api/officer/stats", headers=officer).json()
    assert after["total"] == before["total"] + 1 and after["resolved"] == before["resolved"] + 1
    assert len(after["trend"]) == 14


def test_demo_data_dashboard(client, officer):
    s = client.get("/api/officer/stats", headers=officer).json()
    assert s["total"] >= 48 and s["by_category"] and s["avg_resolution_hours"] is not None
    page = client.get("/api/officer/grievances", params={"status": "resolved", "limit": 5}, headers=officer).json()
    assert page["total"] > 0 and len(page["items"]) <= 5


def test_officer_can_extend_knowledge_base(client, officer, citizen):
    doc = {
        "title": "Blue Moon Farmers Grant Circular",
        "department": "Agriculture Department",
        "url": "https://example.org/blue-moon",
        "text": "The Blue Moon Farmers Grant gives Rs 4,000 every quarter to small farmers who grow millets. "
        "Farmers must apply at the block agriculture office with land records and a bank passbook. " * 2,
    }
    assert client.post("/api/officer/documents", json=doc, headers=citizen).status_code == 403
    r = client.post("/api/officer/documents", json=doc, headers=officer)
    assert r.status_code == 201 and r.json()["chunks"] >= 1
    chat = client.post("/api/chat", json={"message": "blue moon grant amount per quarter"}).json()
    assert chat["grounded"] and chat["sources"][0]["title"] == doc["title"]

    up = client.post(
        "/api/officer/documents/upload",
        data={"title": "Uploaded Circular"},
        files={"file": ("c.txt", ("Solar pump subsidy circular. " * 10).encode(), "text/plain")},
        headers=officer,
    )
    assert up.status_code == 201
    titles = [d["title"] for d in client.get("/api/officer/documents", headers=officer).json()]
    assert "Uploaded Circular" in titles and "Blue Moon Farmers Grant Circular" in titles


class FakeGemini(LLM):
    """Deterministic stand-in for Gemini so the vector-search + generation path can be tested offline."""

    def __init__(self):
        self.settings = get_settings()
        self.available = True

    def embed(self, texts, query=False):
        out = []
        for t in texts:
            v = np.zeros(64, dtype=np.float32)
            for tok in rag.tokenize(t):
                v[hash(tok) % 64] += 1.0
            out.append((v / (np.linalg.norm(v) or 1)).tolist())
        return out

    def generate(self, prompt, system=None, json_mode=False, temperature=0.2):
        assert "ONLY the numbered context passages" in (system or "") or "Rewrite" in prompt
        return "PM-KISAN gives Rs 6,000 a year in three instalments. [1]"


def test_gemini_path_uses_vectors_and_citations(monkeypatch):
    monkeypatch.setattr(get_settings(), "min_vector_score", 0.05)
    llm = FakeGemini()
    with SessionLocal() as db:
        assert rag.reindex_embeddings(db, llm, force=True) > 80
        res = rag.answer_question(db, llm, "how much does pm-kisan give", [])
        assert res["mode"] == "gemini" and res["grounded"]
        assert "[1]" in res["answer"] and len(res["sources"]) == 1 and res["sources"][0]["id"] == 1
        for c in db.scalars(select(DocChunk)):
            c.embedding = None  # restore offline state for other tests
        db.commit()
