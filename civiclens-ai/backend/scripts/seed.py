"""Seed the knowledge base and (optionally) demo users and complaints.

    python -m scripts.seed                 # schemes + demo data (per SEED_DEMO_DATA)
    python -m scripts.seed --no-demo       # schemes only (use this for a real deployment)
    python -m scripts.seed --reindex       # compute embeddings for chunks that have none (after adding a Gemini key)
"""
import argparse
import json
import random
from datetime import timedelta
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal, init_db
from app.models import Grievance, GrievanceEvent, Scheme, User, utcnow
from app.routers.grievances import new_tracking_id
from app.security import hash_password
from app.services import rag
from app.services.grievance_ai import CATEGORIES
from app.services.llm import LLM, get_llm

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "schemes.json"

DEMO_OFFICER = ("Demo Officer", "officer@civiclens.demo", "Officer@123")
DEMO_CITIZENS = [
    ("Demo Citizen", "citizen@civiclens.demo"),
    ("Murugan S", "murugan@civiclens.demo"),
    ("Kavitha R", "kavitha@civiclens.demo"),
    ("Selvam P", "selvam@civiclens.demo"),
    ("Lakshmi K", "lakshmi@civiclens.demo"),
    ("Arun Kumar", "arun@civiclens.demo"),
]
DEMO_PASSWORD = "Citizen@123"

# (category, complaint text, priority)
TEMPLATES = [
    ("Water Supply", "There has been no drinking water supply in our street for four days. Families are buying water from tankers.", "high"),
    ("Water Supply", "A pipeline is leaking near the bus stand and clean water is flowing onto the road all day.", "medium"),
    ("Water Supply", "Sewage is mixing with the drinking water line and the water smells bad. Children have stomach pain.", "urgent"),
    ("Electricity", "The street transformer makes loud noises and sparks at night. Please repair it before an accident happens.", "urgent"),
    ("Electricity", "Power cuts happen every evening for 2 to 3 hours in our ward for the last two weeks.", "high"),
    ("Electricity", "My electricity meter reading is much higher than usage. I need the meter checked.", "low"),
    ("Roads & Transport", "Large potholes on the main road near the school. Two-wheelers are slipping and people are getting hurt.", "high"),
    ("Roads & Transport", "Street lights in our lane have not worked for a month, and it is unsafe for women after dark.", "medium"),
    ("Roads & Transport", "The village bus has stopped coming to our stop. Students have to walk 4 km to reach school.", "medium"),
    ("Sanitation & Waste", "Garbage has not been collected for a week and the heap near the market is attracting stray dogs and mosquitoes.", "high"),
    ("Sanitation & Waste", "The public toilet near the bus stand is locked and dirty. Please open and clean it.", "low"),
    ("Sanitation & Waste", "Open drain in front of our houses is blocked and overflowing during rain.", "medium"),
    ("Healthcare", "The primary health centre has no doctor on duty in the afternoon. Elderly patients return without treatment.", "high"),
    ("Healthcare", "Ambulance took over one hour to reach our village during an emergency call.", "high"),
    ("Education", "Our government school has only two teachers for five classes. Children are not getting lessons.", "medium"),
    ("Education", "My daughter's scholarship amount has not been credited for six months although the college verified everything.", "medium"),
    ("Ration & PDS", "The ration shop is giving less rice than the entitled quantity and asks for extra money.", "medium"),
    ("Ration & PDS", "I applied to add my newborn to the family card two months ago and there is no update.", "low"),
    ("Pension & Welfare", "My mother's old age pension has stopped coming for three months. She is 78 and depends on it.", "high"),
    ("Pension & Welfare", "Disabled person assistance application pending for a year with no response from the office.", "medium"),
    ("Land & Revenue", "Patta name change application pending for eight months at the taluk office. Officials keep asking us to come again.", "medium"),
    ("Land & Revenue", "Someone has encroached on the common pathway to our farm land and we cannot take the tractor in.", "medium"),
    ("Police & Safety", "Group of men drink and create trouble near our street every night. We need police patrol.", "medium"),
    ("Other", "The grievance day petition I submitted at the collectorate has no reply and no acknowledgement number.", "low"),
]
PLACES = ["Erode", "Bhavani", "Perundurai", "Gobichettipalayam", "Sathyamangalam", "Coimbatore", "Salem", "Tiruppur", "Karur", "Namakkal"]
STREETS = ["Main Road", "Bus Stand Road", "Market Street", "Gandhi Nagar", "Anna Nagar", "Nehru Street", "Ward 7", "Ward 12"]


