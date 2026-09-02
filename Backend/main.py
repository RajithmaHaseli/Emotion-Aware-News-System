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

app = FastAPI(title="EmotionSense High-Performance News API")

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

# ── Database Connection Pool ──────────────────────────────────
DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "localhost"),
    "user":     os.getenv("DB_USER",     "root"),
    "password": os.getenv("DB_PASSWORD", "root"),
    "database": os.getenv("DB_NAME",     "news_emotions"),
}

db_pool = mysql.connector.pooling.MySQLConnectionPool(
    pool_name="mypool",
    pool_size=32,
    **DB_CONFIG,
)

NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")

# ── Load Random Forest Mood Model ─────────────────────────────
artifact = joblib.load("ml/mood_model.joblib")
model        = artifact["pipeline"]
le           = artifact["label_encoder"]
FEATURE_COLS = artifact["feature_cols"]
MOOD_LABELS  = artifact.get("mood_labels", list(le.classes_))

CONFIDENCE_THRESHOLD = artifact.get("confidence_threshold", 0.50)
SCROLL_MEAN          = artifact.get("scroll_mean",  4.659087)
SCROLL_STD           = artifact.get("scroll_std",   2.959270)
HISTORY_MAX          = artifact.get("history_max",  72.0)
SHOWN_MAX            = artifact.get("shown_max",    30.0)

# ── Mood Routing & Affective Filter Maps ──────────────────────
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

MOOD_TOPIC_POOLS = {
    "happy": [
        "uplifting OR inspiring OR celebration",
        "human achievement OR kindness OR breakthrough",
        "wildlife recovery OR innovation victory OR positivity",
    ],
    "calm": [
        "nature tranquility OR wellness OR meditation",
        "mindfulness living OR gardening OR astronomy calm",
        "environmental conservation OR peaceful landscapes",
    ],
    "curious": [
        "space discovery OR scientific innovation OR technology",
        "deep sea research OR artificial intelligence breakthrough",
        "archaeology exploration OR futuristic engineering",
    ],
    "sad": [
        "inspiring comeback OR mental health resilience",
        "community recovery OR overcoming adversity OR hope",
        "humanitarian support OR uplifting life lessons",
    ],
    "anxious": [
        "peaceful nature OR relaxation habits OR calmness",
        "mindfulness breathing OR mental tranquility OR wellness",
        "scenic sanctuaries OR slow living philosophies",
    ],
    "angry": [
        "peaceful conflict resolution OR community harmony",
        "constructive social dialogue OR civic collaboration",
        "compassion projects OR societal unity initiatives",
    ],
}

MOOD_FILTER = {
    "happy":   ["joy", "surprise"],
    "calm":    ["neutral", "joy"],
    "curious": ["surprise", "joy", "neutral"],
    "sad":     ["joy", "neutral"],
    "anxious": ["neutral", "joy"],
    "angry":   ["neutral", "joy"],
}

BLOCKED_EMOTIONS = {
    "happy":   {"fear", "anger", "sadness", "disgust"},
    "calm":    {"fear", "anger", "sadness", "disgust"},
    "anxious": {"fear", "anger", "sadness", "disgust"},
    "sad":     {"fear", "anger", "sadness", "disgust"},
    "angry":   {"fear", "anger", "sadness", "disgust"},
    "curious": {"fear", "anger", "disgust"},
}

# ── Schemas ───────────────────────────────────────────────────
class BehaviourBundle(BaseModel):
    session_id:   str
    user_id:      Optional[int] = None
    dwell_time:   float
    scroll_speed: float
    skip_rate:    float
    history_len:  int
    n_shown:      int
    ctr:          float

class SignupRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    email:    str = Field(..., max_length=254)
    password: str = Field(..., min_length=8, max_length=128)

class LoginRequest(BaseModel):
    email:    str
    password: str

class SkipData(BaseModel):
    session_id: str
    user_id:    Optional[int] = None
    article_id: int = 0

class ClickData(BaseModel):
    session_id: str
    user_id:    Optional[int] = None

# ── Helpers ───────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def engineer_features(d: BehaviourBundle):
    dwell  = d.dwell_time
    scroll = d.scroll_speed
    skip   = d.skip_rate
    hist   = d.history_len
    shown  = d.n_shown
    ctr    = d.ctr

    engagement_score = dwell * (1 - skip)
    attention_ratio  = dwell / (scroll + 1e-6)
    anxiety_index    = scroll * skip
    curiosity_index  = dwell * (1 - skip) / (scroll + 1e-6)

    history_norm = min(hist / (HISTORY_MAX + 1), 1.0)
    shown_norm   = min(shown / (SHOWN_MAX + 1), 1.0)

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

