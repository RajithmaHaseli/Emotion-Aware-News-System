// LandingPage.js
import React from "react";
import NavBar from "./NavBar";
import "./LandingPage.css";

function LandingPage({ onEnter }) {
  const goLogin = () => {
    if (onEnter) onEnter();
  };

  const handleLogoClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="landing-wrapper">
      {/* Use the NavBar component */}
      <NavBar 
        onLoginClick={goLogin} 
        isAuthPage={false}
        onLogoClick={handleLogoClick}
      />

      {/* Hero / Main Breaking News Section */}
      <div id="home" className="landing-hero-section">
        <div className="landing-text-content">
          <div className="landing-badge">⚡ Live News</div>

          <h1 className="landing-hero-title">
            The World's First News Platform That Adapts To Your{" "}
            <span className="text-gradient">Emotions.</span>
          </h1>

          <p className="landing-hero-desc">
            Break free from toxic algorithmic loops. EmotionSense utilizes next-gen machine learning to analyze implicit reading behavior calibrating a personalized, therapeutic news feed in real-time.
          </p>

          <div className="cta-group">
            <button className="landing-cta-btn" onClick={goLogin}>
              Access Digital Feed
            </button>
          </div>

          <div className="landing-stats">
            <div className="stat-item">
              <span className="stat-number">6+</span>
              <span className="stat-label">Affective Moods</span>
            </div>
            <div className="divider"></div>
            <div className="stat-item">
              <span className="stat-number">Live</span>
              <span className="stat-label">Global Context</span>
            </div>
            <div className="divider"></div>
            <div className="stat-item">
              <span className="stat-number">NLP</span>
              <span className="stat-label">RoBERTa Curation</span>
            </div>
          </div>
        </div>

        {/* Premium News Blueprint Layout (Right Side) */}
        <div className="landing-visual-content">
          <div className="news-feed-header">
            <h3>Automated Affective Feed Simulation</h3>
            <span className="live-pulse-dot"></span>
          </div>

          <div className="mock-card mock-card-1">
            <div className="mock-img-wrapper">
              <img src="https://picsum.photos/id/1015/600/400" alt="Calm news" className="mock-img" />
              <span className="mock-tag tag-calm">😌 Calm Response</span>
            </div>
            <div className="mock-content">
              <h3 className="mock-title">Architectures of Silence: How Spatial Design Influences Neuro-Regulation</h3>
              <p className="mock-excerpt">Discovering how modern architectural patterns are being redesigned around mindfulness and neurological decompression frameworks...</p>
              <div className="mock-footer">
                <span className="mock-source">Wellness & Science Journal</span>
                <span className="read-time">4 min read</span>
              </div>
            </div>
          </div>

          <div className="news-secondary-row">
            <div className="mock-card mock-card-2">
              <div className="mock-img-wrapper">
                <img src="https://picsum.photos/id/1/600/400" alt="Curious news" className="mock-img" />
                <span className="mock-tag tag-curious">🤔 Curious State</span>
              </div>
              <div className="mock-content">
                <h3 className="mock-title">Quantum Supremacy Milestone Achieved via Silicon Spin Qubits</h3>
                <div className="mock-footer">
                  <span className="mock-source">Tech Daily Tech</span>
                </div>
              </div>
            </div>

            <div className="mock-card mock-card-3">
              <div className="mock-img-wrapper">
                <img src="https://picsum.photos/id/1025/600/400" alt="Happy news" className="mock-img" />
                <span className="mock-tag tag-happy">😊 Therapeutic Boost</span>
              </div>
              <div className="mock-content">
                <h3 className="mock-title">Urban Reforestation Project Exceeds Global Climate Goals Early</h3>
                <div className="mock-footer">
                  <span className="mock-source">Eco Green Network</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features / Architecture Section */}
      <section id="features" className="landing-section">
        <div className="section-heading">
          <h2>System Architectural Framework</h2>
          
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">🧠</div>
            <h3>Implicit Tracking</h3>
            <p>
              Tracks cognitive state non-intrusively via temporal telemetry calculating dwell-time metrics, scrolling velocity, and skip-ratios to capture true user affect.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📰</div>
            <h3>Hybrid Curation</h3>
            <p>
              Pairs tabular Machine Learning (Random Forest) with deep-learning NLP (DistilRoBERTa) to dynamically filter, intercept, and align live news feeds with your mental wellbeing.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Wellbeing Analytics</h3>
            <p>
              Quantifies media consumption impact through an advanced dashboard, giving transparency over behavioral patterns, emotional trends, and algorithmic redirections.
            </p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="landing-section about-section">
        <div className="about-container">
          <div className="section-heading inverted">
            <h2>What is EmotionSense?</h2>
          </div>
          <p className="about-text">
            EmotionSense is an emotion-aware news platform that understands your mood and personalises your news experience. It analyses your interactions, filters news based on your emotional state, and adapts the interface to provide a more comfortable and personalised reading experience.
          </p>
          <div className="about-footer">
            <span>EmotionSense</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;