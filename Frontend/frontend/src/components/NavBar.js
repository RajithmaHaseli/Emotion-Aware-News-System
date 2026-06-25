import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "./logo.png";
import "./NavBar.css";

function NavBar({ isAuthPage }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getCurrentDate = () => {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };

    return new Date().toLocaleDateString("en-US", options);
  };

  const goHome = () => {
    navigate("/");
  };

  const goLogin = () => {
    navigate("/login");
  };

  const goSection = (sectionId) => {
    navigate("/");

    setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
      });
    }, 100);
  };

  return (
    <nav className={`landing-nav ${isScrolled ? "scrolled" : ""}`}>
      <div className="nav-top-bar">
        <span className="nav-date">{getCurrentDate()}</span>
      </div>

      <div className="nav-main-content">
        <div className="landing-logo-container" onClick={goHome}>
          <img src={logo} alt="EmotionSense Logo" className="brand-logo" />
          <span className="landing-brand-name">EmotionSense</span>
        </div>

        <div className="landing-nav-links">
          <button className="nav-link" onClick={goHome}>
            Home
          </button>

          <button className="nav-link" onClick={() => goSection("features")}>
            Features
          </button>

          <button className="nav-link" onClick={() => goSection("about")}>
            About
          </button>

          <button
            className={`landing-login-btn ${isAuthPage ? "active-auth" : ""}`}
            onClick={goLogin}
          >
            {isAuthPage ? "Account" : "Sign In"}
          </button>
        </div>
      </div>
    </nav>
  );
}

export default NavBar;