import { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import axios from "axios";

import NewsCard from "./components/NewsCard";
import MoodBanner from "./components/MoodBanner";
import AuthPage from "./components/AuthPage";
import Dashboard from "./components/Dashboard";
import LandingPage from "./components/LandingPage";
import useBehaviour from "./hooks/useBehaviour";
import "./App.css";
import logo from "./components/logo.png";

const MOOD_THEMES = {
  happy: { bg: "#FFFBEA", header: "#F59E0B" },
  calm: { bg: "#F0FDF4", header: "#10B981" },
  sad: { bg: "#FFF7ED", header: "#F97316" },
  anxious: { bg: "#F5F3FF", header: "#8B5CF6" },
  curious: { bg: "#EFF6FF", header: "#3B82F6" },
  angry: { bg: "#FEF2F2", header: "#EF4444" },
};

function App() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState("");
  const [sessionId, setSessionId] = useState(null);

  const [mood, setMood] = useState("calm");
  const [detectedMood, setDetectedMood] = useState("calm");
  const [confidence, setConfidence] = useState(0);
  const [source, setSource] = useState("rules");
  const [redirected, setRedirected] = useState(false);

  const [articles, setArticles] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingLive, setFetchingLive] = useState(false);
  const [skipCount, setSkipCount] = useState(0);
  const refilling = useRef(false);

  // In-memory set tracking already rendered article identifiers throughout the session
  const seenArticleUrls = useRef(new Set());

  const theme = MOOD_THEMES[mood] || MOOD_THEMES.calm;

  // Deduplication utility to scrub identical stories by URL or title
  const deduplicateArticles = useCallback((articleList) => {
    const uniqueList = [];
    articleList.forEach((item) => {
      const identifier = (item.url || item.title || "").trim().toLowerCase();
      if (identifier && !seenArticleUrls.current.has(identifier)) {
        seenArticleUrls.current.add(identifier);
        uniqueList.push(item);
      }
    });
    return uniqueList;
  }, []);

  const handleLogin = (id, name, instantNews = []) => {
    setUserId(id);
    setUsername(name);

    if (Array.isArray(instantNews) && instantNews.length > 0) {
      const uniqueInitial = deduplicateArticles(instantNews);
      setArticles(uniqueInitial);
      setLoading(false);
    } else {
      setLoading(true);
    }

    navigate("/news");
  };

  const handleLogout = () => {
    setUserId(null);
    setUsername("");
    setSessionId(null);
    setArticles([]);
    seenArticleUrls.current.clear();
    setMood("calm");
    setDetectedMood("calm");
    setConfidence(0);
    setSkipCount(0);
    setRedirected(false);
    setLoading(false);
    navigate("/");
  };

  useEffect(() => {
    if (!userId) return;

    axios.get("http://localhost:8000/session")
      .then((res) => setSessionId(res.data.session_id))
      .catch((e) => console.log("Session retrieval error:", e));

    setArticles((currentArticles) => {
      if (currentArticles && currentArticles.length > 0) {
        setLoading(false);
        return currentArticles;
      }

      setLoading(true);
      axios.get("http://localhost:8000/get-default-news")
        .then((res) => {
          if (res.data.status === "success" && res.data.articles) {
            const uniqueFallbacks = deduplicateArticles(res.data.articles);
            setArticles(uniqueFallbacks);
          }
        })
        .catch((e) => console.log("News fallback error:", e))
        .finally(() => setLoading(false));

      return currentArticles;
    });
  }, [userId, deduplicateArticles]);

  // Merge newly inferred articles while preserving variety and rejecting duplicates
  const handleMoodChange = useCallback((data) => {
    const newDetected = data.detected_mood || data.mood || "calm";
    const newDisplay = data.display_mood || data.mood || "calm";

    setDetectedMood(newDetected);
    setMood(newDisplay);
    setConfidence(data.confidence || 0);
    setSource(data.source || "rules");
    setRedirected(data.redirected || false);

    if (Array.isArray(data.articles) && data.articles.length > 0) {
      setArticles((prev) => {
        const freshUnique = deduplicateArticles(data.articles);
        
        // If all live arrivals are duplicates, keep existing buffer without flushing
        if (freshUnique.length === 0) {
          return prev;
        }

        // Prepend fresh stories while keeping the total active feed capped at 30
        const combined = [...freshUnique, ...prev];
        return combined.slice(0, 30);
      });
    }

    setFetchingLive(false);
  }, [deduplicateArticles]);

  const { recordClick, recordSkip } = useBehaviour(
    handleMoodChange,
    setFetchingLive,
    sessionId,
    userId
  );

  const handleSkip = useCallback((index) => {
    recordSkip();
    setArticles((prev) => prev.filter((_, i) => i !== index));
    setSkipCount((prev) => prev + 1);
  }, [recordSkip]);

  // Buffer refill with deduplication when the user nears the end of the feed
  useEffect(() => {
    if (!userId || loading || fetchingLive || refilling.current) return;
    if (articles.length >= 6) return;

    refilling.current = true;
    axios.get("http://localhost:8000/get-default-news")
      .then((res) => {
        if (res.data.status === "success" && res.data.articles?.length > 0) {
          setArticles((prev) => {
            const freshItems = deduplicateArticles(res.data.articles);
            return [...prev, ...freshItems];
          });
        }
      })
      .catch(() => {})
      .finally(() => { refilling.current = false; });
  }, [articles.length, userId, loading, fetchingLive, deduplicateArticles]);

  const handleClick = useCallback((article) => {
    recordClick();
    setSelectedArticle(article);
  }, [recordClick]);

  const Header = () => (
    <header className="header" style={{ background: theme.header }}>
      <div className="header-left">
        <img
          src={logo}
          alt="EmotionSense Logo"
          style={{
            height: "40px",
            width: "auto",
            borderRadius: "50%",
            backgroundColor: "white",
            padding: "2px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            marginRight: "12px",
          }}
        />
        <div>
          <h1 className="header-title">EmotionSense</h1>
          <p className="header-sub">News that adapts to how you feel</p>
        </div>
      </div>

      <div className="header-right">
        <button
          className="logout-btn"
          onClick={() => navigate("/dashboard")}
          style={{ marginRight: "12px" }}
        >
          My Analytics
        </button>

        <button
          className="logout-btn"
          onClick={() => navigate("/news")}
          style={{ marginRight: "12px" }}
        >
          View News
        </button>

        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
        <span className="header-user">👤 {username}</span>
      </div>
    </header>
  );

  const NewsPage = () => {
    if (!userId) return <Navigate to="/login" replace />;

    return (
      <div className="app" style={{ background: theme.bg }}>
        <Header />

        <div className="container">
          <MoodBanner
            mood={mood}
            detectedMood={detectedMood}
            confidence={confidence}
            source={source}
            redirected={redirected}
          />

          {redirected && (
            <div className="redirect-notice">
              😌 You seem <strong>{detectedMood}</strong> — showing{" "}
              <strong>{mood}</strong> news to help you feel better
            </div>
          )}

          <div className="live-indicator">
            <span className={`live-dot ${fetchingLive ? "pulse-fast" : ""}`} />
            {fetchingLive ? (
              <span style={{ color: "#3B82F6", fontWeight: "bold" }}>
                Generating personalized live news via ML...
              </span>
            ) : (
              "Detecting your mood automatically..."
            )}

            {sessionId && (
              <span className="session-tag">
                Session: {sessionId.slice(0, 8)}
              </span>
            )}
          </div>

          {loading ? (
            <div className="news-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-line skeleton-source"></div>
                  <div className="skeleton-line skeleton-title"></div>
                  <div className="skeleton-line skeleton-desc"></div>
                  <div className="skeleton-line skeleton-footer"></div>
                </div>
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="empty-state">
              <p>No articles found. Try reading or skipping to fetch more.</p>
            </div>
          ) : (
            <div
              className="news-grid"
              style={{
                opacity: fetchingLive ? 0.6 : 1,
                transition: "opacity 0.4s ease-in-out",
                pointerEvents: fetchingLive ? "none" : "auto",
              }}
            >
              {articles.map((article, i) => (
                <NewsCard
                  key={`${article.url || article.title}-${i}`}
                  article={article}
                  onClick={handleClick}
                  onSkip={() => handleSkip(i)}
                />
              ))}
            </div>
          )}

          {selectedArticle && (
            <div
              className="modal-overlay"
              onClick={() => setSelectedArticle(null)}
            >
              <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="modal-close"
                  onClick={() => setSelectedArticle(null)}
                >
                  ✕ Close
                </button>

                <div style={{ color: "#3b82f6", fontWeight: "bold" }}>
                  {selectedArticle.source_name}
                </div>

                <h2 className="modal-title">{selectedArticle.title}</h2>

                <span className="emotion-tag" style={{ marginBottom: "20px" }}>
                  {selectedArticle.emotion_label}
                </span>

                <p className="modal-body">{selectedArticle.description}</p>

                <a
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noreferrer"
                  className="modal-external-link"
                >
                  Read full story on original site ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const DashboardPage = () => {
    if (!userId) return <Navigate to="/login" replace />;

    return (
      <div className="app" style={{ background: theme.bg }}>
        <Header />
        <div className="container">
          <Dashboard userId={userId} onClose={() => navigate("/news")} />
        </div>
      </div>
    );
  };

  return (
    <Routes>
      <Route path="/" element={<LandingPage onEnter={() => navigate("/login")} />} />
      <Route path="/login" element={<AuthPage onLogin={handleLogin} />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;