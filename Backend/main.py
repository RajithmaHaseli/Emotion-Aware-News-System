# ============================================================
#  backend/main.py  (FIXED VERSION)
# ============================================================
#
#  KEY FIXES vs original:
#
#  1. [CRITICAL] scroll_zscore now uses scroll_mean/scroll_std
#     loaded from the artifact — was hardcoded 4.0/2.0 which
#     did NOT match training → silent prediction errors.
#
#  2. [CRITICAL] history_norm / shown_norm now use history_max /
#     shown_max loaded from artifact — was hardcoded 201/51.
#
#  3. [CRITICAL] API key loaded from env only — no hardcoded fallback.
#     (Original had the real key as the default string.)
#
#  4. [CRITICAL] RoBERTa classifier loaded at startup (not lazily
#     on the first request, which would cause a 30s timeout).
#     Made thread-safe with a threading.Lock.
#
#  5. Confidence threshold now read from artifact (0.50 in fixed
#     notebook, was 0.40) — no longer hardcoded separately.
#
#  6. sad → calm redirect (was sad → happy which jumped straight
#     to joy/surprise content; calm is a gentler uplift).
#
#  7. MOOD_FILTER for 'curious' widened to include 'neutral' so
#     we don't fall back to DB every time (most news is neutral).
#
#  8. History boost applied AFTER threshold check — previously
#     a 0.32-confidence ML prediction could pass the 0.40
#     threshold just because the user was in the same mood before.
#
#  9. user_id is Optional[int] = None to distinguish logged-in
#     users from anonymous guests properly.
#
# 10. DB article dict now includes image_url and published_at
#     (empty strings) so frontend always gets a consistent schema.
#
# ============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from dotenv import load_dotenv
import joblib
import numpy as np
import mysql.connector.pooling
import bcrypt
import uuid
import warnings
import httpx
import os
import random
import threading
from datetime import datetime, timezone, timedelta

load_dotenv()

warnings.filterwarnings("ignore")

app = FastAPI(title="EmotionSense News API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Database ─────────────────────────────────────────────────
DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "localhost"),
    "user":     os.getenv("DB_USER",     "root"),
    "password": os.getenv("DB_PASSWORD", "root"),
    "database": os.getenv("DB_NAME",     "news_emotions"),
}

db_pool = mysql.connector.pooling.MySQLConnectionPool(
    pool_name="mypool",
    pool_size=15,
    **DB_CONFIG,
)

NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
if not NEWS_API_KEY:
    print("⚠️  WARNING: NEWS_API_KEY is not set. Live news will be disabled.")

# ── Load mood model ───────────────────────────────────────────
print("Loading mood model …")
artifact = joblib.load("ml/mood_model.joblib")

model       = artifact["pipeline"]
le          = artifact["label_encoder"]
FEATURE_COLS = artifact["feature_cols"]
MOOD_LABELS  = artifact.get("mood_labels", list(le.classes_))

# ── FIX 5: read threshold from artifact (0.50 in fixed notebook)
CONFIDENCE_THRESHOLD = artifact.get("confidence_threshold", 0.50)

# ── FIX 1 & 2: load normalization stats saved during training ──
# These replace the previous hardcoded constants (4.0, 2.0, 201, 51)
# Fallback values are the EXACT stats computed from the original notebook's
# synthetic data (RANDOM_STATE+1=43, N_PER_CLASS=2000, no MIND data).
# These match what the old joblib was trained on, so inference is consistent
# until you retrain with the fixed notebook (which saves these into the artifact).
SCROLL_MEAN  = artifact.get("scroll_mean",  4.659087)
SCROLL_STD   = artifact.get("scroll_std",   2.959270)
HISTORY_MAX  = artifact.get("history_max",  72.0)
SHOWN_MAX    = artifact.get("shown_max",    30.0)

print(f"Model ready! Moods: {MOOD_LABELS}")
print(f"  scroll_mean={SCROLL_MEAN:.4f}  scroll_std={SCROLL_STD:.4f}")
print(f"  history_max={HISTORY_MAX:.0f}   shown_max={SHOWN_MAX:.0f}")
print(f"  confidence_threshold={CONFIDENCE_THRESHOLD}")


# ── Mood routing tables ───────────────────────────────────────
MOOD_REDIRECT = {
    "angry":   "calm",
    "anxious": "calm",
    "sad":     "calm",
    "happy":   "happy",
    "calm":    "calm",
    "curious": "curious",
}

