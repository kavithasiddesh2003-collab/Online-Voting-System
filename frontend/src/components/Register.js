import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

function Register() {
  const [fullName, setFullName]   = useState('');
  const [phone, setPhone]         = useState('');
  const [voterId, setVoterId]     = useState('');
  const [dob, setDob]             = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agree, setAgree]         = useState(false);
  const [message, setMessage]     = useState('');
  const [error, setError]         = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const navigate = useNavigate();

  // Expected password: first 4 letters of name (Cap+lower) + birth day (dd)
  const expectedPassword = useMemo(() => {
    const namePart = fullName.trim().replace(/\s+/g, '').slice(0, 4);
    const nameFormatted = namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
    if (!dob) return nameFormatted || '';
    const [, , dd] = dob.split('-');
    return nameFormatted + (dd || '');
  }, [fullName, dob]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (!agree) { setError('Please accept the terms to continue.'); return; }
    if (!fullName.trim()) { setError('Enter your full name.'); return; }
    if (!phone || phone.length !== 10) { setError('Enter a valid 10-digit phone number.'); return; }
    if (!dob) { setError('Date of birth is required.'); return; }
    if (password !== expectedPassword) { setError(`Incorrect password. Use your first 4 name letters + birth day. Example: ${expectedPassword || 'Kavi22'}`); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    try {
      await api.post('/register', { name: fullName.trim(), phone: `+91${phone}`, voter_id: voterId, dob, password });
      setMessage('Registration successful!');
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Request could not be completed.');
    }
  };

  return (
    <div style={s.page}>
      <button onClick={() => navigate('/')} style={s.backBtn}>← Back</button>
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
                type="tel" inputMode="numeric" placeholder=""
                maxLength={10} value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} required />
            </div>
          </div>

          {/* Voter ID + DOB row */}
          <div style={s.row2}>
            <div style={{ ...s.fieldGroup, flex: 1 }}>
              <label style={s.label}>VOTER ID</label>
              <input style={s.input} type="text" placeholder=""
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
              <div style={s.passRow}>
                <input style={{ ...s.input, flex: 1 }} type={showPass ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPass(p => !p)} style={s.eyeBtn}>
                  {showPass ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
              <p style={s.passHint}>
                💡 First 4 letters of name + birth day.{' '}
                {expectedPassword
                  ? <span>Your password: <strong style={{ color: '#7B61FF' }}>{expectedPassword}</strong></span>
                  : null}
              </p>
            </div>
            <div style={{ ...s.fieldGroup, flex: 1 }}>
              <label style={s.label}>CONFIRM</label>
              <div style={s.passRow}>
                <input style={{ ...s.input, flex: 1 }} type={showConfirm ? 'text' : 'password'}
                  value={confirm} onChange={e => setConfirm(e.target.value)} required />
                <button type="button" onClick={() => setShowConfirm(p => !p)} style={s.eyeBtn}>
                  {showConfirm ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
            </div>
          </div>

          {/* Checkbox */}
          <label style={s.checkbox}>
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)}
              style={{ accentColor: '#7B61FF', width: '16px', height: '16px' }} />
            <span style={{ color: '#9b97ad', fontSize: '0.85rem' }}>
              I agree to the{' '}
              <span onClick={() => setShowTerms(true)} style={{ color: '#7B61FF', cursor: 'pointer', textDecoration: 'underline' }}>
                Terms &amp; Privacy Policy
              </span>
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

      {/* Terms Modal */}
      {showTerms && (
        <div style={s.overlay} onClick={() => setShowTerms(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Terms &amp; Privacy Policy</h2>
              <button onClick={() => setShowTerms(false)} style={s.closeBtn}>✕</button>
            </div>
            <div style={s.modalBody}>

              <h3 style={s.sectionTitle}>1. Eligibility</h3>
              <p style={s.para}>You must be a registered voter as verified by the election authority. Only individuals whose phone numbers appear on the official voter roll are permitted to register and vote on this platform. Providing false information during registration is a punishable offence under applicable law.</p>

              <h3 style={s.sectionTitle}>2. One Person, One Vote</h3>
              <p style={s.para}>Each registered voter is entitled to cast exactly one vote per election. The system enforces this through duplicate-vote prevention mechanisms. Any attempt to circumvent this rule will result in permanent disqualification and may be reported to relevant authorities.</p>

              <h3 style={s.sectionTitle}>3. Account Security</h3>
              <p style={s.para}>You are solely responsible for keeping your credentials confidential. Do not share your password, Voter ID, or OTP with anyone — including individuals claiming to be election officials. The election authority will never ask for your OTP over call or message.</p>

              <h3 style={s.sectionTitle}>4. Voting Process</h3>
              <p style={s.para}>All votes are encrypted end-to-end using Paillier Homomorphic Encryption before leaving your device. The server never sees your individual vote in plain text. Votes are tallied cryptographically and results are published only after the election closes.</p>

              <h3 style={s.sectionTitle}>5. Admin Approval</h3>
              <p style={s.para}>Your registration is subject to approval by the election administrator. You will not be able to log in or vote until your account has been approved. The admin reserves the right to reject registrations that cannot be verified.</p>

              <h3 style={s.sectionTitle}>6. Privacy Policy</h3>
              <p style={s.para}>Your personal data (name, phone number, Voter ID, date of birth) is collected solely for the purpose of verifying your identity and enabling your participation in elections. This data is stored securely and will not be shared with any third party. Your vote is anonymous and cannot be traced back to you.</p>

              <h3 style={s.sectionTitle}>7. Prohibited Conduct</h3>
              <p style={s.para}>You agree not to attempt to hack, reverse-engineer, or tamper with the voting system. You agree not to impersonate another voter or cast votes on their behalf. Any breach of these terms may result in legal action.</p>

              <h3 style={s.sectionTitle}>8. Disclaimer</h3>
              <p style={s.para}>The election authority is not liable for votes lost due to technical issues beyond its control, including network outages or device failures. In the event of a technical dispute, the bulletin board records shall be considered the authoritative source of truth.</p>

              <h3 style={s.sectionTitle}>9. Acceptance</h3>
              <p style={s.para}>By checking "I agree" and submitting your registration, you confirm that you have read, understood, and accepted these Terms &amp; Privacy Policy in full.</p>

            </div>
            <div style={s.modalFooter}>
              <button onClick={() => { setAgree(true); setShowTerms(false); }} style={s.acceptBtn}>
                ✓ I Accept
              </button>
              <button onClick={() => setShowTerms(false)} style={s.declineBtn}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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
    position: 'relative',
    background: '#16151f', borderRadius: '20px', padding: '2.5rem 2rem',
    width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
  },
  backBtn: {
    position: 'fixed', top: '1.2rem', left: '1.5rem',
    background: 'transparent', border: 'none', color: '#7B61FF',
    fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', padding: '0',
    zIndex: 100
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
  passHint: { color: '#9b97ad', fontSize: '0.72rem', marginTop: '0.35rem', lineHeight: 1.5 },
  passRow: { display: 'flex', alignItems: 'stretch', gap: '0.5rem' },
  eyeBtn: {
    background: '#1e1d2a', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', color: '#9b97ad', fontSize: '1rem',
    cursor: 'pointer', padding: '0 0.8rem', flexShrink: 0
  },
  passHint: {
    color: '#9b97ad', fontSize: '0.75rem', marginTop: '0.4rem', lineHeight: 1.5
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
  footer: { textAlign: 'center', color: '#9b97ad', fontSize: '0.88rem', marginTop: '1.2rem' },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '1rem'
  },
  modal: {
    background: '#16151f', borderRadius: '16px', width: '100%', maxWidth: '520px',
    maxHeight: '85vh', display: 'flex', flexDirection: 'column',
    border: '1px solid rgba(123,97,255,0.3)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1.2rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)'
  },
  modalTitle: { color: '#7B61FF', fontSize: '1.1rem', fontWeight: 700, margin: 0 },
  closeBtn: {
    background: 'transparent', border: 'none', color: '#9b97ad',
    fontSize: '1.1rem', cursor: 'pointer', padding: '0.2rem 0.4rem', lineHeight: 1
  },
  modalBody: {
    overflowY: 'auto', padding: '1.2rem 1.5rem', flex: 1,
    scrollbarWidth: 'thin', scrollbarColor: '#7B61FF #1e1d2a'
  },
  sectionTitle: { color: '#e0dff5', fontSize: '0.9rem', fontWeight: 700, margin: '1rem 0 0.35rem' },
  para: { color: '#9b97ad', fontSize: '0.83rem', lineHeight: 1.65, margin: 0 },
  modalFooter: {
    display: 'flex', gap: '0.8rem', padding: '1rem 1.5rem',
    borderTop: '1px solid rgba(255,255,255,0.07)'
  },
  acceptBtn: {
    flex: 1, padding: '0.75rem', background: 'linear-gradient(135deg, #7B61FF, #6848ff)',
    color: '#fff', border: 'none', borderRadius: '10px', fontSize: '0.9rem',
    fontWeight: 600, cursor: 'pointer'
  },
  declineBtn: {
    padding: '0.75rem 1.2rem', background: 'transparent',
    color: '#9b97ad', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', fontSize: '0.9rem', cursor: 'pointer'
  },
};

export default Register;