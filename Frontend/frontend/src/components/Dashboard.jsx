import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import './Dashboard.css';

/* ── Mood config ─────────────────────────────────────────── */
const MOOD_CONFIG = {
  Happy:   { color: '#F59E0B', icon: '😊' },
  Calm:    { color: '#10B981', icon: '😌' },
  Curious: { color: '#3B82F6', icon: '🤔' },
  Sad:     { color: '#64748b', icon: '😢' },
  Anxious: { color: '#8B5CF6', icon: '😰' },
  Angry:   { color: '#EF4444', icon: '😠' },
};

/* ── Mood-based insight messages ─────────────────────────── */
const MOOD_INSIGHTS = {
  Happy:   { title: 'Positive Streak 🌟',   text: 'You\'ve been reading uplifting content lately. Keep enjoying the good news!' },
  Calm:    { title: 'Calm Mindset 🍃',      text: 'Your reading pattern shows a calm, balanced approach. Great for focus.' },
  Curious: { title: 'Curious Explorer 🔭',  text: 'You\'re diving into a variety of topics. Curiosity drives growth!' },
  Sad:     { title: 'Check In With Yourself 💙', text: 'Your recent reading may have been heavy. Try some lighter topics today.' },
  Anxious: { title: 'Take a Breath 🧘',     text: 'High-stress content detected recently. Consider a short break from news.' },
  Angry:   { title: 'Cool Down Tip 💨',     text: 'Intense news can be draining. Consider filtering for neutral content.' },
};

/* ── Custom Tooltip for Pie ─────────────────────────────── */
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const { name, value } = payload[0];
    const cfg = MOOD_CONFIG[name] || {};
    return (
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0',
        borderRadius: 10, padding: '10px 14px',
        boxShadow: '0 4px 16px rgba(15,23,42,0.10)',
        fontSize: '0.85rem', fontWeight: 600
      }}>
        <span style={{ marginRight: 6 }}>{cfg.icon}</span>
        <span style={{ color: cfg.color }}>{name}</span>
        <span style={{ color: '#94a3b8', marginLeft: 8 }}>{value} sessions</span>
      </div>
    );
  }
  return null;
};

/* ── Mood breakdown bar ─────────────────────────────────── */
function MoodBarRow({ name, value, total }) {
  const cfg = MOOD_CONFIG[name] || { color: '#cbd5e1', icon: '❓' };
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mood-bar-row">
      <span className="mood-bar-label">
        {cfg.icon} {name}
      </span>
      <div className="mood-bar-track">
        <div
          className="mood-bar-fill"
          style={{ width: `${pct}%`, background: cfg.color }}
        />
      </div>
      <span className="mood-bar-pct">{pct}%</span>
    </div>
  );
}

/* ── Main Dashboard ─────────────────────────────────────── */
function Dashboard({ userId, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await axios.get(`http://localhost:8000/analytics/${userId}`);
      if (res.data.status === 'success') {
        setData(res.data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <span>Loading your analytics…</span>
      </div>
    );
  }

  /* ── Empty ── */
  if (!data || !data.mood_data || data.mood_data.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📭</div>
        <h3>No data yet</h3>
        <p>Read a few articles first and your dashboard will come alive.</p>
        <button onClick={onClose} className="btn btn-primary">Back to News</button>
      </div>
    );
  }

  /* ── Derived values ── */
  const totalSessions = data.mood_data.reduce((sum, m) => sum + m.value, 0);
  const dominant      = data.mood_data.reduce((a, b) => a.value > b.value ? a : b, data.mood_data[0]);
  const dominantCfg   = MOOD_CONFIG[dominant?.name] || {};
  const insight       = MOOD_INSIGHTS[dominant?.name];
  const skipRate      = data.total_opens > 0
    ? Math.round((data.total_skips / (data.total_opens + data.total_skips)) * 100)
    : 0;
  const engagementRate = 100 - skipRate;

  const statCards = [
    { icon: '📖', value: data.total_opens,  label: 'Articles Read',    accent: '#3B82F6' },
    { icon: '⏭️', value: data.total_skips,  label: 'Skipped',          accent: '#EF4444' },
    { icon: '🎯', value: `${engagementRate}%`, label: 'Engagement',    accent: '#10B981' },
    { icon: '🧠', value: totalSessions,      label: 'Mood Sessions',   accent: '#8B5CF6' },
  ];

  return (
    <div className="dashboard-shell">

      {/* ── Header ── */}
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <h2>Wellbeing Dashboard 📊</h2>
          <p>
            {lastUpdated
              ? `Last updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Your personal reading insights'}
          </p>
        </div>
        <div className="dashboard-header-actions">
          <button
            className="btn btn-ghost"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            {refreshing ? '⏳' : '🔄'} Refresh
          </button>
          <button className="btn btn-close" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* ── Dominant mood badge ── */}
      {dominant && (
        <div
          className="dominant-mood-badge"
          style={{
            background: `${dominantCfg.color}18`,
            color: dominantCfg.color,
            borderColor: `${dominantCfg.color}30`
          }}
        >
          <span>{dominantCfg.icon}</span>
          Dominant mood today: <strong>{dominant.name}</strong>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="stat-cards">
        {statCards.map(card => (
          <div
            className="stat-card"
            key={card.label}
            style={{ '--card-accent': card.accent }}
          >
            <span className="stat-icon">{card.icon}</span>
            <p className="stat-value">{card.value}</p>
            <p className="stat-label">{card.label}</p>
          </div>
        ))}
      </div>

      {/* ── Insight ── */}
      {insight && (
        <div className="insight-card">
          <span className="insight-icon">💡</span>
          <div className="insight-text">
            <h4>{insight.title}</h4>
            <p>{insight.text}</p>
          </div>
        </div>
      )}

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

        {/* Pie chart */}
        <div className="chart-card">
          <h3>Emotional Footprint</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.mood_data}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {data.mood_data.map((entry, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={MOOD_CONFIG[entry.name]?.color || '#cbd5e1'}
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => (
                    <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mood breakdown bars */}
        <div className="chart-card">
          <h3>Mood Breakdown</h3>
          <div className="mood-bars">
            {[...data.mood_data]
              .sort((a, b) => b.value - a.value)
              .map(entry => (
                <MoodBarRow
                  key={entry.name}
                  name={entry.name}
                  value={entry.value}
                  total={totalSessions}
                />
              ))}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="dashboard-footer">
        <p>Data reflects your reading sessions since account creation.</p>
        <button className="btn btn-ghost" onClick={onClose}>
          ← Back to News
        </button>
      </div>

    </div>
  );
}

export default Dashboard;