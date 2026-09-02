import React from "react";
import "./NewsCard.css";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=900&q=80";

function formatTimeAgo(dateString) {
  if (!dateString) return null;
  const articleDate = new Date(dateString);
  if (isNaN(articleDate.getTime())) return null;

  const diffMs = Date.now() - articleDate.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) {
    const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function NewsCard({ article, onClick, onSkip }) {
  const source = article.source_name || "News Source";
  const title = article.title || "Untitled news article";
  const description = article.description || "No description available.";

  const rawEmotion = article.emotion_label || article.mood || "Neutral";
  const emotion =
    rawEmotion.charAt(0).toUpperCase() + rawEmotion.slice(1).toLowerCase();

  const image = article.image_url || article.urlToImage || DEFAULT_IMAGE;
  const timeAgo = formatTimeAgo(article.published_at);
  const isLive = article.news_source_type === "live_news_api";

  return (
    <article className="news-card">
      <div className="news-image-wrap">
        <img
          src={image}
          alt={title}
          className="news-image"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = DEFAULT_IMAGE;
          }}
        />

        <div className="news-top-row">
          <span className="news-source">{source}</span>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {isLive && (
              <span className="news-live-badge" title="Fetched live from NewsAPI">
                ● LIVE
              </span>
            )}
            <span className="news-emotion" data-emotion={emotion}>
              {emotion}
            </span>
          </div>
        </div>
      </div>

      <div className="news-body">
        <h3 className="news-title" onClick={() => onClick(article)}>
          {title}
        </h3>
        <p className="news-desc">{description}</p>

        <div className="news-footer-row">
          {timeAgo && <span className="news-published-time">🕒 {timeAgo}</span>}

          <div className="news-actions">
            <button
              type="button"
              className="news-read-btn"
              onClick={() => onClick(article)}
            >
              Read More
            </button>
            <button
              type="button"
              className="news-skip-btn"
              onClick={onSkip}
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default NewsCard;