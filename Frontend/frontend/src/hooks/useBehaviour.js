import { useEffect, useRef, useCallback } from "react";
import axios from "axios";

/**
 * Custom React Hook to track user interactions and send them to the FastAPI ML backend.
 */
const useBehaviour = (onMoodChange, setFetchingLive, sessionId, userId) => {
  const startTime    = useRef(Date.now());
  const scrollSpeeds = useRef([]);
  const lastScrollY  = useRef(0);
  const lastScrollT  = useRef(Date.now());
  const skips        = useRef(0);
  const clicks       = useRef(0);
  const shown        = useRef(0);

  // ── Track Scroll Speed ────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const now   = Date.now();
      const diffY = Math.abs(window.scrollY - lastScrollY.current);
      const diffT = (now - lastScrollT.current) / 1000;
      
      if (diffT > 0.05) {
        scrollSpeeds.current.push(diffY / diffT);
      }
      
      lastScrollY.current = window.scrollY;
      lastScrollT.current = now;
    };
    
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Build and Send Behaviour Bundle ───────────
  const sendBundle = useCallback(async () => {
    if (!sessionId) return;

    // Calculate metrics
    const dwell     = (Date.now() - startTime.current) / 1000;
    const speeds    = scrollSpeeds.current;
    const avgScroll = speeds.length > 0
      ? (speeds.reduce((a, b) => a + b, 0) / speeds.length) / 100
      : 2.5;
    const skipRate  = shown.current > 0
      ? Math.min(skips.current / shown.current, 0.8)
      : 0;
    const ctr       = shown.current > 0
      ? Math.max(clicks.current / shown.current, 0.1)
      : 0.5;

    // Create JSON payload
    const bundle = {
      session_id:   sessionId,
      user_id:      userId || 0,
      dwell_time:   Math.max(dwell, 5),
      scroll_speed: Math.max(avgScroll, 0.5),
      skip_rate:    skipRate,
      history_len:  Math.max(shown.current, 1),
      n_shown:      Math.max(shown.current, 1),
      ctr:          ctr
    };

    console.log(
      "Sending Behaviour Bundle →",
      `dwell: ${bundle.dwell_time.toFixed(1)}s`,
      `scroll: ${bundle.scroll_speed.toFixed(2)}`,
      `skip: ${bundle.skip_rate.toFixed(2)}`
    );

    try {
      // Trigger UI loading state (dims screen slightly)
      setFetchingLive(true); 
      
      // Call backend ML inference endpoint
      const res = await axios.post("http://localhost:8000/infer-mood", bundle);
      
      if (res.data) {
          onMoodChange(res.data);
      }
    } catch (err) {
      console.error("Infer mood / Live fetch error:", err);
      setFetchingLive(false); // Reset UI on error
    }
  }, [sessionId, userId, onMoodChange, setFetchingLive]);

  // ── Scheduling: First detection after 10s ───────
  useEffect(() => {
    if (!sessionId) return;
    const timeout = setTimeout(sendBundle, 10000);
    return () => clearTimeout(timeout);
  }, [sessionId, sendBundle]);

  // ── Scheduling: Repeated detection every 30s ────
  useEffect(() => {
    if (!sessionId) return;
    const delay = setTimeout(() => {
      const interval = setInterval(sendBundle, 30000);
      return () => clearInterval(interval);
    }, 10000);
    return () => clearTimeout(delay);
  }, [sessionId, sendBundle]);

  // ── Handle Article Click ────────────────────────
  const recordClick = useCallback(() => {
    clicks.current += 1;
    shown.current  += 1;
    if (sessionId) {
      axios.post("http://localhost:8000/track-click", {
        session_id: sessionId,
        user_id:    userId || 0
      }).catch(e => console.error("Click track error:", e));
    }
  }, [sessionId, userId]);

  // ── Handle Article Skip ─────────────────────────
  const recordSkip = useCallback(() => {
    skips.current += 1;
    shown.current += 1;
    if (sessionId) {
      axios.post("http://localhost:8000/track-skip", {
        session_id: sessionId,
        user_id:    userId || 0,
        article_id: 0
      }).catch(e => console.error("Skip track error:", e));
    }
    
    // Force an immediate ML fetch if user skips twice quickly
    if (skips.current % 2 === 0) {
      sendBundle();
    }
  }, [sessionId, userId, sendBundle]);

  return { recordClick, recordSkip };
};

export default useBehaviour;