import { useEffect, useRef, useCallback } from "react";
import axios from "axios";

/**
 * Custom React Hook to track user affective behavioural telemetry
 * and throttle ML mood inference calls.
 */
const useBehaviour = (onMoodChange, setFetchingLive, sessionId, userId) => {
  // Timing references
  const intervalStartTime = useRef(Date.now());
  const lastInteractionTime = useRef(Date.now());
  
  // Interaction telemetry
  const scrollSpeeds = useRef([]);
  const lastScrollY = useRef(window.scrollY);
  const lastScrollT = useRef(Date.now());
  const skips = useRef(0);
  const clicks = useRef(0);
  const shown = useRef(0);

  // Guards and stable callbacks
  const isSending = useRef(false);
  const onMoodChangeRef = useRef(onMoodChange);
  const setFetchingLiveRef = useRef(setFetchingLive);

  // Keep references current without re-triggering dependency trees
  useEffect(() => {
    onMoodChangeRef.current = onMoodChange;
    setFetchingLiveRef.current = setFetchingLive;
  }, [onMoodChange, setFetchingLive]);

  // ── Track Scroll Dynamics ────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const now = Date.now();
      const diffY = Math.abs(window.scrollY - lastScrollY.current);
      const diffT = (now - lastScrollT.current) / 1000;

      if (diffT > 0.05) {
        scrollSpeeds.current.push(diffY / diffT);
        lastInteractionTime.current = now;
      }

      lastScrollY.current = window.scrollY;
      lastScrollT.current = now;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Dispatch Behaviour Bundle ────────────────────────────────
  const sendBundle = useCallback(async () => {
    if (!sessionId || isSending.current) return;

    const now = Date.now();
    // Idle check: skip dispatch if user has been inactive for over 90 seconds
    const idleSeconds = (now - lastInteractionTime.current) / 1000;
    if (idleSeconds > 90 && skips.current === 0 && clicks.current === 0) {
      return;
    }

    isSending.current = true;

    // Windowed dwell time calculation (capped to a realistic active window)
    const dwell = Math.min(Math.max((now - intervalStartTime.current) / 1000, 5), 180);
    const speeds = scrollSpeeds.current;
    const avgScroll = speeds.length > 0
      ? (speeds.reduce((a, b) => a + b, 0) / speeds.length) / 100
      : 2.5;

    const totalActions = shown.current;
    const skipRate = totalActions > 0
      ? Math.min(skips.current / totalActions, 0.8)
      : 0.1;
    const ctr = totalActions > 0
      ? Math.max(clicks.current / totalActions, 0.1)
      : 0.3;

    const bundle = {
      session_id:   sessionId,
      user_id:      userId || 0,
      dwell_time:   dwell,
      scroll_speed: Math.max(avgScroll, 0.5),
      skip_rate:    skipRate,
      history_len:  Math.max(totalActions, 1),
      n_shown:      Math.max(totalActions, 1),
      ctr:          ctr,
    };

    console.log(
      "Telemetry Dispatch →",
      `dwell: ${bundle.dwell_time.toFixed(1)}s`,
      `scroll: ${bundle.scroll_speed.toFixed(2)}`,
      `skip: ${bundle.skip_rate.toFixed(2)}`
    );

    try {
      if (setFetchingLiveRef.current) {
        setFetchingLiveRef.current(true);
      }

      const res = await axios.post("http://localhost:8000/infer-mood", bundle, {
        timeout: 10000,
      });

      if (res.data && onMoodChangeRef.current) {
        onMoodChangeRef.current(res.data);
      }
    } catch (err) {
      console.error("Inference network error:", err);
      if (setFetchingLiveRef.current) {
        setFetchingLiveRef.current(false);
      }
    } finally {
      // Reset window telemetry to prevent compounding metrics
      intervalStartTime.current = Date.now();
      scrollSpeeds.current = [];
      skips.current = 0;
      clicks.current = 0;
      shown.current = 0;
      isSending.current = false;
    }
  }, [sessionId, userId]);

  // ── Scheduling Engine ────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    // Initial inference after 15 seconds of initial reading
    const initialTimer = setTimeout(() => {
      sendBundle();
    }, 15000);

    // Continuous inference every 60 seconds (prevents NewsAPI rate exhaust)
    const periodicInterval = setInterval(() => {
      sendBundle();
    }, 60000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(periodicInterval);
    };
  }, [sessionId, sendBundle]);

  // ── User Event Handlers ──────────────────────────────────────
  const recordClick = useCallback(() => {
    clicks.current += 1;
    shown.current += 1;
    lastInteractionTime.current = Date.now();

    if (sessionId) {
      axios.post("http://localhost:8000/track-click", {
        session_id: sessionId,
        user_id: userId || 0,
      }).catch(() => {});
    }
  }, [sessionId, userId]);

  const recordSkip = useCallback(() => {
    skips.current += 1;
    shown.current += 1;
    lastInteractionTime.current = Date.now();

    if (sessionId) {
      axios.post("http://localhost:8000/track-skip", {
        session_id: sessionId,
        user_id: userId || 0,
        article_id: 0,
      }).catch(() => {});
    }

    // Trigger immediate inference only on sustained disinterest (4 skips), protected by isSending lock
    if (skips.current >= 4 && !isSending.current) {
      sendBundle();
    }
  }, [sessionId, userId, sendBundle]);

  return { recordClick, recordSkip };
};

export default useBehaviour;