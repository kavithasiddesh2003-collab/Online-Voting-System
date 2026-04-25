import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

function Register() {
  const [firstName, setFirstName]  = useState('');
  const [lastName, setLastName]    = useState('');
  const [phone, setPhone]          = useState('');
  const [agree, setAgree]          = useState(false);
  const [message, setMessage]      = useState('');
  const [error, setError]          = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!agree) { setError('Please accept the terms to continue.'); return; }
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!name) { setError('Enter your first and last name.'); return; }
    const ph = phone.trim();
    if (!ph || ph.length !== 10) { setError('Enter a valid 10-digit phone number.'); return; }
    const fullPhone = `+91${ph}`;
    try {
      const response = await api.post('/register', { name, phone: fullPhone });
      setMessage(
        `${response.data.message} You can sign in from the login page once you receive your code.`
      );
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Request could not be completed.');
    }
  };

  return (
    <div className="rg-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .rg-root {
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

        .rg-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px
          );
          pointer-events: none;
          z-index: 0;
        }

        .rg-blob1 {
          position: fixed; width: 500px; height: 500px; border-radius: 50%;
          background: radial-gradient(circle, rgba(0,102,255,0.07) 0%, transparent 70%);
          top: -120px; left: -120px; pointer-events: none; z-index: 0;
        }
        .rg-blob2 {
          position: fixed; width: 400px; height: 400px; border-radius: 50%;
          background: radial-gradient(circle, rgba(0,229,255,0.05) 0%, transparent 70%);
          bottom: -100px; right: -100px; pointer-events: none; z-index: 0;
        }

        .rg-nav {
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

        .rg-back {
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
        .rg-back:hover {
          background: rgba(0,229,255,0.08);
          box-shadow: 0 0 16px rgba(0,229,255,0.3);
        }

        .rg-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 500px;
          padding: 3rem 2.8rem;
          background: rgba(0, 18, 45, 0.75);
          border: 1px solid rgba(0,229,255,0.18);
          backdrop-filter: blur(16px);
          animation: rg-fadeUp 0.8s ease both;
          margin-top: 3rem;
        }

        .rg-c {
          position: absolute; width: 18px; height: 18px;
          border-color: #00e5ff; border-style: solid;
        }
        .rg-c-tl { top:-1px;    left:-1px;  border-width:2px 0 0 2px; }
        .rg-c-tr { top:-1px;    right:-1px; border-width:2px 2px 0 0; }
        .rg-c-bl { bottom:-1px; left:-1px;  border-width:0 0 2px 2px; }
        .rg-c-br { bottom:-1px; right:-1px; border-width:0 2px 2px 0; }

        .rg-card-label {
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

        .rg-title {
          font-family: 'Orbitron', monospace;
          font-size: 1.35rem;
          font-weight: 900;
          color: #fff;
          letter-spacing: 0.04em;
          text-align: center;
          text-shadow: 0 0 20px rgba(0,229,255,0.3);
          margin-bottom: 0.4rem;
        }

        .rg-subtitle {
          text-align: center;
          font-size: 0.9rem;
          color: rgba(180,220,255,0.5);
          letter-spacing: 0.04em;
          margin-bottom: 2rem;
        }
        .rg-subtitle a { color: #00e5ff; text-decoration: underline; }
        .rg-subtitle a:hover { opacity: 0.75; }

        .rg-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .rg-field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }

        .rg-field label {
          font-family: 'Orbitron', monospace;
          font-size: 0.52rem;
          letter-spacing: 0.2em;
          color: rgba(0,229,255,0.6);
          text-transform: uppercase;
        }

        .rg-field input {
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
        .rg-field input::placeholder { color: #ffffff; opacity: 1; }
        .rg-field input:focus {
          border-color: rgba(0,229,255,0.6);
          background: rgba(0,40,90,0.6);
          box-shadow: 0 0 16px rgba(0,229,255,0.12);
        }

        .rg-checkbox {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          margin: 0.4rem 0 1.2rem;
          cursor: pointer;
        }
        .rg-checkbox input[type="checkbox"] {
          width: 15px; height: 15px;
          accent-color: #00e5ff;
          cursor: pointer;
          flex-shrink: 0;
        }
        .rg-checkbox span {
          font-size: 0.88rem;
          color: rgba(180,220,255,0.55);
          letter-spacing: 0.03em;
        }
        .rg-checkbox a { color: #00e5ff; text-decoration: underline; }

        .rg-msg-success {
          font-size: 0.82rem;
          color: #00e5ff;
          background: rgba(0,229,255,0.07);
          border: 1px solid rgba(0,229,255,0.2);
          padding: 0.6rem 0.9rem;
          margin-bottom: 0.8rem;
          letter-spacing: 0.03em;
          border-radius: 2px;
        }
        .rg-msg-error {
          font-size: 0.82rem;
          color: #ff6b6b;
          background: rgba(255,107,107,0.07);
          border: 1px solid rgba(255,107,107,0.25);
          padding: 0.6rem 0.9rem;
          margin-bottom: 0.8rem;
          letter-spacing: 0.03em;
          border-radius: 2px;
        }

        .rg-submit {
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
        }
        .rg-submit:hover:not(:disabled) {
          background: rgba(0,229,255,0.12);
          box-shadow: 0 0 28px rgba(0,229,255,0.35), inset 0 0 16px rgba(0,229,255,0.05);
          transform: translateY(-1px);
        }
        .rg-submit:disabled { opacity: 0.45; cursor: not-allowed; }

        .rg-divider {
          display: flex; align-items: center; gap: 0.8rem;
          margin: 1.4rem 0 1rem;
        }
        .rg-divider-line {
          flex: 1; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,229,255,0.15), transparent);
        }
        .rg-divider-text {
          font-family: 'Orbitron', monospace;
          font-size: 0.5rem;
          letter-spacing: 0.2em;
          color: rgba(0,229,255,0.35);
          white-space: nowrap;
        }

        .rg-hint {
          font-size: 0.82rem;
          color: rgba(180,220,255,0.4);
          text-align: center;
          line-height: 1.6;
          letter-spacing: 0.03em;
          margin-bottom: 1.2rem;
        }

        .rg-sso-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
        .rg-sso-row button {
          padding: 0.65rem 0.5rem;
          background: rgba(0,30,60,0.5);
          border: 1px solid rgba(0,229,255,0.1);
          color: rgba(180,220,255,0.4);
          font-family: 'Orbitron', monospace;
          font-size: 0.5rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: not-allowed;
          text-align: center;
          border-radius: 2px;
        }

        .rg-footer {
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

        @keyframes rg-fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="rg-blob1" />
      <div className="rg-blob2" />

      <nav className="rg-nav">
        <Link to="/" className="rg-back">← Back to Home</Link>
      </nav>

      <div className="rg-card">
        <span className="rg-c rg-c-tl" />
        <span className="rg-c rg-c-tr" />
        <span className="rg-c rg-c-bl" />
        <span className="rg-c rg-c-br" />
        <div className="rg-card-label">// VOTER REGISTRATION</div>

        <div className="rg-title">Request Voter Access</div>
        <div className="rg-subtitle">
          Already verified? <Link to="/login">Sign in</Link>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="rg-row-2">
            <div className="rg-field">
              <label htmlFor="reg-first">First Name</label>
              <input id="reg-first" type="text" autoComplete="given-name" placeholder=""
                value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="rg-field">
              <label htmlFor="reg-last">Last Name</label>
              <input id="reg-last" type="text" autoComplete="family-name" placeholder=""
                value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          <div className="rg-field">
            <label htmlFor="reg-phone">Phone Number on Voter Roll</label>
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
                id="reg-phone"
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

          <label className="rg-checkbox">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I agree to the <a href="/#">Election integrity &amp; privacy terms</a></span>
          </label>

          {message && <div className="rg-msg-success">{message}</div>}
          {error   && <div className="rg-msg-error">{error}</div>}

          <button type="submit" className="rg-submit">
            Send Verification Code
          </button>
        </form>

        <div className="rg-divider">
          <div className="rg-divider-line" />
          <div className="rg-divider-text">Why phone?</div>
          <div className="rg-divider-line" />
        </div>

        <p className="rg-hint">
          Only pre-registered phone numbers can receive a code. Numbers must be in E.164 format (e.g. +919876543210). This matches the official voter list managed by your administrator.
        </p>

        <div className="rg-sso-row">
          <button type="button" disabled title="Planned integration">🔐 Org SSO (soon)</button>
          <button type="button" disabled title="Planned integration">🛡️ ID Check (soon)</button>
        </div>
      </div>

      <footer className="rg-footer"></footer>
    </div>
  );
}

export default Register;