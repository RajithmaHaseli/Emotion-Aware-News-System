const MOOD_CONFIG = {
  happy:   { emoji: "😊", label: "Happy",   color: "#F59E0B" },
  calm:    { emoji: "😌", label: "Calm",    color: "#10B981" },
  sad:     { emoji: "😢", label: "Sad",     color: "#F97316" },
  anxious: { emoji: "😰", label: "Anxious", color: "#8B5CF6" },
  curious: { emoji: "🤔", label: "Curious", color: "#3B82F6" },
  angry:   { emoji: "😠", label: "Angry",   color: "#EF4444" },
};

function MoodBanner({ mood, confidence, source }) {
  const config = MOOD_CONFIG[mood] || MOOD_CONFIG["calm"];
  return (
    <div className="mood-banner"
      style={{ borderLeft: `4px solid ${config.color}` }}>
      <span className="mood-emoji">{config.emoji}</span>
      <div className="mood-info">
        <span className="mood-label"
          style={{ color: config.color }}>
          {config.label}
        </span>
        <span className="mood-meta">
          {Math.round(confidence * 100)}% confidence
          · detected by {source}
        </span>
      </div>
    </div>
  );
}

export default MoodBanner;