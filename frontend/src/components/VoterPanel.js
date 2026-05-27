import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

function VoterPanel({ token, user }) {
  const [elections, setElections] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const activeRef  = useRef(null);
  const resultsRef = useRef(null);
  const votedRef   = useRef(null);

  useEffect(() => { fetchElections(); }, []);

  const fetchElections = async () => {
    try {
      const res = await api.get('/elections', { headers: { Authorization: `Bearer ${token}` } });
      setElections(res.data);
    } catch { setError('Failed to load elections. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleVote = (electionId) => navigate(`/vote/${electionId}`);
  const handleResults = (electionId) => navigate(`/results/${electionId}`);

  const activeElections   = elections.filter(e => e.status === 'active');
  const talliedElections  = elections.filter(e => e.status === 'tallied');
  const pendingElections  = elections.filter(e => e.status !== 'active' && e.status !== 'tallied');

  if (loading) return (
    <div className="vp-page">
      <style>{vpStyles}</style>
      <div className="vp-loading">
        <div className="vp-spinner" />
        <p style={{ color: '#8CFAC7', marginTop: '1rem' }}>Loading elections...</p>
      </div>
    </div>
  );

  return (
    <div className="vp-page">
      <style>{vpStyles}</style>

      {/* Header */}
      <div className="vp-header">
        <div>
          <h1 className="vp-title">🗳️ Voter Dashboard</h1>
          <p className="vp-subtitle">Welcome, <strong style={{ color: '#6CA2FF' }}>{user?.name}</strong></p>
        </div>
        <div className="vp-badge"><span className="vp-badge-dot" />Voter</div>
      </div>

      {error && <div className="vp-error">{error}</div>}

      {/* Stat Cards */}
      <div className="vp-stats">
        {[
          { icon: '🗳️', value: activeElections.length, label: 'Active Elections', color: '#6CA2FF', glow: 'rgba(108,162,255,0.3)' },
          { icon: '✅', value: elections.filter(e => e.has_voted).length, label: 'Votes Cast', color: '#8CFAC7', glow: 'rgba(140,250,199,0.3)' },
          { icon: '📊', value: talliedElections.length, label: 'Results Ready',    color: '#FFA726', glow: 'rgba(255,167,38,0.3)'  },
        ].map((s, i) => (
          <div key={i} className="vp-stat-card" style={{ '--glow': s.glow, borderColor: `${s.color}33` }}
            onClick={() => {
              const targets = [activeRef, votedRef, resultsRef];
              targets[i]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}>
            <span className="vp-stat-icon">{s.icon}</span>
            <span className="vp-stat-num" style={{ color: s.color }}>{s.value}</span>
            <span className="vp-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Active Elections */}
      <section className="vp-section" ref={activeRef}>
        <h2 className="vp-section-title"><span className="vp-dot" style={{ background: '#8CFAC7' }} />Active Elections</h2>
        {activeElections.length === 0
          ? <div className="vp-empty">No active elections at the moment.</div>
          : activeElections.map(e => {
              const hasVoted   = e.has_voted;
              const notStarted = e.start_time && new Date() < new Date(e.start_time);
              return (
                <div key={e.id} className="vp-card">
                  <div className="vp-card-left">
                    <h3 className="vp-election-name">{e.name}</h3>
                    <div className="vp-chips">
                      {e.candidates.map((c, i) => <span key={i} className="vp-chip">{c}</span>)}
                    </div>
                    {e.start_time && <p className="vp-time" style={{ color: notStarted ? '#FF6B6B' : '#8CFAC7' }}>🗓️ Starts: {new Date(e.start_time).toLocaleString()}</p>}
                    {e.end_time   && <p className="vp-time">⏰ Ends: {new Date(e.end_time).toLocaleString()}</p>}
                  </div>
                  <div className="vp-card-right">
                    {hasVoted   ? <div className="vp-voted-badge">✅ Voted</div>
                    : notStarted ? <div className="vp-not-started-badge">🕒 Not Started</div>
                    : <button className="vp-vote-btn" onClick={() => handleVote(e.id)}>🔒 Vote Now</button>}
                  </div>
                </div>
              );
            })
        }
      </section>

      {/* Results */}
      {talliedElections.length > 0 && (
        <section className="vp-section" ref={resultsRef}>
          <h2 className="vp-section-title"><span className="vp-dot" style={{ background: '#FFA726' }} />Results Available</h2>
          {talliedElections.map(e => (
            <div key={e.id} className="vp-card" style={{ opacity: 0.9 }}>
              <div className="vp-card-left">
                <h3 className="vp-election-name">{e.name}</h3>
                <div className="vp-chips">{e.candidates.map((c, i) => <span key={i} className="vp-chip">{c}</span>)}</div>
              </div>
              <div className="vp-card-right">
                <button className="vp-results-btn" onClick={() => handleResults(e.id)}>📊 View Results</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Votes Cast anchor */}
      <div ref={votedRef} />

      {/* Pending */}
      {pendingElections.length > 0 && (
        <section className="vp-section">
          <h2 className="vp-section-title"><span className="vp-dot" style={{ background: '#556' }} />Upcoming</h2>
          {pendingElections.map(e => (
            <div key={e.id} className="vp-card" style={{ opacity: 0.5 }}>
              <div className="vp-card-left">
                <h3 className="vp-election-name">{e.name}</h3>
                <p style={{ color: '#8899AA', fontSize: '0.85rem', margin: '0.3rem 0 0' }}>Status: {e.status.toUpperCase()}</p>
              </div>
              <div className="vp-card-right"><div className="vp-pending-badge">⏳ Not yet open</div></div>
            </div>
          ))}
        </section>
      )}

      <div className="vp-info">🔐 All votes are encrypted using Paillier homomorphic encryption. Your vote is anonymous and tamper-proof.</div>
    </div>
  );
}

const vpStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  .vp-page { background: #0B101A; min-height: 100vh; color: #E6EEF8; padding: 1.5rem; font-family: 'Inter', system-ui, sans-serif; max-width: 900px; margin: 0 auto; }
  .vp-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.8rem; margin-bottom: 1.5rem; }
  .vp-title { margin: 0 0 0.2rem; font-size: clamp(1.3rem, 5vw, 1.8rem); font-family: 'Orbitron', monospace; color: #E6EEF8; }
  .vp-subtitle { margin: 0; color: #8899AA; font-size: clamp(0.85rem, 3vw, 1rem); }
  .vp-badge { background: #162033; border: 1px solid #27324F; color: #6CA2FF; padding: 0.4rem 1rem; border-radius: 999px; font-weight: 700; font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem; }
  .vp-badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #8CFAC7; display: inline-block; }
  .vp-error { background: #2A1A1A; border: 1px solid #FF6B6B; color: #FF6B6B; padding: 0.8rem 1rem; border-radius: 10px; margin-bottom: 1.2rem; }

  /* Stat Cards */
  .vp-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.8rem; margin-bottom: 1.5rem; }
  @media (max-width: 480px) { .vp-stats { grid-template-columns: 1fr; } }
  .vp-stat-card { background: rgba(15,25,50,0.85); border-radius: 16px; padding: 1.1rem 0.8rem; text-align: center; cursor: pointer; position: relative; overflow: hidden; border: 1px solid rgba(108,162,255,0.15); user-select: none; transition: transform 0.2s, box-shadow 0.2s; }
  .vp-stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 30px var(--glow); }
  .vp-stat-card:active { transform: scale(0.97); }
  .vp-stat-card.dancing { animation: vp-dance 0.7s cubic-bezier(0.36,0.07,0.19,0.97); }
  .vp-stat-icon { font-size: 1.4rem; display: block; margin-bottom: 0.3rem; }
  .vp-stat-num { display: block; font-size: clamp(1.6rem, 6vw, 2.2rem); font-weight: 800; font-family: 'Orbitron', monospace; line-height: 1.1; margin-bottom: 0.3rem; }
  .vp-stat-label { font-size: clamp(0.62rem, 2vw, 0.72rem); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #8899AA; }

  /* Elections */
  .vp-section { margin-bottom: 1.8rem; }
  .vp-section-title { font-size: clamp(0.95rem, 3vw, 1.1rem); font-weight: 700; color: #E6EEF8; margin-bottom: 0.8rem; display: flex; align-items: center; gap: 0.5rem; }
  .vp-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .vp-card { background: #162033; border: 1px solid #27324F; border-radius: 12px; padding: 1rem 1.2rem; margin-bottom: 0.7rem; display: flex; justify-content: space-between; align-items: center; gap: 0.8rem; flex-wrap: wrap; transition: border-color 0.2s; }
  .vp-card:hover { border-color: #3A4F70; }
  .vp-card-left { flex: 1; min-width: 0; }
  .vp-card-right { flex-shrink: 0; }
  .vp-election-name { margin: 0 0 0.5rem; font-size: clamp(0.95rem, 3.5vw, 1.1rem); color: #E6EEF8; word-break: break-word; }
  .vp-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .vp-chip { background: #1E2B44; border: 1px solid #3A4F70; color: #A0B4D0; padding: 0.18rem 0.6rem; border-radius: 999px; font-size: clamp(0.7rem, 2.5vw, 0.8rem); }
  .vp-time { margin: 0.4rem 0 0; font-size: clamp(0.72rem, 2.5vw, 0.82rem); color: #FFF59D; }

  /* Buttons & Badges */
  .vp-vote-btn { background: linear-gradient(135deg, #6CA2FF, #4A7FE0); color: #0B101A; border: none; padding: clamp(0.55rem, 2vw, 0.7rem) clamp(1rem, 3vw, 1.4rem); border-radius: 10px; font-weight: 700; font-size: clamp(0.82rem, 3vw, 0.95rem); cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; white-space: nowrap; }
  .vp-vote-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(108,162,255,0.4); }
  .vp-vote-btn:active { transform: scale(0.97); }
  .vp-results-btn { background: linear-gradient(135deg, #FFA726, #E08A00); color: #0B101A; border: none; padding: clamp(0.55rem, 2vw, 0.7rem) clamp(1rem, 3vw, 1.4rem); border-radius: 10px; font-weight: 700; font-size: clamp(0.82rem, 3vw, 0.95rem); cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; white-space: nowrap; }
  .vp-results-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(255,167,38,0.4); }
  .vp-voted-badge { background: #1B3A2F; color: #8CFAC7; border: 1px solid #2E6B50; padding: 0.5rem 1rem; border-radius: 10px; font-weight: 700; font-size: clamp(0.8rem, 3vw, 0.9rem); white-space: nowrap; }
  .vp-not-started-badge { background: #2A1F00; color: #FFA726; border: 1px solid #7A5200; padding: 0.5rem 1rem; border-radius: 10px; font-weight: 700; font-size: clamp(0.8rem, 3vw, 0.9rem); white-space: nowrap; }
  .vp-pending-badge { background: #1B2537; color: #8899AA; border: 1px solid #27324F; padding: 0.5rem 1rem; border-radius: 10px; font-size: clamp(0.8rem, 3vw, 0.9rem); }
  .vp-empty { background: #162033; border: 1px dashed #27324F; border-radius: 12px; padding: 1.5rem; color: #8899AA; text-align: center; font-size: 0.9rem; }
  .vp-info { background: #162033; border: 1px solid #27324F; border-radius: 10px; padding: 0.9rem 1.1rem; margin-top: 1rem; font-size: clamp(0.75rem, 2.5vw, 0.85rem); color: #8899AA; line-height: 1.5; }

  /* Loading */
  .vp-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; }
  .vp-spinner { width: 40px; height: 40px; border: 4px solid #27324F; border-top: 4px solid #6CA2FF; border-radius: 50%; animation: vp-spin 1s linear infinite; }

  /* Animations */
  @keyframes vp-pulse {
    0%   { transform: scale(1); }
    50%  { transform: scale(0.96); }
    100% { transform: scale(1); }
  }
  .vp-stat-card:active { animation: vp-pulse 0.15s ease; }
  @keyframes vp-spin { to { transform: rotate(360deg); } }
`;

export default VoterPanel;