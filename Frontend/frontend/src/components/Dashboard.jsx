import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import './Dashboard.css';

/* ── Visual Color Schemes and Emoji Indicators ────────────── */
const MOOD_CONFIG = {
  Happy:   { color: '#F59E0B', icon: '😊' },
  Calm:    { color: '#10B981', icon: '😌' },
  Curious: { color: '#3B82F6', icon: '🤔' },
  Sad:     { color: '#64748b', icon: '😢' },
  Anxious: { color: '#8B5CF6', icon: '😰' },
  Angry:   { color: '#EF4444', icon: '😠' },
};

/* ── Context-Driven Affective Feedback Insights ──────────── */
const MOOD_INSIGHTS = {
  Happy:   { title: 'Positive Streak 🌟',   text: 'You have been consuming uplifting news. Keep enjoying constructive stories!' },
  Calm:    { title: 'Calm Mindset 🍃',      text: 'Your telemetry displays a relaxed, paced reading pattern. Ideal for retention.' },
  Curious: { title: 'Curious Explorer 🔭',  text: 'High engagement across diverse topic clusters. Curiosity drives learning!' },
  Sad:     { title: 'Check In With Yourself 💙', text: 'Recent content consumption leans heavy. Consider switching to lighter topics.' },
  Anxious: { title: 'Take a Breath 🧘',     text: 'Fast scrolling and high skips detected. Consider taking a brief break from digital media.' },
  Angry:   { title: 'Cool Down Tip 💨',     text: 'Emotionally volatile content identified. Consider browsing neutral categories.' },
};

/* ── Custom Pie Chart Tooltip ────────────────────────────── */
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const { name, value } = payload[0];
    const cfg = MOOD_CONFIG[name] || {};
    return (
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 4px 16px rgba(15,23,42,0.10)',
        fontSize: '0.85rem',
        fontWeight: 600
      }}>
        <span style={{ marginRight: 6 }}>{cfg.icon}</span>
        <span style={{ color: cfg.color }}>{name}</span>
        <span style={{ color: '#94a3b8', marginLeft: 8 }}>{value} sessions</span>
      </div>
    );
  }
  return null;
};

/* ── Percentage Distribution Progress Bar ────────────────── */
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

/* ── Main Wellbeing Analytics Dashboard ──────────────────── */
function Dashboard({ userId, onClose }) {
  const [rawPayload,   setRawPayload]   = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [lastUpdated,  setLastUpdated]  = useState(null);
  const [timeRange,    setTimeRange]    = useState('today');
  const [isMounted,    setIsMounted]    = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await axios.get(`http://localhost:8000/analytics/${userId}`);
      if (res.data.status === 'success') {
        setRawPayload(res.data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to load user analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <span>Loading personal insights…</span>
      </div>
    );
  }

  const currentDataset = timeRange === 'today' ? rawPayload?.today : rawPayload?.all_time;
  const moodList       = currentDataset?.mood_data || [];
  const totalSessions  = moodList.reduce((sum, m) => sum + m.value, 0);

  if (!currentDataset || totalSessions === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📭</div>
        <h3>No activity {timeRange === 'today' ? 'today' : 'recorded'}</h3>
        <p>No behavioral interactions logged for this timeframe.</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 15, justifyContent: 'center' }}>
          {timeRange === 'today' && (
            <button onClick={() => setTimeRange('all_time')} className="btn btn-primary">
              View All-Time Data
            </button>
          )}
          <button onClick={onClose} className="btn btn-ghost">Back to News</button>
        </div>
      </div>
    );
  }

  const dominant = moodList.reduce((a, b) => (a.value > b.value ? a : b), moodList[0]);
  const dominantCfg = MOOD_CONFIG[dominant?.name] || {};
  const insight = MOOD_INSIGHTS[dominant?.name];

  const totalOpens = currentDataset.total_opens || 0;
  const totalSkips = currentDataset.total_skips || 0;
  const skipRate = totalOpens > 0 ? Math.round((totalSkips / (totalOpens + totalSkips)) * 100) : 0;
  const engagementRate = 100 - skipRate;

  const statCards = [
    { icon: '📖', value: totalOpens, label: timeRange === 'today' ? 'Read Today' : 'Total Read', accent: '#3B82F6' },
    { icon: '⏭️', value: totalSkips, label: timeRange === 'today' ? 'Skipped Today' : 'Total Skips', accent: '#EF4444' },
    { icon: '🎯', value: `${engagementRate}%`, label: 'Engagement', accent: '#10B981' },
    { icon: '🧠', value: totalSessions, label: 'Mood Logs', accent: '#8B5CF6' },
  ];

  return (
    <div className="dashboard-shell">
      {/* ── Header & Mode Switcher ── */}
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <h2>Wellbeing Dashboard 📊</h2>
          <p>
            {lastUpdated
              ? `Last updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Your reading analytics'}
          </p>
        </div>

        <div className="dashboard-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#f1f5f9', padding: '3px', borderRadius: '8px', display: 'flex' }}>
            <button
              className={`btn ${timeRange === 'today' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '5px 12px', fontSize: '0.85rem' }}
              onClick={() => setTimeRange('today')}
            >
              Today
            </button>
            <button
              className={`btn ${timeRange === 'all_time' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '5px 12px', fontSize: '0.85rem' }}
              onClick={() => setTimeRange('all_time')}
            >
              All-Time
            </button>
          </div>

          <button className="btn btn-ghost" onClick={() => fetchData(true)} disabled={refreshing}>
            {refreshing ? '⏳' : '🔄'}
          </button>
          <button className="btn btn-close" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* ── Active Dominant Mood ── */}
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
          Dominant mood ({timeRange === 'today' ? 'Today' : 'All-Time'}): <strong>{dominant.name}</strong>
        </div>
      )}

      {/* ── Statistical Metric Tiles ── */}
      <div className="stat-cards">
        {statCards.map(card => (
          <div className="stat-card" key={card.label} style={{ '--card-accent': card.accent }}>
            <span className="stat-icon">{card.icon}</span>
            <p className="stat-value">{card.value}</p>
            <p className="stat-label">{card.label}</p>
          </div>
        ))}
      </div>

      {/* ── Affective Suggestion Card ── */}
      {insight && (
        <div className="insight-card">
          <span className="insight-icon">💡</span>
          <div className="insight-text">
            <h4>{insight.title}</h4>
            <p>{insight.text}</p>
          </div>
        </div>
      )}

      {/* ── Visual Analytics (Pie and Progress Breakdown) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, marginTop: 16 }}>
        <div className="chart-card">
          <h3>Emotional Footprint</h3>
          <div style={{ width: '100%', height: 260, minHeight: 260, position: 'relative' }}>
            {isMounted && (
              <ResponsiveContainer width="99%" height={260} minHeight={260} minWidth={100}>
                <PieChart>
                  <Pie
                    data={moodList.filter(m => m.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {moodList.map((entry, i) => (
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
            )}
          </div>
        </div>

        <div className="chart-card">
          <h3>Mood Breakdown</h3>
          <div className="mood-bars">
            {[...moodList]
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
        <p>
          {timeRange === 'today'
            ? 'Displaying active reading interactions recorded today.'
            : 'Aggregated historical reading data since profile creation.'}
        </p>
        <button className="btn btn-ghost" onClick={onClose}>
          ← Back to News
        </button>
      </div>
    </div>
  );
}

export default Dashboard;