import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#6CA2FF', '#3EB489', '#FFA726', '#FF6B6B', '#A78BFA', '#34D399'];

function LiveResults({ electionId, token, candidates }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 5000);
    return () => clearInterval(interval);
  }, [electionId]);

  const fetchLive = async () => {
    try {
      const res = await api.get(`/admin/live-count/${electionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch {}
  };

  if (!data) return <div style={{ color: '#8899AA', fontSize: '0.85rem', padding: '0.5rem' }}>Loading...</div>;

  const total = data.total_votes;
  const entries = Object.entries(data.counts).sort((a, b) => b[1] - a[1]);

  return (
    <div style={liveStyles.box}>
      <div style={liveStyles.header}>
        📊 Live Vote Count — <span style={{ color: '#8CFAC7' }}>{total} vote{total !== 1 ? 's' : ''} so far</span>
        <span style={{ fontSize: '0.72rem', color: '#8899AA', marginLeft: '0.5rem' }}>(refreshes every 5s)</span>
      </div>
      {entries.map(([name, count], idx) => {
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        const color = COLORS[idx % COLORS.length];
        return (
          <div key={name} style={liveStyles.row}>
            <div style={liveStyles.rowTop}>
              <span style={{ ...liveStyles.name, color }}>{name}</span>
              <span style={{ ...liveStyles.count, color }}>{count} vote{count !== 1 ? 's' : ''} ({pct}%)</span>
            </div>
            <div style={liveStyles.track}>
              <div style={{
                ...liveStyles.fill,
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${color}, ${color}88)`,
                boxShadow: `0 0 8px ${color}66`
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const liveStyles = {
  box: { marginTop: '0.8rem', background: '#0B1220', border: '1px solid #263250', borderRadius: '10px', padding: '1rem' },
  header: { fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.8rem', color: '#E6EEF8' },
  row: { marginBottom: '0.7rem' },
  rowTop: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' },
  name: { fontSize: '0.88rem', fontWeight: 600 },
  count: { fontSize: '0.82rem', fontWeight: 700 },
  track: { background: '#162033', height: '14px', borderRadius: '7px', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: '7px', transition: 'width 0.5s ease', minWidth: count => count > 0 ? '4px' : '0' }
};

function AdminPanel({ token }) {
  const [electionName, setElectionName] = useState('');
  const [candidates, setCandidates] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [elections, setElections] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchElections();
    const interval = setInterval(fetchElections, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchElections = async () => {
    try {
      const res = await api.get('/elections', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setElections(res.data);
    } catch (err) {
      console.error('Failed to fetch elections');
    }
  };

  const createElection = async () => {
    setError(''); setMessage('');
    try {
      const candidateList = candidates.split(',').map(s => s.trim()).filter(Boolean);
      const duration = durationMinutes ? parseInt(durationMinutes, 10) : 0;
      const res = await api.post('/admin/election',
        { name: electionName, candidates: candidateList, duration_minutes: duration },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(`Election created (ID: ${res.data.election_id}).`);
      fetchElections();
      setElectionName(''); setCandidates(''); setDurationMinutes('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create election');
    }
  };

  const deleteElection = async (electionId) => {
    if (!window.confirm(`Delete election ${electionId}? This cannot be undone.`)) return;
    setError(''); setMessage('');
    try {
      await api.delete(`/admin/election/${electionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(`Election ${electionId} deleted`);
      fetchElections();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete election');
    }
  };

  const viewShares = async (electionId) => {
    setError(''); setMessage('');
    try {
      const res = await api.get(`/admin/election/${electionId}/shares`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const sharesFormatted = res.data.shares.map((s, i) => `Trustee ${i+1} Share: ${JSON.stringify(s)}`).join('\n');
      alert(`Trustee Shares for Election ${electionId}:\n\n${sharesFormatted}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to retrieve shares');
    }
  };

  const autoTally = async (electionId) => {
    setError(''); setMessage('');
    try {
      await api.post(`/admin/tally-auto/${electionId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(`Election ${electionId} tallied! Click "View Results" to see them.`);
      fetchElections();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to auto-tally election');
    }
  };

  const viewResults = (electionId) => navigate(`/results/${electionId}`);

  const isVotingEnded = (election) => {
    if (!election.end_time) return true;
    return new Date() > new Date(election.end_time);
  };

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  return (
    <div style={styles.container}>
      <h2>Admin Panel</h2>

      <div style={styles.section}>
        <h3>Create New Election</h3>
        <input type="text" placeholder="Election name" value={electionName}
          onChange={e => setElectionName(e.target.value)} style={styles.input} />
        <input type="text" placeholder="Candidates (comma separated)" value={candidates}
          onChange={e => setCandidates(e.target.value)} style={styles.input} />
        <input type="number" placeholder="Voting duration (minutes, 0=no limit)" value={durationMinutes}
          onChange={e => setDurationMinutes(e.target.value)} style={styles.input} />
        <button onClick={createElection} style={styles.buttonPrimary}>Create Election</button>
      </div>

      <div style={styles.section}>
        <h3>Manage Elections</h3>
        {elections.length === 0 && <p>No elections yet.</p>}
        {elections.map(e => (
          <div key={e.id} style={styles.electionCard}>
            <div style={{ flex: 1 }}>
              <div style={styles.electionRow}>
                <div>
                  <strong>ID: {e.id}</strong> — {e.name}
                  <span style={{ ...styles.statusBadge, background: e.status === 'active' ? '#1B3A2F' : '#2A2000', color: e.status === 'active' ? '#8CFAC7' : '#FFA726', border: `1px solid ${e.status === 'active' ? '#2E6B50' : '#7A5200'}` }}>
                    {e.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {/* Live count toggle — always visible */}
                  <button onClick={() => toggleExpand(e.id)} style={styles.buttonLive}>
                    {expandedId === e.id ? '▲ Hide Live' : '📊 Live Count'}
                  </button>
                  {e.status === 'active' && isVotingEnded(e) && (
                    <button onClick={() => autoTally(e.id)} style={styles.buttonSuccess}>Tally</button>
                  )}
                  {e.status === 'tallied' && (
                    <button onClick={() => viewResults(e.id)} style={styles.buttonInfo}>View Results</button>
                  )}
                  <button onClick={() => viewShares(e.id)} style={styles.buttonSecondary}>View Shares</button>
                  <button onClick={() => deleteElection(e.id)} style={styles.buttonDanger}>Delete</button>
                </div>
              </div>

              {e.end_time && e.status === 'active' && (
                <div style={{ fontSize: '0.82rem', color: isVotingEnded(e) ? '#8CFAC7' : '#FFA726', marginTop: '0.3rem' }}>
                  {isVotingEnded(e) ? '✅ Voting ended — ready to tally' : `⏰ Ends: ${new Date(e.end_time).toLocaleString()}`}
                </div>
              )}

              {/* Live results panel */}
              {expandedId === e.id && (
                <LiveResults electionId={e.id} token={token} candidates={e.candidates} />
              )}
            </div>
          </div>
        ))}
      </div>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles = {
  container: { background: '#0F1725', color: '#E6EEF8', padding: '2rem', borderRadius: '12px', maxWidth: '960px', margin: '0 auto', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' },
  section: { marginBottom: '1.6rem', background: '#162033', border: '1px solid #263250', borderRadius: '12px', padding: '1.2rem' },
  input: { width: '100%', padding: '0.9rem', marginBottom: '0.9rem', borderRadius: '10px', border: '1px solid #2C3958', background: '#0F1725', color: '#E6EEF8' },
  electionCard: { display: 'flex', padding: '0.9rem', background: '#0F1725', border: '1px solid #2C3958', borderRadius: '8px', marginBottom: '0.6rem' },
  electionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' },
  statusBadge: { marginLeft: '0.5rem', padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 },
  buttonPrimary: { padding: '0.9rem 1.2rem', background: '#6CA2FF', color: '#0B101A', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 },
  buttonSecondary: { padding: '0.6rem 0.9rem', background: '#1B2537', color: '#E6EEF8', border: '1px solid #2C3958', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' },
  buttonDanger: { padding: '0.6rem 0.9rem', background: '#FF6B6B', color: '#0B101A', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' },
  buttonSuccess: { padding: '0.6rem 0.9rem', background: '#3EB489', color: '#0B101A', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' },
  buttonInfo: { padding: '0.6rem 0.9rem', background: '#FFA726', color: '#0B101A', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' },
  buttonLive: { padding: '0.6rem 0.9rem', background: '#1B2B44', color: '#6CA2FF', border: '1px solid #6CA2FF44', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' },
  success: { color: '#8CFAC7', marginTop: '0.6rem' },
  error: { color: '#FF8686', marginTop: '0.6rem' },
};

export default AdminPanel;