def seed_schemes(db: Session, llm: LLM) -> int:
    items = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    for item in items:
        rag.upsert_scheme(db, llm, item)
    return len(items)


def seed_demo(db: Session, count: int = 48) -> None:
    if db.scalar(select(func.count()).select_from(User)):
        return
    officer = User(name=DEMO_OFFICER[0], email=DEMO_OFFICER[1], password_hash=hash_password(DEMO_OFFICER[2]), role="officer")
    db.add(officer)
    citizens = [User(name=n, email=e, password_hash=hash_password(DEMO_PASSWORD), role="citizen") for n, e in DEMO_CITIZENS]
    db.add_all(citizens)
    db.flush()

    rng = random.Random(42)
    now = utcnow()
    for _ in range(count):
        category, text, priority = rng.choice(TEMPLATES)
        age_days = (rng.random() ** 1.4) * 30
        created = now - timedelta(days=age_days, hours=rng.randint(0, 12))
        if age_days > 10:
            status = rng.choices(["resolved", "in_progress", "in_review", "rejected"], [0.6, 0.2, 0.1, 0.1])[0]
        elif age_days > 3:
            status = rng.choices(["resolved", "in_progress", "in_review", "submitted"], [0.3, 0.3, 0.3, 0.1])[0]
        else:
            status = rng.choices(["submitted", "in_review", "in_progress"], [0.55, 0.3, 0.15])[0]

        dept = CATEGORIES[category]
        g = Grievance(
            tracking_id=new_tracking_id(db),
            user_id=rng.choice(citizens).id,
            title=text.split(".")[0][:80],
            description=text,
            category=category,
            department=dept,
            priority=priority,
            status=status,
            location=f"{rng.choice(STREETS)}, {rng.choice(PLACES)}",
            language="en",
            ai_summary=f"Citizen reports a {category.lower()} problem: {text[:120]}",
            created_at=created,
        )
        events = [("submitted", "Complaint received.", "system", created)]
        t = created
        if status != "submitted":
            t = min(now, t + timedelta(hours=rng.randint(4, 20)))
            events.append(("in_review", f"Assigned to {dept}.", "officer", t))
        if status in ("in_progress", "resolved"):
            t = min(now, t + timedelta(hours=rng.randint(20, 48)))
            events.append(("in_progress", "Field team has visited the location.", "officer", t))
        if status == "resolved":
            t = min(now, t + timedelta(hours=rng.randint(24, 120)))
            events.append(("resolved", "Issue fixed. Please confirm at the site.", "officer", t))
            g.resolved_at = t
        if status == "rejected":
            t = min(now, t + timedelta(hours=rng.randint(6, 30)))
            events.append(("rejected", "Not under this department. Please approach the local body office.", "officer", t))
        g.updated_at = t
        for st, note, actor, when in events:
            g.events.append(GrievanceEvent(status=st, note=note, actor_role=actor, created_at=when))
        db.add(g)
    db.commit()


def seed_all(db: Session, llm: LLM, demo: bool) -> None:
    if not db.scalar(select(func.count()).select_from(Scheme)):
        seed_schemes(db, llm)
    if demo:
        seed_demo(db)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-demo", action="store_true", help="skip demo users and complaints")
    parser.add_argument("--reindex", action="store_true", help="compute missing embeddings (needs GEMINI_API_KEY)")
    parser.add_argument("--force", action="store_true", help="with --reindex: recompute every embedding")
    args = parser.parse_args()

    init_db()
    llm = get_llm()
    with SessionLocal() as db:
        n = seed_schemes(db, llm)
        print(f"Schemes loaded: {n} (mode: {llm.mode})")
        if not args.no_demo and get_settings().seed_demo_data:
            seed_demo(db)
            print("Demo users and complaints ready.")
        if args.reindex:
            print("Embeddings computed:", rag.reindex_embeddings(db, llm, force=args.force))


if __name__ == "__main__":
    main()
