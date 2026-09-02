// AuthPage.js
import React, { useState, useEffect } from "react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getPasswordStrength = (pwd) => {
    if (!pwd) return { label: "", color: "" };
    if (pwd.length < 6) return { label: "Weak 🔴", color: "#EF4444" };
    
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSpecial = /[@$!%*?&]/.test(pwd);

    if (pwd.length >= 8 && hasUpper && hasNumber && hasSpecial) {
      return { label: "Strong 🟢", color: "#10B981" };
    }
    return { label: "Moderate 🟡", color: "#F59E0B" };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isLogin) {
      const strongPasswordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

      if (!strongPasswordRegex.test(password)) {
        setError(
          "Password must contain at least 8 characters, including 1 uppercase letter, 1 number, and 1 special character (@$!%*?&)."
        );
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? "/login" : "/signup";
      const payload = isLogin
        ? { email: email.trim(), password }
        : { username: username.trim(), email: email.trim(), password };

      const res = await axios.post(
        `http://localhost:8000${endpoint}`,
        payload
      );

      if (res.data.success) {
        if (isLogin) {
          onLogin(
            res.data.user_id,
            res.data.username,
            res.data.instant_news || []
          );
        } else {
          setSuccess("Account created successfully. Please sign in.");
          setUsername("");
          setEmail("");
          setPassword("");
          setIsLogin(true);
        }
      } else {
        setError(res.data.message || "Authentication failed");
      }
    } catch (err) {
      console.error("Authentication error:", err);
      setError("Cannot connect to backend server");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (login) => {
    setIsLogin(login);
    setError("");
    setSuccess("");
    setUsername("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
  };

  const strength = getPasswordStrength(password);

  return (
    <>
      <NavBar onLoginClick={onBackToLanding} isAuthPage={true} />

      <div className="auth-page">
        <div className={`auth-shell ${mounted ? "show" : ""}`}>
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
                      autoComplete="username"
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
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="field">
                <label>Password</label>
                <div className="input-box" style={{ position: "relative" }}>
                  <span>🔒</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={
                      isLogin ? "Enter password" : "Min 8 chars, 1 uppercase, 1 num, 1 symbol"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={isLogin ? 6 : 8}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "16px",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>

                {!isLogin && password && (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      marginTop: "6px",
                      fontWeight: "600",
                      color: strength.color,
                    }}
                  >
                    Strength: {strength.label}
                  </div>
                )}
              </div>

              {error && <div className="message error">⚠️ {error}</div>}
              {success && <div className="message success">✅ {success}</div>}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Verifying..." : isLogin ? "Sign In" : "Create Account"}
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