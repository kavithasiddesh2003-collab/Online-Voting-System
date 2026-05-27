import React, { useState, useEffect } from 'react';
import api from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import PaillierJS from '../utils/crypto';
import CryptoJS from 'crypto-js';

function VoteForm({ token, user }) {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const [election, setElection] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchElection(); }, []);

  const fetchElection = async () => {
    try {
      const response = await api.get('/elections', { headers: { Authorization: `Bearer ${token}` } });
      const found = response.data.find(e => e.id === parseInt(electionId));
      setElection(found);
      setLoading(false);
    } catch {
      setError('Failed to load election');
      setLoading(false);
    }
  };

  const handleVote = async () => {
    if (user?.role === 'admin') { setError('Admins are not allowed to vote'); return; }
    if (selectedCandidate === null) { setError('Please select a candidate'); return; }
    setError(''); setMessage('Encrypting vote...');
    try {
      const paillier = new PaillierJS();
      paillier.setPublicKey(election.public_key);
      const ciphertextString = paillier.encrypt(1n);
      const voteData = {
        election_id: parseInt(electionId, 10),
        ciphertext: JSON.stringify({ candidate_index: selectedCandidate, value: ciphertextString }),
        anon_hash: CryptoJS.SHA256(`${user.id}_${electionId}_salt`).toString()
      };
      await api.post('/vote', voteData, { headers: { Authorization: `Bearer ${token}` } });
      setMessage('Vote submitted successfully! ✅');
      setTimeout(() => navigate('/voter', { state: { justVoted: Date.now() } }), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit vote');
    }
  };

  if (loading) return <div style={styles.container}>Loading...</div>;
  if (!election) return <div style={styles.container}>Election not found</div>;
  if (user?.role === 'admin') return <div style={styles.container}><h2>{election.name}</h2><p style={{ color: '#FF6B6B' }}>Admins cannot vote.</p></div>;

  return (
    <div style={styles.container}>
      <h2 style={{ marginBottom: '0.3rem' }}>{election.name}</h2>
      <p style={{ color: '#8899AA', marginBottom: '1.5rem' }}>Select your candidate:</p>

      <div style={styles.candidates}>
        {election.candidates.map((candidate, idx) => {
          const photo = election.candidate_photos && election.candidate_photos[idx];
          const isSelected = selectedCandidate === idx;
          return (
            <div key={idx}
              style={{ ...styles.candidate, ...(isSelected ? styles.candidateSelected : {}) }}
              onClick={() => setSelectedCandidate(idx)}
            >
              {/* Photo */}
              <div style={styles.photoWrapper}>
                {photo ? (
                  <img src={photo} alt={candidate} style={styles.photo}
                    onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                ) : null}
                <div style={{ ...styles.photoPlaceholder, display: photo ? 'none' : 'flex' }}>👤</div>
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={styles.candidateName}>{candidate}</div>
                {isSelected && <div style={styles.selectedTag}>✓ Selected</div>}
              </div>

              {/* Radio */}
              <input type="radio" name="candidate" checked={isSelected}
                onChange={() => setSelectedCandidate(idx)}
                style={{ accentColor: '#6CA2FF', width: '18px', height: '18px' }} />
            </div>
          );
        })}
      </div>

      <button onClick={handleVote} style={styles.button}>🔒 Encrypt & Submit Vote</button>
      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles = {
  container: { background: '#121826', color: '#E6EEF8', padding: '2rem', borderRadius: '12px', maxWidth: '720px', margin: '2rem auto', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' },
  candidates: { display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1.5rem 0' },
  candidate: { padding: '1rem 1.2rem', background: '#1B2537', borderRadius: '12px', cursor: 'pointer', border: '2px solid transparent', display: 'flex', alignItems: 'center', gap: '1rem', color: '#E6EEF8', transition: 'all 0.2s ease' },
  candidateSelected: { border: '2px solid #6CA2FF', background: '#1E2B44', boxShadow: '0 0 16px rgba(108,162,255,0.2)' },
  photoWrapper: { width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid #2C3958', position: 'relative', background: '#0F1725' },
  photo: { width: '100%', height: '100%', objectFit: 'cover' },
  photoPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' },
  candidateName: { fontSize: '1.1rem', fontWeight: 700 },
  selectedTag: { fontSize: '0.8rem', color: '#6CA2FF', marginTop: '0.2rem', fontWeight: 600 },
  button: { width: '100%', padding: '1rem', background: '#3EB489', color: '#0B101A', border: 'none', borderRadius: '10px', fontSize: '1.05rem', cursor: 'pointer', fontWeight: 700 },
  success: { color: '#8CFAC7', marginTop: '1rem', textAlign: 'center' },
  error: { color: '#FF6B6B', marginTop: '1rem', textAlign: 'center' }
};

export default VoteForm;