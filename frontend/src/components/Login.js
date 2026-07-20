import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

function Login({ onLogin }) {
  const [tab, setTab]           = useState('voter');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [otp, setOtp]           = useState('');
  const [otpSent, setOtpSent]   = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sending, setSending]   = useState(false);
  const [msg, setMsg]           = useState('');
  const [error, setError]       = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleVoterLogin = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (/[A-Z]/.test(password)) { setError('Password must be lowercase only.'); return; }
    try {
      const res = await api.post('/auth', { phone: `+91${phone.trim()}`, password, otp: otp.trim() });
      const { token, user } = res.data;
      sessionStorage.setItem('sv_token', token);
      sessionStorage.setItem('sv_user', JSON.stringify(user));
      onLogin(user, token);
    } catch (err) {
      setError(err.response?.data?.error || 'Sign-in failed.');
    }
  };

  const requestOtp = async () => {
    setMsg(''); setError('');
    const ph = phone.trim();
    if (!ph || ph.length !== 10) { setError('Enter a valid 10-digit phone number first.'); return; }
    if (!password.trim()) { setError('Enter your password before requesting an OTP.'); return; }
    setSending(true);
    try {
      await api.post('/request-otp', { phone: `+91${ph}`, password: password.trim() });
      setOtpSent(true);
      setSecondsLeft(180);
      setMsg('OTP sent! Check your phone or backend terminal.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send OTP.');
    } finally { setSending(false); }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    try {
      const res = await api.post('/admin-login', { email: email.trim(), password });
      const { token, user } = res.data;
      sessionStorage.setItem('sv_token', token);
      sessionStorage.setItem('sv_user', JSON.stringify(user));
      onLogin(user, token);
    } catch (err) {
      setError(err.response?.data?.error || 'Admin sign-in failed.');
    }
  };

  return (
    <div className="lg-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .lg-root { min-height: 100vh; width: 100vw; background: #020b1a; display: flex; align-items: center; justify-content: center; font-family: 'Rajdhani', sans-serif; position: relative; overflow: hidden; }
        .lg-blob1 { position: fixed; width: 500px; height: 500px; border-radius: 50%; background: radial-gradient(circle, rgba(0,102,255,0.07) 0%, transparent 70%); top: -120px; left: -120px; pointer-events: none; z-index: 0; }
        .lg-blob2 { position: fixed; width: 400px; height: 400px; border-radius: 50%; background: radial-gradient(circle, rgba(0,229,255,0.05) 0%, transparent 70%); bottom: -100px; right: -100px; pointer-events: none; z-index: 0; }
        .lg-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: flex-end; padding: 1rem 2rem; background: rgba(2,11,26,0.7); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(0,229,255,0.10); }
        .lg-back { font-family: 'Orbitron', monospace; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.12em; padding: 0.45rem 1.2rem; border-radius: 3px; cursor: pointer; text-transform: uppercase; transition: all 0.25s ease; background: transparent; border: 1px solid rgba(0,229,255,0.4); color: #00e5ff; text-decoration: none; }
        .lg-back:hover { background: rgba(0,229,255,0.08); box-shadow: 0 0 16px rgba(0,229,255,0.3); }
        .lg-card { position: relative; z-index: 10; width: 100%; max-width: 460px; padding: 2.5rem 2.8rem; background: rgba(0,18,45,0.75); border: 1px solid rgba(0,229,255,0.18); backdrop-filter: blur(16px); animation: lg-fadeUp 0.8s ease both; margin-top: 3rem; }
        .lg-c { position: absolute; width: 18px; height: 18px; border-color: #00e5ff; border-style: solid; }
        .lg-c-tl { top:-1px; left:-1px; border-width:2px 0 0 2px; } .lg-c-tr { top:-1px; right:-1px; border-width:2px 2px 0 0; }
        .lg-c-bl { bottom:-1px; left:-1px; border-width:0 0 2px 2px; } .lg-c-br { bottom:-1px; right:-1px; border-width:0 2px 2px 0; }
        .lg-card-label { position: absolute; top: -0.65rem; left: 50%; transform: translateX(-50%); font-family: 'Orbitron', monospace; font-size: 0.48rem; letter-spacing: 0.28em; color: #00e5ff; background: #020b1a; padding: 0 0.8rem; white-space: nowrap; opacity: 0.75; }
        .lg-title { font-family: 'Orbitron', monospace; font-size: 1.4rem; font-weight: 900; color: #fff; letter-spacing: 0.06em; text-align: center; text-shadow: 0 0 20px rgba(0,229,255,0.3); margin-bottom: 1.2rem; }
        .lg-tabs { display: flex; margin-bottom: 1.5rem; border: 1px solid rgba(0,229,255,0.2); border-radius: 6px; overflow: hidden; }
        .lg-tab { flex: 1; padding: 0.65rem; font-family: 'Orbitron', monospace; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border: none; transition: all 0.2s ease; }
        .lg-tab-active { background: rgba(0,229,255,0.15); color: #00e5ff; }
        .lg-tab-inactive { background: transparent; color: rgba(0,229,255,0.35); }
        .lg-field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }
        .lg-field label { font-family: 'Orbitron', monospace; font-size: 0.52rem; letter-spacing: 0.2em; color: rgba(0,229,255,0.6); text-transform: uppercase; }
        .lg-field input { background: rgba(0,30,70,0.6); border: 1px solid rgba(0,229,255,0.2); color: #e0f4ff; font-family: 'Rajdhani', sans-serif; font-size: 1rem; padding: 0.75rem 1rem; outline: none; transition: all 0.25s ease; border-radius: 2px; width: 100%; }
        .lg-field input:focus { border-color: rgba(0,229,255,0.6); background: rgba(0,40,90,0.6); box-shadow: 0 0 16px rgba(0,229,255,0.12); }
        .lg-pass-wrap { position: relative; }
        .lg-pass-wrap input::-ms-reveal,
        .lg-pass-wrap input::-ms-clear,
        .lg-pass-wrap input::-webkit-credentials-auto-fill-button,
        .lg-pass-wrap input::-webkit-contacts-auto-fill-button { display: none !important; }
        .lg-eye { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: rgba(0,229,255,0.5); padding: 0.2rem; display: flex; align-items: center; }
        .lg-eye:hover { color: #00e5ff; }
        .lg-otp-row { display: flex; align-items: flex-end; gap: 0.8rem; margin-bottom: 1rem; }
        .lg-otp-row .lg-field { flex: 1; margin-bottom: 0; }
        .lg-send-btn { font-family: 'Orbitron', monospace; font-size: 0.52rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.75rem 1rem; border: 1px solid rgba(0,229,255,0.4); color: #00e5ff; background: rgba(0,229,255,0.05); cursor: pointer; transition: all 0.25s ease; border-radius: 2px; white-space: nowrap; flex-shrink: 0; }
        .lg-send-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .lg-sent-badge { font-size: 0.75rem; color: #00e5ff; opacity: 0.6; margin-top: 0.25rem; }
        .lg-msg-success { font-size: 0.82rem; color: #00e5ff; background: rgba(0,229,255,0.07); border: 1px solid rgba(0,229,255,0.2); padding: 0.6rem 0.9rem; margin-bottom: 0.8rem; border-radius: 2px; }
        .lg-msg-error { font-size: 0.82rem; color: #ff6b6b; background: rgba(255,107,107,0.07); border: 1px solid rgba(255,107,107,0.25); padding: 0.6rem 0.9rem; margin-bottom: 0.8rem; border-radius: 2px; }
        .lg-submit { width: 100%; padding: 0.95rem; font-family: 'Orbitron', monospace; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(0,229,255,0.5); color: #00e5ff; background: rgba(0,229,255,0.06); transition: all 0.3s ease; border-radius: 2px; margin-top: 0.4rem; }
        .lg-submit:hover { background: rgba(0,229,255,0.12); box-shadow: 0 0 28px rgba(0,229,255,0.35); transform: translateY(-1px); }
        .lg-footer { position: fixed; bottom: 0; left: 0; right: 0; z-index: 100; text-align: center; padding: 0.8rem; font-family: 'Orbitron', monospace; font-size: 0.48rem; letter-spacing: 0.18em; color: rgba(0,229,255,0.2); border-top: 1px solid rgba(0,229,255,0.06); background: rgba(2,11,26,0.7); backdrop-filter: blur(10px); }
        @keyframes lg-fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="lg-blob1" /><div className="lg-blob2" />
      <nav className="lg-nav"><Link to="/" className="lg-back">← Back to Home</Link></nav>

      <div className="lg-card">
        <span className="lg-c lg-c-tl" /><span className="lg-c lg-c-tr" />
        <span className="lg-c lg-c-bl" /><span className="lg-c lg-c-br" />
        <div className="lg-card-label">// SECURE ACCESS</div>
        <div className="lg-title">Sign In</div>

        <div className="lg-tabs">
          <button className={`lg-tab ${tab === 'voter' ? 'lg-tab-active' : 'lg-tab-inactive'}`} onClick={() => { setTab('voter'); setMsg(''); setError(''); }}>🗳️ Voter</button>
          <button className={`lg-tab ${tab === 'admin' ? 'lg-tab-active' : 'lg-tab-inactive'}`} onClick={() => { setTab('admin'); setMsg(''); setError(''); }}>🔐 Admin</button>
        </div>

        {tab === 'voter' && (
          <form onSubmit={handleVoterLogin} autoComplete="off">
            <div className="lg-field">
              <label>Phone Number</label>
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                <span style={{ padding: '0.75rem 0.9rem', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', borderRight: 'none', borderRadius: '2px 0 0 2px', color: '#00e5ff', fontSize: '1rem', userSelect: 'none' }}>+91</span>
                <input type="tel" inputMode="numeric" maxLength={10} value={phone}
                  onKeyDown={(e) => { if (/^[0-9]$/.test(e.key) && phone.length >= 10) e.preventDefault(); }}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  style={{ borderRadius: '0 2px 2px 0', flex: 1 }} required />
              </div>
            </div>
            <div className="lg-field">
              <label>Password</label>
              <div className="lg-pass-wrap">
                <input type="text" value={password}
                  autoComplete="off" data-form-type="other" data-lpignore="true"
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: '3rem', WebkitTextSecurity: showPass ? 'none' : 'disc', textSecurity: showPass ? 'none' : 'disc' }} required />
                <button type="button" className="lg-eye" onClick={() => setShowPass(p => !p)}>
                  {showPass
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
              {password && /[A-Z]/.test(password) && (
                <div className="lg-sent-badge" style={{ color: '#ff6b6b' }}>⚠ Password must be lowercase only</div>
              )}
            </div>
            <div className="lg-otp-row">
              <div className="lg-field">
                <label>One-Time Code</label>
                <input type="text" inputMode="numeric" maxLength={8} value={otp} autoComplete="one-time-code" onChange={(e) => setOtp(e.target.value)} required />
                {otpSent && secondsLeft > 0 && <div className="lg-sent-badge">✓ OTP sent — expires in {fmtTime(secondsLeft)}</div>}
                {otpSent && secondsLeft === 0 && <div className="lg-sent-badge" style={{ color: '#ff6b6b' }}>OTP expired — resend</div>}
              </div>
              <button type="button" className="lg-send-btn" onClick={requestOtp} disabled={sending || phone.trim().length !== 10 || !password.trim()}>
                {sending ? 'Sending…' : otpSent ? 'Resend' : 'Send OTP'}
              </button>
            </div>
            {msg   && <div className="lg-msg-success">{msg}</div>}
            {error && <div className="lg-msg-error">{error}</div>}
            <button type="submit" className="lg-submit">Sign In as Voter</button>
          </form>
        )}

        {tab === 'admin' && (
          <form onSubmit={handleAdminLogin} autoComplete="off">
            <div className="lg-field">
              <label>Admin Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="lg-field">
              <label>Password</label>
              <div className="lg-pass-wrap">
                <input type="text" value={password}
                  autoComplete="off" data-form-type="other" data-lpignore="true"
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: '3rem', WebkitTextSecurity: showPass ? 'none' : 'disc', textSecurity: showPass ? 'none' : 'disc' }} required />
                <button type="button" className="lg-eye" onClick={() => setShowPass(p => !p)}>
                  {showPass
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
            </div>
            {msg   && <div className="lg-msg-success">{msg}</div>}
            {error && <div className="lg-msg-error">{error}</div>}
            <button type="submit" className="lg-submit">Sign In as Admin</button>
          </form>
        )}
      </div>
      <footer className="lg-footer">DECENTRALIZED VOTING PROTOCOL — ALL TRANSACTIONS CRYPTOGRAPHICALLY SECURED</footer>
    </div>
  );
}

export default Login;