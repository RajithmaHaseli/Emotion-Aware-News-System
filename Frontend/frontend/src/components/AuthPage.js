// AuthPage.js
import { useState, useEffect } from "react";
import axios from "axios";
import NavBar from "./NavBar";
import "./AuthPage.css";
import logo from "./logo.png";
import logo1 from "./logo1.jpg";

const MOODS = [
  { icon: "😊", text: "Joy" },
  { icon: "😌", text: "Calm" },
  { icon: "🤔", text: "Curious" },
  { icon: "😰", text: "Anxious" },
  { icon: "😢", text: "Sad" },
  { icon: "😠", text: "Angry" },
];

function AuthPage({ onLogin, onBackToLanding }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "/login" : "/signup";
      const payload = isLogin
        ? { email, password }
        : { username, email, password };

      const res = await axios.post(
        `http://localhost:8000${endpoint}`,
        payload
      );

      if (res.data.success) {
        if (isLogin) {
          setSuccess("Login successful!");
          setTimeout(() => {
            onLogin(res.data.user_id, res.data.username);
          }, 700);
        } else {
          setSuccess("Account created successfully. Please sign in.");
          setUsername("");
          setEmail("");
          setPassword("");
          setTimeout(() => {
            setIsLogin(true);
            setSuccess("");
          }, 1600);
        }
      } else {
        setError(res.data.message || "Something went wrong");
      }
    } catch (err) {
      console.log(err);
      setError("Cannot connect to backend server");
    }

    setLoading(false);
  };

  const switchMode = (login) => {
    setIsLogin(login);
    setError("");
    setSuccess("");
    setUsername("");
    setEmail("");
    setPassword("");
  };

  return (
    <>
      <NavBar 
        onLoginClick={onBackToLanding} 
        isAuthPage={true} 
      />
      
      <div className="auth-page">
        <div className={`auth-shell ${mounted ? "show" : ""}`}>
          {/* LEFT NEWS BRAND PANEL */}
          <section className="news-panel">
            <div className="brand-row">
              <img src={logo} alt="EmotionSense Logo" className="brand-logo" />
              <div>
                <h1>EmotionSense</h1>
                <p>Emotion-aware news intelligence</p>
              </div>
            </div>

            <img src={logo1} alt="EmotionSense Logo" className="news-login" />

            <div className="mood-strip">
              {MOODS.map((mood) => (
                <span key={mood.text}>
                  {mood.icon} {mood.text}
                </span>
              ))}
            </div>
          </section>

          {/* RIGHT FORM PANEL */}
          <section className="form-panel">
            <div className="tabs">
              <button
                type="button"
                className={isLogin ? "active" : ""}
                onClick={() => switchMode(true)}
              >
                Sign In
              </button>
              <button
                type="button"
                className={!isLogin ? "active" : ""}
                onClick={() => switchMode(false)}
              >
                Create Account
              </button>
            </div>

            <div className="form-title">
              <span>{isLogin ? "Welcome back" : "Start your journey"}</span>
              <h2>{isLogin ? "Sign in to EmotionSense" : "Create your account"}</h2>
              <p>
                {isLogin
                  ? "Continue to your personalized emotion-based news feed."
                  : "Create an account to begin mood-aware news recommendations."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {!isLogin && (
                <div className="field">
                  <label>Username</label>
                  <div className="input-box">
                    <span>👤</span>
                    <input
                      type="text"
                      placeholder="Enter username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      minLength={3}
                    />
                  </div>
                </div>
              )}

              <div className="field">
                <label>Email Address</label>
                <div className="input-box">
                  <span>✉️</span>
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label>Password</label>
                <div className="input-box">
                  <span>🔒</span>
                  <input
                    type="password"
                    placeholder={isLogin ? "Enter password" : "Minimum 6 characters"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {error && <div className="message error">⚠️ {error}</div>}
              {success && <div className="message success">✅ {success}</div>}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
              </button>
            </form>

            <p className="switch-text">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                type="button"
                onClick={() => switchMode(!isLogin)}
              >
                {isLogin ? "Create one" : "Sign in"}
              </button>
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

export default AuthPage;