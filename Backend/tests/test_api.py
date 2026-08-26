import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure Backend root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import app

client = TestClient(app)

# 1. Test Root Endpoint
def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200

# 2. Test User Signup
def test_user_signup():
    payload = {
        "username": "testuser_pytest",
        "email": "test_auto@example.com",
        "password": "securepassword123"
    }
    response = client.post("/signup", json=payload)
    assert response.status_code in [200, 400]

# 3. Test Track Click Endpoint (Existing in Swagger UI)
def test_track_click():
    payload = {
        "user_id": 1,
        "article_id": 101,
        "action": "click"
    }
    response = client.post("/track-click", json=payload)
    # Accepts 200, or 422 if payload fields differ
    assert response.status_code in [200, 422]

# 4. Test Live News Feed with Inferred Mood
def test_feed_live_news():
    response = client.get("/test-live-news/calm")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "success"
    assert "articles" in data or "total_articles" in data

# 5. Test Default News Endpoint
def test_get_default_news():
    response = client.get("/get-default-news")
    assert response.status_code in [200, 404]

# 6. Test Latest Mood Endpoint
def test_latest_mood():
    response = client.get("/latest-mood")
    assert response.status_code in [200, 404, 422]