# ── Dynamic Database Retrieval ────────────────────────────────
def fetch_cached_articles(limit: int = 30):
    conn   = None
    cursor = None
    try:
        conn = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT COUNT(*) AS cnt FROM articles")
        total_records = cursor.fetchone()["cnt"]
        
        max_offset = max(0, total_records - limit)
        offset = random.randint(0, max_offset) if max_offset > 0 else 0

        cursor.execute("""
            SELECT
                title, description, url, source_name,
                emotion_label, emotion_score, mood,
                COALESCE(image_url, '') AS image_url,
                COALESCE(published_at, '') AS published_at
            FROM articles
            LIMIT %s OFFSET %s
        """, (limit, offset))
        rows = cursor.fetchall()
        random.shuffle(rows)
        for r in rows:
            r["news_source_type"] = "database_cached"
        return rows
    except Exception as e:
        print("Dynamic cache fetch error:", e)
        return []
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()

def get_db_articles_by_mood(mood: str, limit: int = 30):
    conn   = None
    cursor = None
    try:
        conn = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT COUNT(*) AS cnt FROM articles WHERE mood = %s", (mood,))
        total_records = cursor.fetchone()["cnt"]
        
        max_offset = max(0, total_records - limit)
        offset = random.randint(0, max_offset) if max_offset > 0 else 0

        cursor.execute("""
            SELECT
                title, description, url, source_name,
                emotion_label, emotion_score, mood,
                COALESCE(image_url, '') AS image_url,
                COALESCE(published_at, '') AS published_at
            FROM articles
            WHERE mood = %s
            LIMIT %s OFFSET %s
        """, (mood, limit, offset))
        rows = cursor.fetchall()
        random.shuffle(rows)
        for r in rows:
            r["news_source_type"] = "database_mood"
        return rows
    except Exception as e:
        print("Mood DB fetch error:", e)
        return []
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()

def save_behaviour(data: BehaviourBundle, detected_mood: str,
                   display_mood: str, confidence: float, source: str):
    conn   = None
    cursor = None
    try:
        conn = db_pool.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_behaviour
            (session_id, user_id, dwell_time, scroll_speed,
             skip_rate, click_rate, detected_mood, display_mood,
             mood_source, confidence)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            data.session_id, data.user_id,
            data.dwell_time, data.scroll_speed,
            data.skip_rate,  data.ctr,
            detected_mood, display_mood, source, confidence,
        ))
        conn.commit()
    except Exception as e:
        print(f"Save behaviour error: {e}")
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()