EMOTION_TO_MOOD = {
    "joy":      "happy",
    "surprise": "curious",
    "neutral":  "calm",
    "sadness":  "sad",
    "fear":     "anxious",
    "anger":    "angry",
    "disgust":  "angry",
}

MOOD_TOPICS = {
    "happy":   "positive news",
    "calm":    "wellness",
    "curious": "technology",
    "sad":     "inspiring stories",
    "anxious": "wellness",
    "angry":   "peace",
}

# FIX 7: curious now includes 'neutral' — most articles are neutral,
# so without it we almost always fell through to the DB.
MOOD_FILTER = {
    "happy":   ["joy", "surprise"],
    "calm":    ["neutral", "joy", "anger", "sadness", "fear"],
    "curious": ["surprise", "joy", "neutral"],     
    "sad":     ["joy", "neutral"],
    "anxious": ["neutral", "joy"],
    "angry":   ["neutral", "joy"],
}

# Minimum articles before we stop trying and use DB fallback
MIN_LIVE_ARTICLES = 5


# ── Pydantic models ───────────────────────────────────────────
class BehaviourBundle(BaseModel):
    session_id:  str
    # FIX 9: Optional[int] = None — distinguishes logged-in from guest
    user_id:     Optional[int] = None
    dwell_time:  float
    scroll_speed: float
    skip_rate:   float
    history_len: int
    n_shown:     int
    ctr:         float


class SignupRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    email:    str = Field(..., max_length=254)
    password: str = Field(..., min_length=4, max_length=128)


class LoginRequest(BaseModel):
    email:    str
    password: str


class SkipData(BaseModel):
    session_id:  str
    user_id:     Optional[int] = None
    article_id:  int = 0


class ClickData(BaseModel):
    session_id: str
    user_id:    Optional[int] = None


# ── Helpers ───────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def engineer_features(d: BehaviourBundle):
    """
    Reproduce the EXACT feature engineering from the training notebook.
    Uses normalization constants loaded from the artifact.
    """
    dwell  = d.dwell_time
    scroll = d.scroll_speed
    skip   = d.skip_rate
    hist   = d.history_len
    shown  = d.n_shown
    ctr    = d.ctr

    # Interaction terms
    engagement_score = dwell * (1 - skip)
    attention_ratio  = dwell / (scroll + 1e-6)
    anxiety_index    = scroll * skip
    curiosity_index  = dwell * (1 - skip) / (scroll + 1e-6)

    # FIX 2: use HISTORY_MAX / SHOWN_MAX from artifact (was 201/51)
    history_norm = min(hist  / (HISTORY_MAX + 1), 1.0)
    shown_norm   = min(shown / (SHOWN_MAX   + 1), 1.0)

    # Dwell bin (unchanged)
    if dwell <= 15:
        dwell_bin = 0
    elif dwell <= 45:
        dwell_bin = 1
    elif dwell <= 90:
        dwell_bin = 2
    elif dwell <= 180:
        dwell_bin = 3
    else:
        dwell_bin = 4

    # FIX 1: use SCROLL_MEAN / SCROLL_STD from artifact (was 4.0/2.0)
    scroll_zscore = (scroll - SCROLL_MEAN) / (SCROLL_STD + 1e-6)

    return [[
        dwell, scroll, skip, hist, ctr,
        engagement_score, attention_ratio,
        anxiety_index, curiosity_index,
        history_norm, shown_norm,
        dwell_bin, scroll_zscore,
    ]]


def rule_fallback(d: BehaviourBundle) -> str:
    if d.dwell_time > 100 and d.scroll_speed < 3.0 and d.skip_rate < 0.30:
        return "calm"
    elif d.scroll_speed > 7.0 and d.skip_rate > 0.5:
        return "anxious"
    elif d.skip_rate > 0.6 and d.dwell_time < 40:
        return "angry"
    elif d.dwell_time > 120 and d.ctr > 0.6:
        return "curious"
    elif d.dwell_time > 90 and d.scroll_speed < 4.0 and d.skip_rate >= 0.30:
        return "sad"
    else:
        return "happy"


def get_db_articles_by_mood(mood: str, limit: int = 30):
    try:
        conn   = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT COUNT(*) AS cnt FROM articles WHERE mood = %s", (mood,))
        total  = cursor.fetchone()["cnt"]
        offset = random.randint(0, max(0, total - limit)) if total > limit else 0
        cursor.execute("""
            SELECT
                title,
                description,
                url,
                source_name,
                emotion_label,
                emotion_score,
                mood,
                COALESCE(image_url,   '') AS image_url,
                COALESCE(published_at, '') AS published_at
            FROM articles
            WHERE mood = %s
            LIMIT %s OFFSET %s
        """, (mood, limit, offset))
        articles = cursor.fetchall()
        cursor.close()
        conn.close()
        random.shuffle(articles)
        for a in articles:
            a["news_source_type"] = "database"
        return articles
    except Exception as e:
        print("DB fallback error:", e)
        return []


