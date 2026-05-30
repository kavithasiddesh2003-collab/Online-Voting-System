import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

function ElectionList({ token, user }) {
  const [elections, setElections] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchElections();
  }, []);

  const fetchElections = async () => {
    try {
      const res = await api.get('/elections', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setElections(res.data);
    } catch (err) {
      setError('Failed to load elections');
    }
  };

  const handleVote = (electionId) => {
    navigate(`/vote/${electionId}`);
  };

  const viewResults = (electionId) => {
    navigate(`/results/${electionId}`);
  };

  return (
    <div style={styles.container}>
      <h2>Elections</h2>
      {error && <p style={styles.error}>{error}</p>}
      {elections.length === 0 && <p>No elections available</p>}
      {elections.map(e => (
        <div key={e.id} style={styles.card}>
          <div>
            <h3 style={{ margin: '0 0 0.3rem 0' }}>ID: {e.id} - {e.name}</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#AAB' }}>
              Candidates: {e.candidates.join(', ')}
            </p>
            <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: e.status === 'active' ? '#8CFAC7' : '#FFA726' }}>
              Status: {e.status.toUpperCase()}
            </p>
            {e.end_time && e.status === 'active' && (
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: '#FF8' }}>
                Voting ends: {new Date(e.end_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </p>
            )}
          </div>
          <div style={{display:'flex',gap:'0.5rem'}}>
            {e.status === 'active' && (
              <button onClick={() => handleVote(e.id)} style={styles.button}>Vote</button>
            )}
            {e.status === 'tallied' && (
              <button onClick={() => viewResults(e.id)} style={styles.buttonResults}>View Results</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: { background: '#101826', color: '#E6EEF8', padding: '1.6rem', borderRadius: '12px', maxWidth: '900px', margin: '0 auto' },
  card: { background: '#162033', border: '1px solid #27324F', color: '#E6EEF8', padding: '1rem', borderRadius: '10px', marginBottom: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  button: { padding: '0.7rem 1rem', background: '#6CA2FF', color: '#0B101A', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' },
  buttonResults: { padding: '0.7rem 1rem', background: '#FFA726', color: '#0B101A', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' },
  error: { color: '#FF6B6B' }
};

export default ElectionList;