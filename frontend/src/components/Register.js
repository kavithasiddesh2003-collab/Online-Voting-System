import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

function Register() {
  const [fullName, setFullName]   = useState('');
  const [phone, setPhone]         = useState('');
  const [voterId, setVoterId]     = useState('');
  const [dob, setDob]             = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [agree, setAgree]         = useState(false);
  const [message, setMessage]     = useState('');
  const [error, setError]         = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (!agree) { setError('Please accept the terms to continue.'); return; }
    if (!fullName.trim()) { setError('Enter your full name.'); return; }
    if (!phone || phone.length !== 10) { setError('Enter a valid 10-digit phone number.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    try {
      const response = await api.post('/register', { name: fullName.trim(), phone: `+91${phone}` });
      setMessage(`${response.data.message} You can sign in from the login page.`);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Request could not be completed.');
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.iconWrap}>📋</div>
        <h1 style={s.title}>Register</h1>
        <p style={s.subtitle}>Create your voter account</p>

        <form onSubmit={handleSubmit}>
          {/* Full Name */}
          <div style={s.fieldGroup}>
            <label style={s.label}>FULL NAME</label>
            <input style={s.input} type="text" placeholder="Enter your full name"
              value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>

          {/* Phone */}
          <div style={s.fieldGroup}>
            <label style={s.label}>PHONE NUMBER</label>
            <div style={s.phoneRow}>
              <span style={s.phonePrefix}>+91</span>
              <input style={{ ...s.input, borderRadius: '0 12px 12px 0', borderLeft: 'none', flex: 1 }}
                type="tel" inputMode="numeric" placeholder="98765 43210"
                maxLength={10} value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} required />
            </div>
          </div>

          {/* Voter ID + DOB row */}
          <div style={s.row2}>
            <div style={{ ...s.fieldGroup, flex: 1 }}>
              <label style={s.label}>VOTER ID</label>
              <input style={s.input} type="text" placeholder="e.g. VOT12345"
                value={voterId} onChange={e => setVoterId(e.target.value)} />
            </div>
            <div style={{ ...s.fieldGroup, flex: 1 }}>
              <label style={s.label}>DATE OF BIRTH</label>
              <input style={s.input} type="date"
                value={dob} onChange={e => setDob(e.target.value)} />
            </div>
          </div>

          {/* Password + Confirm row */}
          <div style={s.row2}>
            <div style={{ ...s.fieldGroup, flex: 1 }}>
              <label style={s.label}>PASSWORD</label>
              <input style={s.input} type="password" placeholder="Min 8 chars"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div style={{ ...s.fieldGroup, flex: 1 }}>
              <label style={s.label}>CONFIRM</label>
              <input style={s.input} type="password" placeholder="Re-enter"
                value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
          </div>

          {/* Checkbox */}
          <label style={s.checkbox}>
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)}
              style={{ accentColor: '#7B61FF', width: '16px', height: '16px' }} />
            <span style={{ color: '#9b97ad', fontSize: '0.85rem' }}>
              I agree to the <a href="/#" style={{ color: '#7B61FF' }}>Terms &amp; Privacy Policy</a>
            </span>
          </label>

          {message && <div style={s.msgSuccess}>{message}</div>}
          {error   && <div style={s.msgError}>{error}</div>}

          <button type="submit" style={s.btn}>📋 Create Account</button>
        </form>

        <p style={s.footer}>
          Already have an account? <Link to="/login" style={{ color: '#7B61FF', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh', background: '#0f0e17',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter', system-ui, sans-serif", padding: '2rem'
  },
  card: {
    background: '#16151f', borderRadius: '20px', padding: '2.5rem 2rem',
    width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
  },
  iconWrap: { fontSize: '2rem', textAlign: 'center', marginBottom: '0.5rem' },
  title: { color: '#7B61FF', fontSize: '2rem', fontWeight: 700, textAlign: 'center', margin: '0 0 0.3rem' },
  subtitle: { color: '#9b97ad', textAlign: 'center', marginBottom: '1.8rem', fontSize: '0.95rem' },
  fieldGroup: { marginBottom: '1.1rem' },
  label: { display: 'block', color: '#9b97ad', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '0.4rem' },
  input: {
    width: '100%', padding: '0.85rem 1rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)', background: '#1e1d2a',
    color: '#f4f4f8', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  },
  phoneRow: { display: 'flex', alignItems: 'stretch' },
  phonePrefix: {
    padding: '0.85rem 1rem', background: '#2a2940',
    border: '1px solid rgba(255,255,255,0.08)', borderRight: 'none',
    borderRadius: '12px 0 0 12px', color: '#7B61FF', fontWeight: 600,
    fontSize: '0.95rem', whiteSpace: 'nowrap'
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0' },
  checkbox: { display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '1rem 0' },
  btn: {
    width: '100%', padding: '1rem', background: 'linear-gradient(135deg, #7B61FF, #6848ff)',
    color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1rem',
    fontWeight: 600, cursor: 'pointer', marginTop: '0.5rem',
    boxShadow: '0 4px 20px rgba(123,97,255,0.4)'
  },
  msgSuccess: { background: 'rgba(46,204,113,0.12)', color: '#2ecc71', border: '1px solid rgba(46,204,113,0.25)', borderRadius: '10px', padding: '0.65rem 0.85rem', fontSize: '0.88rem', marginBottom: '0.8rem' },
  msgError: { background: 'rgba(231,76,60,0.12)', color: '#ff8a80', border: '1px solid rgba(231,76,60,0.25)', borderRadius: '10px', padding: '0.65rem 0.85rem', fontSize: '0.88rem', marginBottom: '0.8rem' },
  footer: { textAlign: 'center', color: '#9b97ad', fontSize: '0.88rem', marginTop: '1.2rem' }
};

export default Register;