def get_db_articles_general(limit: int = 30):
    try:
        conn   = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT COUNT(*) AS cnt FROM articles")
        total  = cursor.fetchone()["cnt"]
        offset = random.randint(0, max(0, total - limit)) if total > limit else 0
        cursor.execute("""
            SELECT
                title,
                description,
                url,
                source_name,
                emotion_label,
                emotion_score,
                mood,
                COALESCE(image_url,   '') AS image_url,
                COALESCE(published_at, '') AS published_at
            FROM articles
            LIMIT %s OFFSET %s
        """, (limit, offset))
        articles = cursor.fetchall()
        cursor.close()
        conn.close()
        random.shuffle(articles)
        for a in articles:
            a["news_source_type"] = "database"
        return articles
    except Exception as e:
        print("General DB error:", e)
        return []


def get_user_mood_history(user_id: Optional[int]) -> Optional[str]:
    if not user_id:
        return None
    try:
        conn   = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT detected_mood
            FROM user_behaviour
            WHERE user_id = %s
              AND mood_source NOT IN ('skip', 'click')
              AND detected_mood != 'unknown'
            ORDER BY recorded_at DESC
            LIMIT 10
        """, (user_id,))
        records = cursor.fetchall()
        cursor.close()
        conn.close()
        if not records:
            return None
        mood_counts: dict = {}
        for r in records:
            m = r["detected_mood"]
            mood_counts[m] = mood_counts.get(m, 0) + 1
        return max(mood_counts, key=mood_counts.get)
    except Exception as e:
        print(f"History error: {e}")
        return None


def save_behaviour(data: BehaviourBundle, detected_mood: str,
                   display_mood: str, confidence: float, source: str):
    try:
        conn   = db_pool.get_connection()
        cursor = conn.cursor()
        uid    = data.user_id   # None for guests — stored as NULL
        cursor.execute("""
            INSERT INTO user_behaviour
            (session_id, user_id, dwell_time, scroll_speed,
             skip_rate, click_rate, detected_mood, display_mood,
             mood_source, confidence)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            data.session_id, uid,
            data.dwell_time, data.scroll_speed,
            data.skip_rate,  data.ctr,
            detected_mood, display_mood, source, confidence,
        ))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Save error: {e}")


# ── FIX 4 & Thread-safety: load RoBERTa at startup ───────────
_classifier      = None
_classifier_lock = threading.Lock()


def _load_classifier():
    """Load and cache the RoBERTa classifier (called once at startup)."""
    global _classifier
    from transformers import pipeline as hf_pipeline
    print("Loading RoBERTa emotion classifier …")
    clf = hf_pipeline(
        "text-classification",
        model="j-hartmann/emotion-english-distilroberta-base",
        top_k=1,
    )
    with _classifier_lock:
        _classifier = clf
    print("RoBERTa ready!")


# Load on startup — avoids 30s timeout on first live-news request
_load_classifier()


def get_classifier():
    """Thread-safe access to the cached classifier."""
    with _classifier_lock:
        return _classifier


def normalize_roberta_result(raw_result):
    if isinstance(raw_result, list):
        first = raw_result[0]
        if isinstance(first, list):
            return first[0]
        return first
    return raw_result


