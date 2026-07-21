import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

function Results() {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [photos, setPhotos] = useState({});
  const [electionName, setElectionName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchResults(); }, [electionId]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/results/${electionId}`);
      setResults(res.data.results);
      setPhotos(res.data.candidate_photos || {});
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
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    const maxVotes = sorted[0][1];
    const winners = sorted.filter(([_, count]) => count === maxVotes);
    return { winners, maxVotes };
  };

  const COLORS = ['#6CA2FF', '#3EB489', '#FFA726', '#FF6B6B', '#A78BFA', '#34D399'];

  if (loading) return <div style={styles.container}><p>Loading results...</p></div>;

  if (error) return (
    <div style={styles.container}>
      <p style={styles.error}>{error}</p>
      <button onClick={() => navigate(-1)} style={styles.button}>Go Back</button>
    </div>
  );

  const totalVotes = getTotalVotes();
  const winnerData = getWinners();
  const sortedEntries = Object.entries(results).sort((a, b) => b[1] - a[1]);
  const maxVotes = sortedEntries[0]?.[1] || 1;

  return (
    <div style={styles.container}>
      <h2 style={{ marginBottom: '0.3rem' }}>Election Results</h2>
      <h3 style={{ color: '#6CA2FF', marginBottom: '1.5rem' }}>{electionName}</h3>

      {/* Winner Banner */}
      {winnerData && (
        <div style={styles.winnerBanner}>
          {winnerData.winners.length === 1 ? (
            <span>🏆 Winner: <strong>{winnerData.winners[0][0]}</strong> with {winnerData.maxVotes} vote{winnerData.maxVotes !== 1 ? 's' : ''}</span>
          ) : (
            <span>🤝 Tie: <strong>{winnerData.winners.map(w => w[0]).join(', ')}</strong> — {winnerData.maxVotes} votes each</span>
          )}
        </div>
      )}

      {/* Bar Chart */}
      <div style={styles.chartBox}>
        <h4 style={{ marginBottom: '1.5rem', color: '#E6EEF8' }}>📊 Vote Chart</h4>
        <div style={styles.chartArea}>
          {sortedEntries.map(([candidate, count], idx) => {
            const heightPct = maxVotes > 0 ? (count / maxVotes) * 100 : 0;
            const color = COLORS[idx % COLORS.length];
            const photoUrl = photos[candidate];
            return (
              <div key={candidate} style={styles.barGroup}>
                {photoUrl ? (
                  <img src={photoUrl} alt={candidate} style={{ ...styles.candidatePhoto, borderColor: color }}
                    onError={e => { e.target.style.display = 'none'; }} />
                ) : (
                  <div style={{ ...styles.candidatePhotoFallback, borderColor: color }}>👤</div>
                )}
                <div style={styles.barWrapper}>
                  <span style={{ ...styles.barValue, color }}>{count}</span>
                  <div style={styles.barTrack}>
                    <div style={{
                      ...styles.barFill,
                      height: `${heightPct}%`,
                      background: `linear-gradient(180deg, ${color} 0%, ${color}88 100%)`,
                      boxShadow: `0 0 12px ${color}66`
                    }} />
                  </div>
                </div>
                <div style={{ ...styles.barLabel, color }}>{candidate}</div>
                <div style={styles.barPct}>
                  {totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Horizontal breakdown */}
      <div style={styles.resultsBox}>
        <h4 style={{ marginBottom: '1rem', color: '#E6EEF8' }}>Vote Breakdown</h4>
        {sortedEntries.map(([candidate, count], idx) => {
          const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0;
          const color = COLORS[idx % COLORS.length];
          const photoUrl = photos[candidate];
          return (
            <div key={candidate} style={styles.resultRow}>
              <div style={styles.candidateInfo}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {photoUrl ? (
                    <img src={photoUrl} alt={candidate} style={{ ...styles.rowPhoto, borderColor: color }}
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <span style={{ ...styles.rowPhotoFallback, borderColor: color }}>👤</span>
                  )}
                  <span style={{ ...styles.candidateName, color }}>{candidate}</span>
                </span>
                <span style={{ ...styles.percentage, color }}>{percentage}%</span>
              </div>
              <div style={styles.barContainer}>
                <div style={{
                  ...styles.bar,
                  width: `${percentage}%`,
                  background: `linear-gradient(90deg, ${color} 0%, ${color}88 100%)`
                }} />
              </div>
              <span style={styles.voteCount}>{count} vote{count !== 1 ? 's' : ''}</span>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div style={styles.summary}>
        <p><strong>Total Votes Cast:</strong> {totalVotes}</p>
      </div>

      <button onClick={() => navigate(-1)} style={styles.button}>← Go Back</button>
    </div>
  );
}

const styles = {
  container: {
    background: '#0F1725', color: '#E6EEF8', padding: '2rem',
    borderRadius: '12px', maxWidth: '860px', margin: '2rem auto',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
  },
  error: { color: '#FF6B6B', marginBottom: '1rem' },
  winnerBanner: {
    background: 'linear-gradient(135deg, #1a2a6c, #2d4a9e)',
    border: '1px solid #6CA2FF44',
    padding: '1.2rem', borderRadius: '12px',
    marginBottom: '1.5rem', textAlign: 'center',
    fontSize: '1.15rem', fontWeight: 'bold'
  },
  chartBox: {
    background: '#162033', border: '1px solid #263250',
    borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem'
  },
  chartArea: {
    display: 'flex', gap: '1.5rem', alignItems: 'flex-end',
    justifyContent: 'center', height: '220px', paddingBottom: '0.5rem'
  },
  barGroup: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', flex: 1, maxWidth: '120px'
  },
  candidatePhoto: {
    width: '48px', height: '48px', borderRadius: '50%',
    objectFit: 'cover', border: '2px solid', marginBottom: '0.5rem'
  },
  candidatePhotoFallback: {
    width: '48px', height: '48px', borderRadius: '50%',
    border: '2px solid', marginBottom: '0.5rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.4rem', background: '#0F1725'
  },
  rowPhoto: {
    width: '28px', height: '28px', borderRadius: '50%',
    objectFit: 'cover', border: '2px solid'
  },
  rowPhotoFallback: {
    width: '28px', height: '28px', borderRadius: '50%',
    border: '2px solid', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '0.9rem', background: '#0F1725'
  },
  barWrapper: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', height: '160px', width: '100%', justifyContent: 'flex-end'
  },
  barValue: {
    fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.3rem'
  },
  barTrack: {
    width: '60%', height: '140px', background: '#0F1725',
    borderRadius: '6px 6px 0 0', display: 'flex',
    alignItems: 'flex-end', overflow: 'hidden',
    border: '1px solid #263250'
  },
  barFill: {
    width: '100%', borderRadius: '6px 6px 0 0',
    transition: 'height 0.8s ease'
  },
  barLabel: {
    marginTop: '0.5rem', fontSize: '0.85rem',
    fontWeight: 700, textAlign: 'center', wordBreak: 'break-word'
  },
  barPct: {
    fontSize: '0.75rem', color: '#8899AA', marginTop: '0.2rem'
  },
  resultsBox: {
    background: '#162033', border: '1px solid #263250',
    borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem'
  },
  resultRow: { marginBottom: '1.2rem' },
  candidateInfo: {
    display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem'
  },
  candidateName: { fontSize: '1rem', fontWeight: 600 },
  percentage: { fontSize: '1rem', fontWeight: 700 },
  barContainer: {
    background: '#0F1725', height: '20px',
    borderRadius: '10px', overflow: 'hidden', marginBottom: '0.3rem'
  },
  bar: { height: '100%', borderRadius: '10px', transition: 'width 0.6s ease' },
  voteCount: { fontSize: '0.85rem', color: '#8899AA' },
  summary: {
    background: '#1B2537', borderRadius: '10px',
    padding: '1rem', textAlign: 'center', marginBottom: '1.5rem'
  },
  button: {
    padding: '0.9rem 1.5rem', background: '#6CA2FF',
    color: '#0B101A', border: 'none', borderRadius: '10px',
    cursor: 'pointer', fontWeight: 700, width: '100%', fontSize: '1rem'
  }
};

export default Results;