import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

function VoterPanel({ token, user }) {
  const [elections, setElections] = useState([]);
  const [votedIds, setVotedIds] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchElections();
    loadVotedIds();
  }, []);

  const fetchElections = async () => {
    try {
      const res = await api.get('/elections', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setElections(res.data);
    } catch {
      setError('Failed to load elections. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadVotedIds = () => {
    try {
      const stored = localStorage.getItem(`voted_${user?.id}`);
      if (stored) setVotedIds(JSON.parse(stored));
    } catch {
      setVotedIds([]);
    }
  };

  const markVoted = (electionId) => {
    const updated = [...votedIds, electionId];
    setVotedIds(updated);
    localStorage.setItem(`voted_${user?.id}`, JSON.stringify(updated));
  };

  const handleVote = (electionId) => {
    navigate(`/vote/${electionId}`, { state: { onVoteSuccess: () => markVoted(electionId) } });
  };

  const handleResults = (electionId) => {
    navigate(`/results/${electionId}`);
  };

  const activeElections = elections.filter(e => e.status === 'active');
  const talliedElections = elections.filter(e => e.status === 'tallied');
  const pendingElections = elections.filter(e => e.status !== 'active' && e.status !== 'tallied');

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingBox}>
          <div style={styles.spinner} />
          <p style={{ color: '#8CFAC7', marginTop: '1rem' }}>Loading elections...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🗳️ Voter Dashboard</h1>
          <p style={styles.subtitle}>Welcome, <strong style={{ color: '#6CA2FF' }}>{user?.name}</strong> — Cast your vote securely</p>
        </div>
        <div style={styles.badge}>
          <span style={styles.badgeDot} />
          Voter
        </div>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* Stats Row */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <span style={{ ...styles.statNumber, color: '#6CA2FF' }}>{activeElections.length}</span>
          <span style={styles.statLabel}>Active Elections</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statNumber, color: '#8CFAC7' }}>{votedIds.length}</span>
          <span style={styles.statLabel}>Votes Cast</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statNumber, color: '#FFA726' }}>{talliedElections.length}</span>
          <span style={styles.statLabel}>Results Available</span>
        </div>
      </div>

      {/* Active Elections */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>
          <span style={{ ...styles.dot, background: '#8CFAC7' }} /> Active Elections
        </h2>
        {activeElections.length === 0 ? (
          <div style={styles.emptyCard}>No active elections at the moment.</div>
        ) : (
          activeElections.map(e => {
            const hasVoted = votedIds.includes(e.id);
            return (
              <div key={e.id} style={styles.electionCard}>
                <div style={styles.cardLeft}>
                  <h3 style={styles.electionName}>{e.name}</h3>
                  <div style={styles.candidateRow}>
                    {e.candidates.map((c, i) => (
                      <span key={i} style={styles.candidateChip}>{c}</span>
                    ))}
                  </div>
                  {e.end_time && (
                    <p style={styles.endTime}>
                      ⏰ Voting ends: {new Date(e.end_time).toLocaleString()}
                    </p>
                  )}
                </div>
                <div style={styles.cardRight}>
                  {hasVoted ? (
                    <div style={styles.votedBadge}>✅ Voted</div>
                  ) : (
                    <button onClick={() => handleVote(e.id)} style={styles.voteBtn}>
                      🔒 Vote Now
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Results Available */}
      {talliedElections.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            <span style={{ ...styles.dot, background: '#FFA726' }} /> Results Available
          </h2>
          {talliedElections.map(e => (
            <div key={e.id} style={{ ...styles.electionCard, opacity: 0.85 }}>
              <div style={styles.cardLeft}>
                <h3 style={styles.electionName}>{e.name}</h3>
                <div style={styles.candidateRow}>
                  {e.candidates.map((c, i) => (
                    <span key={i} style={styles.candidateChip}>{c}</span>
                  ))}
                </div>
              </div>
              <div style={styles.cardRight}>
                <button onClick={() => handleResults(e.id)} style={styles.resultsBtn}>
                  📊 View Results
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Pending Elections */}
      {pendingElections.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            <span style={{ ...styles.dot, background: '#AAB' }} /> Upcoming / Pending
          </h2>
          {pendingElections.map(e => (
            <div key={e.id} style={{ ...styles.electionCard, opacity: 0.5 }}>
              <div style={styles.cardLeft}>
                <h3 style={styles.electionName}>{e.name}</h3>
                <p style={{ color: '#AAB', fontSize: '0.85rem', margin: '0.3rem 0 0 0' }}>
                  Status: {e.status.toUpperCase()}
                </p>
              </div>
              <div style={styles.cardRight}>
                <div style={styles.pendingBadge}>⏳ Not yet open</div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Info Footer */}
      <div style={styles.infoBox}>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#8899AA' }}>
          🔐 All votes are encrypted using Paillier homomorphic encryption. Your vote is anonymous and tamper-proof.
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    background: '#0B101A',
    minHeight: '100vh',
    color: '#E6EEF8',
    padding: '2rem',
    fontFamily: 'system-ui, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem'
  },
  title: {
    margin: '0 0 0.3rem 0',
    fontSize: '1.8rem',
    color: '#E6EEF8'
  },
  subtitle: {
    margin: 0,
    color: '#8899AA',
    fontSize: '1rem'
  },
  badge: {
    background: '#162033',
    border: '1px solid #27324F',
    color: '#6CA2FF',
    padding: '0.4rem 1rem',
    borderRadius: '999px',
    fontWeight: 700,
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem'
  },
  badgeDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#8CFAC7',
    display: 'inline-block'
  },
  statsRow: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '2rem',
    flexWrap: 'wrap'
  },
  statCard: {
    flex: '1 1 150px',
    background: '#162033',
    border: '1px solid #27324F',
    borderRadius: '12px',
    padding: '1.2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.3rem'
  },
  statNumber: {
    fontSize: '2rem',
    fontWeight: 800
  },
  statLabel: {
    color: '#8899AA',
    fontSize: '0.85rem'
  },
  section: {
    marginBottom: '2rem'
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#E6EEF8',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block'
  },
  electionCard: {
    background: '#162033',
    border: '1px solid #27324F',
    borderRadius: '12px',
    padding: '1.2rem 1.5rem',
    marginBottom: '0.8rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap'
  },
  cardLeft: {
    flex: 1
  },
  cardRight: {
    flexShrink: 0
  },
  electionName: {
    margin: '0 0 0.5rem 0',
    fontSize: '1.1rem',
    color: '#E6EEF8'
  },
  candidateRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem'
  },
  candidateChip: {
    background: '#1E2B44',
    border: '1px solid #3A4F70',
    color: '#A0B4D0',
    padding: '0.2rem 0.7rem',
    borderRadius: '999px',
    fontSize: '0.8rem'
  },
  endTime: {
    margin: '0.5rem 0 0 0',
    fontSize: '0.82rem',
    color: '#FFF59D'
  },
  voteBtn: {
    background: '#6CA2FF',
    color: '#0B101A',
    border: 'none',
    padding: '0.7rem 1.4rem',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer'
  },
  votedBadge: {
    background: '#1B3A2F',
    color: '#8CFAC7',
    border: '1px solid #2E6B50',
    padding: '0.5rem 1rem',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '0.9rem'
  },
  resultsBtn: {
    background: '#FFA726',
    color: '#0B101A',
    border: 'none',
    padding: '0.7rem 1.4rem',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer'
  },
  pendingBadge: {
    background: '#1B2537',
    color: '#8899AA',
    border: '1px solid #27324F',
    padding: '0.5rem 1rem',
    borderRadius: '10px',
    fontSize: '0.9rem'
  },
  emptyCard: {
    background: '#162033',
    border: '1px dashed #27324F',
    borderRadius: '12px',
    padding: '1.5rem',
    color: '#8899AA',
    textAlign: 'center'
  },
  errorBanner: {
    background: '#2A1A1A',
    border: '1px solid #FF6B6B',
    color: '#FF6B6B',
    padding: '0.8rem 1rem',
    borderRadius: '10px',
    marginBottom: '1.5rem'
  },
  infoBox: {
    background: '#162033',
    border: '1px solid #27324F',
    borderRadius: '10px',
    padding: '1rem 1.2rem',
    marginTop: '1rem'
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #27324F',
    borderTop: '4px solid #6CA2FF',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }
};

export default VoterPanel;