# ── Dynamic Persistence for Filtered Articles ─────────────────
def save_live_articles_to_db(articles_list):
    """Persists filtered live articles into MySQL, ignoring duplicate URLs."""
    if not articles_list:
        return
    conn = None
    cursor = None
    try:
        conn = db_pool.get_connection()
        cursor = conn.cursor()
        
        query = """
            INSERT IGNORE INTO articles 
            (title, description, url, source_name, published_at, emotion_label, emotion_score, mood, image_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        data = [
            (
                a.get("title", "")[:500],
                a.get("description", ""),
                a.get("url", "")[:1000],
                a.get("source_name", "LiveSource")[:200],
                str(a.get("published_at", ""))[:100],
                a.get("emotion_label", "neutral")[:50],
                float(a.get("emotion_score", 0.0)),
                a.get("mood", "calm")[:50],
                a.get("image_url", "")[:1000]
            )
            for a in articles_list
            if a.get("url")
        ]
        
        cursor.executemany(query, data)
        conn.commit()
        print(f"[DB AUTO-SAVE]: Persisted {cursor.rowcount} newly classified articles into MySQL.")
    except Exception as e:
        print(f"[DB AUTO-SAVE ERROR]: {e}")
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()

# ── Batch RoBERTa Classifier Pipeline ─────────────────────────
_classifier      = None
_classifier_lock = threading.Lock()

def _load_classifier():
    global _classifier
    from transformers import pipeline as hf_pipeline
    clf = hf_pipeline(
        "text-classification",
        model="j-hartmann/emotion-english-distilroberta-base",
        top_k=1,
    )
    with _classifier_lock:
        _classifier = clf

_load_classifier()

def get_classifier():
    with _classifier_lock:
        return _classifier

def normalize_roberta_result(raw_result):
    if isinstance(raw_result, list):
        first = raw_result[0]
        if isinstance(first, list):
            return first[0]
        return first
    return raw_result

async def fetch_live_news_batch(display_mood: str):
    if not NEWS_API_KEY:
        return []

    topics_list = MOOD_TOPIC_POOLS.get(display_mood, ["uplifting news"])
    selected_topic = random.choice(topics_list)

    now_utc = datetime.now(timezone.utc)
    from_time = now_utc - timedelta(days=4)

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q":          selected_topic,
                    "language":   "en",
                    "from":       from_time.strftime("%Y-%m-%d"),
                    "to":         now_utc.strftime("%Y-%m-%d"),
                    "pageSize":   25,
                    "page":       1,
                    "sortBy":     "publishedAt",
                    "apiKey":     NEWS_API_KEY,
                },
                timeout=9,
            )

        api_data = response.json()
        print(f"[NEWS API STATUS]: {api_data.get('status')} | Items returned: {len(api_data.get('articles', []))}")

        if api_data.get("status") != "ok":
            return []

        raw_items = api_data.get("articles", [])
        valid_items = []
        texts_to_batch = []

        for item in raw_items:
            t = (item.get("title") or "").strip()
            d = (item.get("description") or "").strip()
            if t and d and "[Removed]" not in t:
                valid_items.append(item)
                texts_to_batch.append(f"{t}. {d}"[:256])

        if not texts_to_batch:
            return []

        classifier = get_classifier()
        batch_predictions = classifier(texts_to_batch, batch_size=16)

        live_articles = []
        for item, pred in zip(valid_items, batch_predictions):
            norm_pred = normalize_roberta_result(pred)
            emotion = norm_pred["label"].lower()
            emotion_score = round(float(norm_pred["score"]), 4)

            if emotion_score < 0.48:
                continue

            live_articles.append({
                "title":            item.get("title", ""),
                "description":      item.get("description", ""),
                "url":              item.get("url", ""),
                "image_url":        item.get("urlToImage") or "",
                "source_name":      item.get("source", {}).get("name", "LiveSource"),
                "published_at":     item.get("publishedAt", ""),
                "emotion_label":    emotion,
                "emotion_score":    emotion_score,
                "mood":             EMOTION_TO_MOOD.get(emotion, "calm"),
                "news_source_type": "live_news_api",
            })

        allowed_emotions = MOOD_FILTER.get(display_mood, ["neutral", "joy"])
        filtered = [a for a in live_articles if a["emotion_label"] in allowed_emotions]
        random.shuffle(filtered)

        if filtered:
            save_live_articles_to_db(filtered)

        return filtered

    except Exception as e:
        print(f"Batch live fetch error: {e}")
        return []

# ── Endpoints ─────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"status": "online"}

@app.get("/session")
async def new_session():
    return {"session_id": str(uuid.uuid4())}

@app.post("/signup")
async def signup(data: SignupRequest):
    conn = None
    cursor = None
    try:
        conn = db_pool.get_connection()
        cursor = conn.cursor()
        hashed = hash_password(data.password)
        cursor.execute(
            "INSERT INTO users (username, email, password) VALUES (%s, %s, %s)",
            (data.username, data.email, hashed),
        )
        conn.commit()
        user_id = cursor.lastrowid
        return {
            "success":  True,
            "user_id":  user_id,
            "username": data.username,
        }
    except Exception:
        return {"success": False, "message": "Email already registered"}
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()

@app.post("/login")
async def login(data: LoginRequest):
    conn = None
    cursor = None
    try:
        conn = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, username, password FROM users WHERE email = %s",
            (data.email,),
        )
        user = cursor.fetchone()
        if not user or not verify_password(data.password, user["password"]):
            return {"success": False, "message": "Invalid credentials"}

        instant_news = fetch_cached_articles(limit=30)

        return {
            "success":      True,
            "user_id":      user["id"],
            "username":     user["username"],
            "instant_news": instant_news,
        }
    except Exception as e:
        print("Login error:", e)
        return {"success": False, "message": "Login service failure"}
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()

@app.get("/get-default-news")
async def get_default_news():
    articles = fetch_cached_articles(limit=30)
    return {"status": "success", "articles": articles}

@app.post("/track-click")
async def track_click(data: ClickData):
    conn = None
    cursor = None
    try:
        conn = db_pool.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_behaviour
            (session_id, user_id, click_rate, skip_rate,
             detected_mood, display_mood, mood_source, confidence,
             dwell_time, scroll_speed)
            VALUES (%s,%s,1.0,0.0,'unknown','unknown','click',0.0,0.0,0.0)
        """, (data.session_id, data.user_id))
        conn.commit()
        return {"success": True}
    except Exception:
        return {"success": False}
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()

