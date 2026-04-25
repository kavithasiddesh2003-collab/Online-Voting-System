import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

function Login({ onLogin }) {
  const [phone, setPhone]         = useState('');
  const [otp, setOtp]             = useState('');
  const [msg, setMsg]             = useState('');
  const [error, setError]         = useState('');
  const [sending, setSending]     = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    try {
      const res = await api.post('/auth', { phone: `+91${phone.trim()}`, otp: otp.trim() });
      const { token, user } = res.data;
      onLogin(user, token);
      setMsg('Signed in successfully.');
      navigate(user.role === 'admin' ? '/admin' : '/elections');
    } catch (err) {
      setError(err.response?.data?.error || 'Sign-in failed.');
    }
  };

  const requestOtp = async () => {
    setMsg(''); setError('');
    const ph = phone.trim();
    if (!ph || ph.length !== 10) { setError('Enter a valid 10-digit phone number.'); return; }
    setSending(true);
    try {
      await api.post('/request-otp', { phone: `+91${ph}` });
      setMsg('A one-time code was sent to your phone. If SMS is not configured, see the server console.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send code.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="lg-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lg-root {
          min-height: 100vh;
          width: 100vw;
          background: #020b1a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Rajdhani', sans-serif;
          position: relative;
          overflow: hidden;
        }

        .lg-root::before {
          content: '';
          position: fixed; inset: 0;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px
          );
          pointer-events: none;
          z-index: 0;
        }

        .lg-blob1 {
          position: fixed; width: 500px; height: 500px; border-radius: 50%;
          background: radial-gradient(circle, rgba(0,102,255,0.07) 0%, transparent 70%);
          top: -120px; left: -120px; pointer-events: none; z-index: 0;
        }
        .lg-blob2 {
          position: fixed; width: 400px; height: 400px; border-radius: 50%;
          background: radial-gradient(circle, rgba(0,229,255,0.05) 0%, transparent 70%);
          bottom: -100px; right: -100px; pointer-events: none; z-index: 0;
        }

        .lg-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 1rem 2rem;
          background: rgba(2,11,26,0.7);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(0,229,255,0.10);
        }

        .lg-back {
          font-family: 'Orbitron', monospace;
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          padding: 0.45rem 1.2rem;
          border-radius: 3px;
          cursor: pointer;
          text-transform: uppercase;
          transition: all 0.25s ease;
          background: transparent;
          border: 1px solid rgba(0,229,255,0.4);
          color: #00e5ff;
          text-decoration: none;
        }
        .lg-back:hover {
          background: rgba(0,229,255,0.08);
          box-shadow: 0 0 16px rgba(0,229,255,0.3);
        }

        .lg-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 460px;
          padding: 3rem 2.8rem;
          background: rgba(0,18,45,0.75);
          border: 1px solid rgba(0,229,255,0.18);
          backdrop-filter: blur(16px);
          animation: lg-fadeUp 0.8s ease both;
          margin-top: 3rem;
        }

        .lg-c {
          position: absolute; width: 18px; height: 18px;
          border-color: #00e5ff; border-style: solid;
        }
        .lg-c-tl { top:-1px;    left:-1px;  border-width:2px 0 0 2px; }
        .lg-c-tr { top:-1px;    right:-1px; border-width:2px 2px 0 0; }
        .lg-c-bl { bottom:-1px; left:-1px;  border-width:0 0 2px 2px; }
        .lg-c-br { bottom:-1px; right:-1px; border-width:0 2px 2px 0; }

        .lg-card-label {
          position: absolute;
          top: -0.65rem; left: 50%;
          transform: translateX(-50%);
          font-family: 'Orbitron', monospace;
          font-size: 0.48rem;
          letter-spacing: 0.28em;
          color: #00e5ff;
          background: #020b1a;
          padding: 0 0.8rem;
          white-space: nowrap;
          opacity: 0.75;
        }

        .lg-title {
          font-family: 'Orbitron', monospace;
          font-size: 1.5rem;
          font-weight: 900;
          color: #fff;
          letter-spacing: 0.06em;
          text-align: center;
          text-shadow: 0 0 20px rgba(0,229,255,0.3);
          margin-bottom: 0.4rem;
        }

        .lg-subtitle {
          text-align: center;
          font-size: 0.9rem;
          color: rgba(180,220,255,0.5);
          letter-spacing: 0.04em;
          margin-bottom: 2rem;
        }
        .lg-subtitle a { color: #00e5ff; text-decoration: underline; }
        .lg-subtitle a:hover { opacity: 0.75; }

        .lg-field {
          display: flex; flex-direction: column; gap: 0.35rem;
          margin-bottom: 1rem;
        }

        .lg-field label {
          font-family: 'Orbitron', monospace;
          font-size: 0.52rem;
          letter-spacing: 0.2em;
          color: rgba(0,229,255,0.6);
          text-transform: uppercase;
        }

        .lg-field input {
          background: rgba(0,30,70,0.6);
          border: 1px solid rgba(0,229,255,0.2);
          color: #e0f4ff;
          font-family: 'Rajdhani', sans-serif;
          font-size: 1rem;
          padding: 0.75rem 1rem;
          outline: none;
          transition: all 0.25s ease;
          border-radius: 2px;
          letter-spacing: 0.04em;
          width: 100%;
        }
        .lg-field input::placeholder { color: rgba(180,220,255,0.25); }
        .lg-field input:focus {
          border-color: rgba(0,229,255,0.6);
          background: rgba(0,40,90,0.6);
          box-shadow: 0 0 16px rgba(0,229,255,0.12);
        }

        .lg-otp-row {
          display: flex;
          align-items: flex-end;
          gap: 0.8rem;
          margin-bottom: 1rem;
        }
        .lg-otp-row .lg-field { flex: 1; margin-bottom: 0; }

        .lg-send-btn {
          font-family: 'Orbitron', monospace;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 0.75rem 1rem;
          border: 1px solid rgba(0,229,255,0.4);
          color: #00e5ff;
          background: rgba(0,229,255,0.05);
          cursor: pointer;
          transition: all 0.25s ease;
          border-radius: 2px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .lg-send-btn:hover:not(:disabled) {
          background: rgba(0,229,255,0.1);
          box-shadow: 0 0 14px rgba(0,229,255,0.25);
        }
        .lg-send-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .lg-msg-success {
          font-size: 0.82rem;
          color: #00e5ff;
          background: rgba(0,229,255,0.07);
          border: 1px solid rgba(0,229,255,0.2);
          padding: 0.6rem 0.9rem;
          margin-bottom: 0.8rem;
          letter-spacing: 0.03em;
          border-radius: 2px;
        }
        .lg-msg-error {
          font-size: 0.82rem;
          color: #ff6b6b;
          background: rgba(255,107,107,0.07);
          border: 1px solid rgba(255,107,107,0.25);
          padding: 0.6rem 0.9rem;
          margin-bottom: 0.8rem;
          letter-spacing: 0.03em;
          border-radius: 2px;
        }

        .lg-submit {
          width: 100%;
          padding: 0.95rem;
          font-family: 'Orbitron', monospace;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          cursor: pointer;
          border: 1px solid rgba(0,229,255,0.5);
          color: #00e5ff;
          background: rgba(0,229,255,0.06);
          transition: all 0.3s ease;
          border-radius: 2px;
          margin-top: 0.4rem;
        }
        .lg-submit:hover {
          background: rgba(0,229,255,0.12);
          box-shadow: 0 0 28px rgba(0,229,255,0.35), inset 0 0 16px rgba(0,229,255,0.05);
          transform: translateY(-1px);
        }

        .lg-divider {
          display: flex; align-items: center; gap: 0.8rem;
          margin: 1.4rem 0 1rem;
        }
        .lg-divider-line {
          flex: 1; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,229,255,0.15), transparent);
        }
        .lg-divider-text {
          font-family: 'Orbitron', monospace;
          font-size: 0.5rem;
          letter-spacing: 0.2em;
          color: rgba(0,229,255,0.35);
          white-space: nowrap;
        }

        .lg-hint {
          font-size: 0.82rem;
          color: rgba(180,220,255,0.4);
          text-align: center;
          line-height: 1.6;
          letter-spacing: 0.03em;
        }

        .lg-footer {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 100;
          text-align: center;
          padding: 0.8rem;
          font-family: 'Orbitron', monospace;
          font-size: 0.48rem;
          letter-spacing: 0.18em;
          color: rgba(0,229,255,0.2);
          border-top: 1px solid rgba(0,229,255,0.06);
          background: rgba(2,11,26,0.7);
          backdrop-filter: blur(10px);
        }

        @keyframes lg-fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="lg-blob1" />
      <div className="lg-blob2" />

      <nav className="lg-nav">
        <Link to="/" className="lg-back">← Back to Home</Link>
      </nav>

      <div className="lg-card">
        <span className="lg-c lg-c-tl" />
        <span className="lg-c lg-c-tr" />
        <span className="lg-c lg-c-bl" />
        <span className="lg-c lg-c-br" />
        <div className="lg-card-label">// SECURE ACCESS</div>

        <div className="lg-title">Sign In</div>
        <div className="lg-subtitle">
          New here? <Link to="/register">Create a session</Link>
        </div>

        <form onSubmit={handleLogin}>
          {/* Phone number */}
          <div className="lg-field">
            <label htmlFor="login-phone">Phone Number</label>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              <span style={{
                padding: '0.75rem 0.9rem',
                background: 'rgba(0,229,255,0.08)',
                border: '1px solid rgba(0,229,255,0.2)',
                borderRight: 'none',
                borderRadius: '2px 0 0 2px',
                color: '#00e5ff',
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: '1rem',
                letterSpacing: '0.04em',
                userSelect: 'none',
                whiteSpace: 'nowrap',
              }}>+91</span>
              <input
                id="login-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder=""
                maxLength={10}
                value={phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setPhone(digits);
                }}
                style={{ borderRadius: '0 2px 2px 0', flex: 1 }}
                required
              />
            </div>
          </div>

          {/* OTP row */}
          <div className="lg-otp-row">
            <div className="lg-field">
              <label htmlFor="login-otp">One-Time Code</label>
              <input
                id="login-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                maxLength={8}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="lg-send-btn"
              onClick={requestOtp}
              disabled={sending}
            >
              {sending ? 'Sending…' : 'Send SMS'}
            </button>
          </div>

          {msg   && <div className="lg-msg-success">{msg}</div>}
          {error && <div className="lg-msg-error">{error}</div>}

          <button type="submit" className="lg-submit">Sign In</button>
        </form>

        <div className="lg-divider">
          <div className="lg-divider-line" />
          <div className="lg-divider-text">Secure Access</div>
          <div className="lg-divider-line" />
        </div>

        <p className="lg-hint">
          Authentication uses SMS one-time codes and JWT sessions. Enter your number in E.164 format (e.g. +919876543210).
        </p>
      </div>

      <footer className="lg-footer">
        © 2026 BALLOTHUB — DECENTRALIZED VOTING PROTOCOL — ALL TRANSACTIONS CRYPTOGRAPHICALLY SECURED
      </footer>
    </div>
  );
}

export default Login;