"""AI grievance assistant: turns a citizen's free-text complaint into a structured, routable one."""
import logging
import re

from .llm import LLM, detect_language

log = logging.getLogger("civiclens.grievance")

# Category -> department that normally handles it.
CATEGORIES: dict[str, str] = {
    "Water Supply": "Water Supply & Drainage",
    "Electricity": "Electricity Board",
    "Roads & Transport": "Highways & Public Works",
    "Sanitation & Waste": "Municipal Administration / Sanitation",
    "Healthcare": "Health & Family Welfare",
    "Education": "School Education",
    "Ration & PDS": "Civil Supplies (Public Distribution)",
    "Pension & Welfare": "Social Welfare",
    "Land & Revenue": "Revenue Department",
    "Police & Safety": "Police (Law & Order)",
    "Other": "District Collectorate - Grievance Cell",
}
PRIORITIES = ["low", "medium", "high", "urgent"]

# English + Tamil keywords for the offline classifier.
_KEYWORDS: dict[str, list[str]] = {
    "Water Supply": ["water", "tap", "drinking water", "pipeline", "borewell", "drainage", "sewage", "குடிநீர்", "தண்ணீர்", "குழாய்", "கழிவுநீர்"],
    "Electricity": ["electric", "power cut", "power", "current", "wire", "pole", "transformer", "voltage", "meter", "eb ", "மின்சாரம்", "மின்தடை", "மின்", "மின்கம்பம்"],
    "Roads & Transport": ["road", "pothole", "bus", "street light", "streetlight", "bridge", "traffic", "சாலை", "குழி", "பேருந்து", "தெருவிளக்கு", "பாலம்"],
    "Sanitation & Waste": ["garbage", "waste", "sanitation", "sweeping", "mosquito", "dump", "toilet", "குப்பை", "சுகாதாரம்", "கொசு", "கழிப்பறை"],
    "Healthcare": ["hospital", "doctor", "medicine", "clinic", "ambulance", "health centre", "nurse", "மருத்துவமனை", "மருத்துவர்", "மருந்து", "ஆம்புலன்ஸ்"],
    "Education": ["school", "teacher", "college", "scholarship", "student", "exam", "பள்ளி", "ஆசிரியர்", "கல்லூரி", "மாணவர்", "உதவித்தொகை"],
    "Ration & PDS": ["ration", "fair price", "family card", "rice", "pds", "ரேஷன்", "குடும்ப அட்டை", "அரிசி", "நியாய விலை"],
    "Pension & Welfare": ["pension", "old age", "widow", "disabled", "welfare", "assistance", "ஓய்வூதியம்", "முதியோர்", "விதவை", "உதவித் தொகை"],
    "Land & Revenue": ["patta", "land", "chitta", "survey", "encroachment", "certificate", "vao", "பட்டா", "நிலம்", "சிட்டா", "ஆக்கிரமிப்பு", "சான்றிதழ்"],
    "Police & Safety": ["police", "theft", "harass", "violence", "safety", "threat", "illegal", "காவல்", "திருட்டு", "மிரட்டல்", "பாதுகாப்பு"],
}
_URGENT = ["live wire", "electric shock", "fire", "accident", "collapsed", "flood", "overflowing", "unconscious", "தீ விபத்து", "விபத்து", "மின்கசிவு", "வெள்ளம்"]
_HIGH = ["days", "weeks", "months", "children", "elderly", "old age", "pregnant", "sick", "நாட்களாக", "வாரங்களாக", "குழந்தை", "முதியவர்", "நோய்"]

SYSTEM_PROMPT = f"""You help citizens of Tamil Nadu file complaints with the government.
Read the citizen's complaint (English or Tamil) and return ONLY a JSON object with these keys:
- "title": short English title, max 80 characters
- "category": exactly one of {list(CATEGORIES)}
- "priority": one of low, medium, high, urgent.
    urgent = danger to life, health or safety right now (live wires, accidents, contaminated water causing illness, medical emergency)
    high = essential service (water, power, food, health) disrupted for days, or vulnerable people affected
    medium = normal service problem   low = suggestion or minor inconvenience
- "summary": 1-2 plain English sentences for the officer
- "draft": a polite, formal complaint letter in English (3-6 sentences) addressed to "The Officer-in-charge", using only facts the citizen gave. Do not invent names, dates or numbers.
- "missing_info": up to 3 short questions about details that would help the officer act (exact location, since when, landmark). Write them in the same language as the citizen. Use [] if nothing is missing.
Never include Aadhaar numbers or phone numbers in the output."""


def _offline_category(text: str) -> str:
    low = text.lower()
    best, best_hits = "Other", 0
    for cat, words in _KEYWORDS.items():
        hits = sum(1 for w in words if w in low)
        if hits > best_hits:
            best, best_hits = cat, hits
    return best


def _offline_priority(text: str) -> str:
    low = text.lower()
    if any(w in low for w in _URGENT):
        return "urgent"
    if any(w in low for w in _HIGH):
        return "high"
    return "medium"


def _first_sentence(text: str, limit: int = 80) -> str:
    s = re.split(r"(?<=[.!?।])\s", text.strip(), maxsplit=1)[0]
    return (s[: limit - 1] + "…") if len(s) > limit else s


def _offline_analyze(text: str, language: str) -> dict:
    category = _offline_category(text)
    priority = _offline_priority(text)
    title = _first_sentence(text)
    if detect_language(title) == "ta":
        title = f"{category} complaint"
    summary = f"Citizen reports a {category.lower()} problem: {text.strip()[:200]}"
    draft = (
        "To,\nThe Officer-in-charge,\n"
        f"{CATEGORIES[category]}\n\n"
        "Respected Sir/Madam,\n\n"
        f"I would like to bring the following problem to your notice: {text.strip()}\n\n"
        "I request you to look into this matter and take suitable action at the earliest.\n\n"
        "Thank you."
    )
    missing = (
        ["எந்த இடத்தில் இந்தப் பிரச்சினை உள்ளது?", "எத்தனை நாட்களாக இந்தப் பிரச்சினை உள்ளது?"]
        if language == "ta"
        else ["Where exactly is the problem (street, landmark)?", "Since when has this been happening?"]
    )
    return {
        "title": title, "category": category, "department": CATEGORIES[category], "priority": priority,
        "summary": summary, "draft": draft, "missing_info": missing, "mode": "offline",
    }


def analyze(llm: LLM, text: str, language: str = "en") -> dict:
    if llm.available:
        try:
            data = llm.generate_json(f"Citizen complaint:\n{text}", system=SYSTEM_PROMPT)
            category = data.get("category") if data.get("category") in CATEGORIES else _offline_category(text)
            priority = data.get("priority") if data.get("priority") in PRIORITIES else "medium"
            missing = [str(m) for m in (data.get("missing_info") or [])][:3]
            return {
                "title": str(data.get("title") or _first_sentence(text))[:200],
                "category": category,
                "department": CATEGORIES[category],
                "priority": priority,
                "summary": str(data.get("summary") or ""),
                "draft": str(data.get("draft") or ""),
                "missing_info": missing,
                "mode": "gemini",
            }
        except Exception:  # noqa: BLE001
            log.exception("Gemini grievance analysis failed; using offline classifier")
    return _offline_analyze(text, language)
