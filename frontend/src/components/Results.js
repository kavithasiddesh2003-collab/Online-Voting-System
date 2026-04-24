import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

function Results() {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [electionName, setElectionName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, [electionId]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/results/${electionId}`);
      setResults(res.data.results);
      setElectionName(res.data.name);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const getTotalVotes = () => {
    if (!results) return 0;
    return Object.values(results).reduce((sum, count) => sum + count, 0);
  };

  const getWinners = () => {
    if (!results) return null;
    const entries = Object.entries(results);
    if (entries.length === 0) return null;
    
    // Sort by vote count descending
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    const maxVotes = sorted[0][1];
    
    // Get all candidates with max votes (handles ties)
    const winners = sorted.filter(([_, count]) => count === maxVotes);
    
    return { winners, maxVotes };
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <p>Loading results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <p style={styles.error}>{error}</p>
        <button onClick={() => navigate(-1)} style={styles.button}>Go Back</button>
      </div>
    );
  }

  const totalVotes = getTotalVotes();
  const winnerData = getWinners();

  return (
    <div style={styles.container}>
      <h2>Election Results</h2>
      <h3 style={{color:'#6CA2FF',marginTop:'0.5rem'}}>ID: {electionId} - {electionName}</h3>
      
      {winnerData && winnerData.winners.length > 0 && (
        <div style={styles.winnerBanner}>
          {winnerData.winners.length === 1 ? (
            <span style={{fontSize:'1.2rem'}}>
              🏆 Winner: <strong>{winnerData.winners[0][0]}</strong> with {winnerData.maxVotes} vote{winnerData.maxVotes !== 1 ? 's' : ''}
            </span>
          ) : (
            <span style={{fontSize:'1.2rem'}}>
              🤝 Tie between: <strong>{winnerData.winners.map(w => w[0]).join(', ')}</strong> with {winnerData.maxVotes} vote{winnerData.maxVotes !== 1 ? 's' : ''} each
            </span>
          )}
        </div>
      )}

      <div style={styles.resultsBox}>
        <h4>Vote Breakdown</h4>
        {Object.entries(results).sort((a, b) => b[1] - a[1]).map(([candidate, count]) => {
          const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0;
          return (
            <div key={candidate} style={styles.resultRow}>
              <div style={styles.candidateInfo}>
                <span style={styles.candidateName}>{candidate}</span>
                <span style={styles.percentage}>{percentage}%</span>
              </div>
              <div style={styles.barContainer}>
                <div style={{...styles.bar, width: `${percentage}%`}}></div>
              </div>
              <span style={styles.voteCount}>{count} vote{count !== 1 ? 's' : ''}</span>
            </div>
          );
        })}
      </div>

      <div style={styles.summary}>
        <p><strong>Total Votes:</strong> {totalVotes}</p>
      </div>

      <button onClick={() => navigate(-1)} style={styles.button}>Go Back</button>
    </div>
  );
}

const styles = {
  container: { background: '#0F1725', color: '#E6EEF8', padding: '2rem', borderRadius: '12px', maxWidth: '800px', margin: '2rem auto', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' },
  error: { color: '#FF6B6B', marginBottom: '1rem' },
  winnerBanner: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '1.2rem', borderRadius: '12px', marginTop: '1.5rem', textAlign: 'center', fontWeight: 'bold' },
  resultsBox: { background: '#162033', border: '1px solid #263250', borderRadius: '12px', padding: '1.5rem', marginTop: '1.5rem' },
  resultRow: { marginBottom: '1.5rem' },
  candidateInfo: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' },
  candidateName: { fontSize: '1.1rem', fontWeight: 600 },
  percentage: { fontSize: '1rem', color: '#6CA2FF' },
  barContainer: { background: '#0F1725', height: '24px', borderRadius: '12px', overflow: 'hidden', marginBottom: '0.3rem' },
  bar: { background: 'linear-gradient(90deg, #3EB489 0%, #6CA2FF 100%)', height: '100%', transition: 'width 0.5s ease' },
  voteCount: { fontSize: '0.9rem', color: '#AAB' },
  summary: { marginTop: '1.5rem', padding: '1rem', background: '#1B2537', borderRadius: '10px', textAlign: 'center' },
  button: { marginTop: '1.5rem', padding: '0.9rem 1.5rem', background: '#6CA2FF', color: '#0B101A', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, width: '100%' }
};

export default Results;
