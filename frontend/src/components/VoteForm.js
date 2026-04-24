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
      const response = await api.get('/elections', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const foundElection = response.data.find(e => e.id === parseInt(electionId));
      setElection(foundElection);
      setLoading(false);
    } catch (err) {
      setError('Failed to load election');
      setLoading(false);
    }
  };

  const handleVote = async () => {
    if (user?.role === 'admin') {
      setError('Admins are not allowed to vote');
      return;
    }
    if (selectedCandidate === null) {
      setError('Please select a candidate');
      return;
    }
    setError(''); setMessage('Encrypting vote...');

    try {
      const paillier = new PaillierJS();
      paillier.setPublicKey(election.public_key);
      const ciphertextString = paillier.encrypt(1n);
      const anonHash = CryptoJS.SHA256(`${user.id}_${electionId}_salt`).toString();

      const voteData = {
        election_id: parseInt(electionId, 10 ),
        ciphertext: JSON.stringify({ candidate_index: selectedCandidate, value: ciphertextString }),
        anon_hash: CryptoJS.SHA256(`${user.id}_${electionId}_salt`).toString()
      };

      await api.post('/vote', voteData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage('Vote submitted successfully! ✅');
      setTimeout(() => navigate('/elections'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit vote');
    }
  };

  if (loading) return <div style={styles.container}>Loading...</div>;
  if (!election) return <div style={styles.container}>Election not found</div>;
  if (user?.role === 'admin') {
    return (
      <div style={styles.container}>
        <h2>{election.name}</h2>
        <p style={{ color: '#e74c3c' }}>Admins are not allowed to vote.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2>{election.name}</h2>
      <p>Select your candidate:</p>
      <div style={styles.candidates}>
        {election.candidates.map((candidate, idx) => (
          <div
            key={idx}
            style={{ ...styles.candidate, ...(selectedCandidate === idx ? styles.candidateSelected : {}) }}
            onClick={() => setSelectedCandidate(idx)}
          >
            <input type="radio" name="candidate" checked={selectedCandidate === idx} onChange={() => setSelectedCandidate(idx)} />
            <label style={styles.label}>{candidate}</label>
          </div>
        ))}
      </div>
      <button onClick={handleVote} style={styles.button}>🔒 Encrypt & Submit Vote</button>
      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles = {
  container: {
    background: '#121826',          // dark background
    color: '#E6EEF8',               // light text
    padding: '2rem',
    borderRadius: '12px',
    maxWidth: '720px',
    margin: '0 auto',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
  },
  candidates: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    margin: '1.5rem 0'
  },
  candidate: {
    padding: '1rem',
    background: '#1B2537',         // surface
    borderRadius: '10px',
    cursor: 'pointer',
    border: '2px solid transparent',
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    color: '#E6EEF8'
  },
  candidateSelected: {
    border: '2px solid #6CA2FF',   // accessible accent
    background: '#1E2B44'
  },
  label: {
    cursor: 'pointer',
    fontSize: '1.05rem'
  },
  button: {
    width: '100%',
    padding: '1rem',
    background: '#3EB489',         // teal-green, high contrast on dark
    color: '#0B101A',              // dark text on light button
    border: 'none',
    borderRadius: '10px',
    fontSize: '1.05rem',
    cursor: 'pointer',
    fontWeight: 700
  },
  success: {
    color: '#8CFAC7',              // success on dark
    marginTop: '1rem',
    textAlign: 'center'
  },
  error: {
    color: '#FF6B6B',              // error on dark
    marginTop: '1rem',
    textAlign: 'center'
  }
};


export default VoteForm;