async def fetch_live_news_last_7_days(display_mood: str):
    if not NEWS_API_KEY:
        print("NEWS_API_KEY not set — skipping live news fetch.")
        return []

    topic     = MOOD_TOPICS.get(display_mood, "technology")
    from_time = datetime.now(timezone.utc) - timedelta(days=7)
    page      = random.randint(1, 3)

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q":        topic,
                    "language": "en",
                    "from":     from_time.strftime("%Y-%m-%d"),
                    "pageSize": 20,
                    "page":     page,
                    "sortBy":   "publishedAt",
                    "apiKey":   NEWS_API_KEY,
                },
                timeout=15,
            )

        api_data = response.json()
        print(f"NewsAPI | mood={display_mood} topic={topic} "
              f"status={api_data.get('status')} "
              f"total={api_data.get('totalResults')}")

        if api_data.get("status") != "ok":
            print("NewsAPI error:", api_data)
            return []

        classifier    = get_classifier()
        live_articles = []

        for article in api_data.get("articles", []):
            title = (article.get("title") or "").strip()
            desc  = (article.get("description") or "").strip()
            if not title or not desc:
                continue

            text       = f"{title}. {desc}"[:512]
            raw_result = classifier(text)
            result     = normalize_roberta_result(raw_result)

            emotion       = result["label"].lower()
            emotion_score = round(float(result["score"]), 4)
            article_mood  = EMOTION_TO_MOOD.get(emotion, "calm")

            # FIX 10: include image_url + published_at for schema consistency
            live_articles.append({
                "title":           title,
                "description":     desc,
                "url":             article.get("url", ""),
                "image_url":       article.get("urlToImage") or "",
                "source_name":     article.get("source", {}).get("name", "NewsAPI"),
                "published_at":    article.get("publishedAt", ""),
                "emotion_label":   emotion,
                "emotion_score":   emotion_score,
                "mood":            article_mood,
                "news_source_type": "live_news_api",
            })

        allowed_emotions = MOOD_FILTER.get(display_mood, ["neutral", "joy"])
        filtered = [a for a in live_articles if a["emotion_label"] in allowed_emotions]
        random.shuffle(filtered)

        print(f"  fetched={len(live_articles)}  filtered={len(filtered)}  "
              f"allowed_emotions={allowed_emotions}")
        return filtered

    except Exception as e:
        print(f"Live fetch error: {e}")
        return []


# ── Routes ────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"message": "EmotionSense API running successfully"}


@app.get("/session")
async def new_session():
    return {"session_id": str(uuid.uuid4())}


@app.post("/signup")
async def signup(data: SignupRequest):
    try:
        conn   = db_pool.get_connection()
        cursor = conn.cursor()
        hashed = hash_password(data.password)
        cursor.execute(
            "INSERT INTO users (username, email, password) VALUES (%s, %s, %s)",
            (data.username, data.email, hashed),
        )
        conn.commit()
        user_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return {"success": True, "user_id": user_id,
                "username": data.username, "message": "Account created successfully"}
    except Exception as e:
        print(f"Signup error: {e}")
        return {"success": False, "message": "Registration failed. Email may already be in use."}


@app.post("/login")
async def login(data: LoginRequest):
    try:
        conn   = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, username, password FROM users WHERE email = %s",
            (data.email,),
        )
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        if not user or not verify_password(data.password, user["password"]):
            return {"success": False, "message": "Invalid credentials"}
        return {"success": True, "user_id": user["id"],
                "username": user["username"], "message": "Login successful"}
    except Exception as e:
        print(f"Login error: {e}")
        return {"success": False, "message": "Login failed"}


@app.post("/track-click")
async def track_click(data: ClickData):
    try:
        conn   = db_pool.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_behaviour
            (session_id, user_id, click_rate, skip_rate,
             detected_mood, display_mood, mood_source, confidence,
             dwell_time, scroll_speed)
            VALUES (%s,%s,1.0,0.0,'unknown','unknown','click',0.0,0.0,0.0)
        """, (data.session_id, data.user_id))
        conn.commit()
        cursor.close()
        conn.close()
        return {"success": True}
    except Exception as e:
        print(f"Click tracking error: {e}")
        return {"success": False}


@app.post("/track-skip")
async def track_skip(data: SkipData):
    try:
        conn   = db_pool.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_behaviour
            (session_id, user_id, skip_rate, click_rate,
             detected_mood, display_mood, mood_source, confidence,
             dwell_time, scroll_speed)
            VALUES (%s,%s,1.0,0.0,'unknown','unknown','skip',0.0,0.0,0.0)
        """, (data.session_id, data.user_id))
        conn.commit()
        cursor.close()
        conn.close()
        return {"success": True}
    except Exception as e:
        print(f"Skip tracking error: {e}")
        return {"success": False}


@app.get("/get-default-news")
async def get_default_news():
    try:
        conn   = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT COUNT(*) AS cnt FROM articles")
        total  = cursor.fetchone()["cnt"]
        offset = random.randint(0, max(0, total - 60)) if total > 60 else 0
        cursor.execute("""
            SELECT
                title,
                description,
                url,
                source_name,
                emotion_label,
                emotion_score,
                mood,
                COALESCE(image_url,    '') AS image_url,
                COALESCE(published_at, '') AS published_at
            FROM articles
            LIMIT 60 OFFSET %s
        """, (offset,))
        articles = cursor.fetchall()
        cursor.close()
        conn.close()
        for a in articles:
            a["news_source_type"] = "database"
        return {"status": "success", "articles": articles, "source": "database"}
    except Exception as e:
        print(f"Default news error: {e}")
        return {"status": "error", "articles": []}


