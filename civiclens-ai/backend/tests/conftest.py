import os
from pathlib import Path

# Use an isolated SQLite DB and offline mode (no Gemini key) for tests. Must be set before the app is imported.
DB_FILE = Path(__file__).parent / "test_civiclens.db"
if DB_FILE.exists():
    DB_FILE.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_FILE}"
os.environ["GEMINI_API_KEY"] = ""
os.environ["AUTO_SEED"] = "true"
os.environ["SEED_DEMO_DATA"] = "true"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c
    if DB_FILE.exists():
        DB_FILE.unlink()


def login(client: TestClient, email: str, password: str) -> dict:
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def officer(client):
    return login(client, "officer@civiclens.demo", "Officer@123")


@pytest.fixture(scope="session")
def citizen(client):
    return login(client, "citizen@civiclens.demo", "Citizen@123")