@app.post("/track-skip")
async def track_skip(data: SkipData):
    conn = None
    cursor = None
    try:
        conn = db_pool.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_behaviour
            (session_id, user_id, skip_rate, click_rate,
             detected_mood, display_mood, mood_source, confidence,
             dwell_time, scroll_speed)
            VALUES (%s,%s,1.0,0.0,'unknown','unknown','skip',0.0,0.0,0.0)
        """, (data.session_id, data.user_id))
        conn.commit()
        return {"success": True}
    except Exception:
        return {"success": False}
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()

# ── Dynamic Fault-Tolerant Hybrid Inference ───────────────────
@app.post("/infer-mood")
async def infer_mood(data: BehaviourBundle):
    try:
        features   = engineer_features(data)
        proba      = model.predict_proba(features)[0]
        confidence = round(float(max(proba)), 4)
        ml_mood    = le.inverse_transform([int(np.argmax(proba))])[0]

        if confidence >= CONFIDENCE_THRESHOLD:
            detected_mood = ml_mood
            source        = "ml"
        else:
            detected_mood = rule_fallback(data)
            source        = "hybrid"

        display_mood = MOOD_REDIRECT.get(detected_mood, "calm")
        live_articles = await fetch_live_news_batch(display_mood)

        if len(live_articles) >= 4:
            final_articles = live_articles
            news_source    = "live_news_api_filtered"
        elif len(live_articles) > 0:
            db_articles = get_db_articles_by_mood(display_mood, limit=25)
            final_articles = live_articles + db_articles
            news_source    = "hybrid_live_and_db"
        else:
            final_articles = get_db_articles_by_mood(display_mood, limit=30)
            news_source    = "database_fallback"

        blacklisted = BLOCKED_EMOTIONS.get(display_mood, set())
        sanitized = [
            a for a in final_articles
            if a.get("emotion_label", "").lower() not in blacklisted
        ]

        save_behaviour(
            data=data,
            detected_mood=detected_mood,
            display_mood=display_mood,
            confidence=confidence,
            source=source,
        )

        return {
            "detected_mood": detected_mood,
            "display_mood":  display_mood,
            "confidence":    confidence,
            "source":        source,
            "redirected":    detected_mood != display_mood,
            "articles":      sanitized or final_articles,
            "news_source":   news_source,
        }

    except Exception as e:
        print("Inference error fallback:", e)
        fallback = get_db_articles_by_mood("calm", limit=30)
        return {
            "detected_mood": "calm",
            "display_mood":  "calm",
            "confidence":    0,
            "source":        "error_fallback",
            "redirected":    False,
            "articles":      fallback,
            "news_source":   "database_error_fallback",
        }

@app.get("/analytics/{user_id}")
async def get_user_analytics(user_id: int):
    if user_id <= 0:
        return {"status": "error", "message": "Invalid User"}

    conn   = None
    cursor = None
    try:
        conn = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                SUM(CASE WHEN mood_source = 'click' THEN 1 ELSE 0 END) AS total_opens,
                SUM(CASE WHEN mood_source = 'skip'  THEN 1 ELSE 0 END) AS total_skips
            FROM user_behaviour
            WHERE user_id = %s
        """, (user_id,))
        all_stats = cursor.fetchone() or {}

        cursor.execute("""
            SELECT detected_mood, COUNT(*) AS count
            FROM user_behaviour
            WHERE user_id = %s
              AND detected_mood != 'unknown'
            GROUP BY detected_mood
        """, (user_id,))
        all_mood_dist = cursor.fetchall()

        cursor.execute("""
            SELECT
                SUM(CASE WHEN mood_source = 'click' THEN 1 ELSE 0 END) AS total_opens,
                SUM(CASE WHEN mood_source = 'skip'  THEN 1 ELSE 0 END) AS total_skips
            FROM user_behaviour
            WHERE user_id = %s
              AND DATE(recorded_at) = CURDATE()
        """, (user_id,))
        today_stats = cursor.fetchone() or {}

        cursor.execute("""
            SELECT detected_mood, COUNT(*) AS count
            FROM user_behaviour
            WHERE user_id = %s
              AND detected_mood != 'unknown'
              AND DATE(recorded_at) = CURDATE()
            GROUP BY detected_mood
        """, (user_id,))
        today_mood_dist = cursor.fetchall()

        return {
            "status": "success",
            "today": {
                "total_opens": int(today_stats.get("total_opens") or 0),
                "total_skips": int(today_stats.get("total_skips") or 0),
                "mood_data":   [{"name": m["detected_mood"].capitalize(), "value": m["count"]} for m in today_mood_dist],
            },
            "all_time": {
                "total_opens": int(all_stats.get("total_opens") or 0),
                "total_skips": int(all_stats.get("total_skips") or 0),
                "mood_data":   [{"name": m["detected_mood"].capitalize(), "value": m["count"]} for m in all_mood_dist],
            }
        }
    except Exception as e:
        print("Analytics error:", e)
        return {"status": "error", "message": "Failed to load analytics"}
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()