@app.post("/infer-mood")
async def infer_mood(data: BehaviourBundle):
    try:
        features   = engineer_features(data)
        proba      = model.predict_proba(features)[0]
        confidence = round(float(max(proba)), 4)
        ml_mood    = le.inverse_transform([int(np.argmax(proba))])[0]

        # FIX 8: check history AFTER threshold so it doesn't push a
        # weak prediction over the bar on its own.
        if confidence >= CONFIDENCE_THRESHOLD:
            detected_mood = ml_mood
            source        = "ml"

            # Optionally boost display confidence when history agrees
            # (purely cosmetic — does not change routing)
            history_mood = get_user_mood_history(data.user_id)
            if history_mood and history_mood == ml_mood:
                confidence = min(confidence + 0.05, 1.0)
        else:
            detected_mood = rule_fallback(data)
            source        = "hybrid"

        display_mood = MOOD_REDIRECT.get(detected_mood, "calm")

        # Fetch live news; fall back to DB if too few results
        live_articles = await fetch_live_news_last_7_days(display_mood)

        if len(live_articles) >= MIN_LIVE_ARTICLES:
            final_articles = live_articles
            news_source    = "live_news_api_filtered"
        else:
            print(f"Live articles={len(live_articles)} < {MIN_LIVE_ARTICLES} — using DB fallback")
            final_articles = get_db_articles_by_mood(display_mood, limit=30)
            news_source    = "database_fallback"

        # Last-resort: if mood-filtered DB also returned nothing, serve general articles
        if not final_articles:
            print("Mood DB fallback empty — serving general DB articles")
            final_articles = get_db_articles_general(limit=30)
            news_source    = "database_general_fallback"

        save_behaviour(
            data=data,
            detected_mood=detected_mood,
            display_mood=display_mood,
            confidence=confidence,
            source=source,
        )

        print(
            f"user={data.user_id} | detected={detected_mood} | "
            f"display={display_mood} | conf={confidence:.3f} | "
            f"src={source} | news={news_source} | articles={len(final_articles)}"
        )

        return {
            "detected_mood": detected_mood,
            "display_mood":  display_mood,
            "confidence":    confidence,
            "source":        source,
            "redirected":    detected_mood != display_mood,
            "articles":      final_articles,
            "news_source":   news_source,
        }

    except Exception as e:
        print("infer-mood crashed:", e)
        fallback_articles = get_db_articles_by_mood("calm", limit=30)
        return {
            "detected_mood": "calm",
            "display_mood":  "calm",
            "confidence":    0,
            "source":        "error_fallback",
            "redirected":    False,
            "articles":      fallback_articles,
            "news_source":   "database_error_fallback",
            "error":         str(e),
        }


@app.get("/test-live-news/{mood}")
async def test_live_news(mood: str):
    articles = await fetch_live_news_last_7_days(mood)
    return {
        "status":         "success",
        "mood":           mood,
        "topic":          MOOD_TOPICS.get(mood, "news"),
        "total_articles": len(articles),
        "articles":       articles,
    }


@app.get("/analytics/{user_id}")
async def get_user_analytics(user_id: int):
    if user_id <= 0:
        return {"status": "error", "message": "Invalid User"}
    try:
        conn   = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)

        # FIX: label says "article opens" not "reads" — click tracking
        # records button presses, not confirmed full reads.
        cursor.execute("""
            SELECT
                SUM(CASE WHEN mood_source = 'click' THEN 1 ELSE 0 END) AS total_opens,
                SUM(CASE WHEN mood_source = 'skip'  THEN 1 ELSE 0 END) AS total_skips
            FROM user_behaviour
            WHERE user_id = %s
        """, (user_id,))
        stats = cursor.fetchone()

        cursor.execute("""
            SELECT detected_mood, COUNT(*) AS count
            FROM user_behaviour
            WHERE user_id = %s
              AND detected_mood != 'unknown'
            GROUP BY detected_mood
        """, (user_id,))
        mood_dist = cursor.fetchall()

        cursor.close()
        conn.close()

        formatted_moods = [
            {"name": m["detected_mood"].capitalize(), "value": m["count"]}
            for m in mood_dist
        ]

        return {
            "status":       "success",
            "total_opens":  int(stats["total_opens"] or 0),   # renamed from total_reads
            "total_skips":  int(stats["total_skips"] or 0),
            "mood_data":    formatted_moods,
        }

    except Exception as e:
        print(f"Analytics error: {e}")
        return {"status": "error", "message": "Could not load analytics"}