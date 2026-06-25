import React from "react";
import "./NewsCard.css";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=900&q=80";

function NewsCard({ article, onClick, onSkip }) {
  const source    = article.source_name || "News Source";
  const title     = article.title       || "Untitled news article";
  const description = article.description || "No description available.";
  const emotion   = article.emotion_label || article.mood || "Neutral";
  const image     = article.image_url   || article.urlToImage || DEFAULT_IMAGE;

  return (
    <article className="news-card">

      {/* ── Image + overlay badges ── */}
      <div className="news-image-wrap">
        <img
          src={image}
          alt={title}
          className="news-image"
          onError={(e) => { e.currentTarget.src = DEFAULT_IMAGE; }}
        />

        <div className="news-top-row">
          <span className="news-source">{source}</span>
          {/* data-emotion drives the CSS colour rules */}
          <span className="news-emotion" data-emotion={emotion}>
            {emotion}
          </span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="news-body">
        <h3 className="news-title">{title}</h3>
        <p  className="news-desc">{description}</p>

        <div className="news-actions">
          <button className="news-read-btn" onClick={() => onClick(article)}>
            Read More
          </button>
          <button className="news-skip-btn" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>

    </article>
  );
}

export default NewsCard;