import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

function AdminPanel({ token }) {
  const [electionName, setElectionName] = useState('');
  const [candidates, setCandidates] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [elections, setElections] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchElections();
    // Refresh elections every 10 seconds to update button visibility
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
      setMessage(`Election created (ID: ${res.data.election_id}). Trustee shares printed in backend console.`);
      fetchElections();
      setElectionName('');
      setCandidates('');
      setDurationMinutes('');
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
      const res = await api.post(`/admin/tally-auto/${electionId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(`Election ${electionId} tallied successfully! Click "View Results" to see them.`);
      fetchElections();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to auto-tally election');
    }
  };

  const viewResults = (electionId) => {
    navigate(`/results/${electionId}`);
  };

  const isVotingEnded = (election) => {
    if (!election.end_time) return true; // No time limit, allow tally anytime
    const endTime = new Date(election.end_time);
    const now = new Date();
    return now > endTime;
  };

  return (
    <div style={styles.container}>
      <h2>Admin Panel</h2>

      <div style={styles.section}>
        <h3>Create New Election</h3>
        <input
          type="text"
          placeholder="Election name"
          value={electionName}
          onChange={e => setElectionName(e.target.value)}
          style={styles.input}
        />
        <input
          type="text"
          placeholder="Candidates (comma separated)"
          value={candidates}
          onChange={e => setCandidates(e.target.value)}
          style={styles.input}
        />
        <input
          type="number"
          placeholder="Voting duration (minutes, 0=no limit)"
          value={durationMinutes}
          onChange={e => setDurationMinutes(e.target.value)}
          style={styles.input}
        />
        <button onClick={createElection} style={styles.buttonPrimary}>Create Election</button>
      </div>

      <div style={styles.section}>
        <h3>Manage Elections</h3>
        {elections.length === 0 && <p>No elections yet.</p>}
        {elections.map(e => (
          <div key={e.id} style={styles.electionCard}>
            <div>
              <strong>ID: {e.id}</strong> - {e.name} ({e.status})
              {e.end_time && e.status === 'active' && (
                <div style={{fontSize:'0.85rem',color: isVotingEnded(e) ? '#8CFAC7' : '#FFA726'}}>
                  {isVotingEnded(e) ? 'Voting ended' : `Ends: ${new Date(e.end_time).toLocaleString()}`}
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:'0.5rem'}}>
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
  buttonPrimary: { padding: '0.9rem 1.2rem', background: '#6CA2FF', color: '#0B101A', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 },
  buttonSecondary: { padding: '0.7rem 1rem', background: '#1B2537', color: '#E6EEF8', border: '1px solid #2C3958', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 },
  buttonDanger: { padding: '0.7rem 1rem', background: '#FF6B6B', color: '#0B101A', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 },
  buttonSuccess: { padding: '0.7rem 1rem', background: '#3EB489', color: '#0B101A', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 },
  buttonInfo: { padding: '0.7rem 1rem', background: '#FFA726', color: '#0B101A', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 },
  success: { color: '#8CFAC7', marginTop: '0.6rem' },
  error: { color: '#FF8686', marginTop: '0.6rem' },
  electionCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem', background: '#0F1725', border: '1px solid #2C3958', borderRadius: '8px', marginBottom: '0.6rem' }
};

export default AdminPanel;
