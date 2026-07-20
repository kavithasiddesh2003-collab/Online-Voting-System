import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

function generatePassword(name, dob) {
  const namePart = name.trim().toLowerCase().replace(/\s+/g, '').slice(0, 4);
  const dobPart  = dob ? dob.split('-')[2] : '';
  if (!namePart || !dobPart) return '';
  return namePart + dobPart;
}

// <input type="date"> always gives/needs ISO (YYYY-MM-DD) internally.
// The rest of the system (existing voter records, CSV sync) stores DOB as
// DD-MM-YYYY, so convert only when sending to the backend.
function isoToDMY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

/* Fast DOB picker: typeable year + month dropdown (no clicking through
   decades one month at a time like the native browser picker). Internal
   value stays ISO (YYYY-MM-DD) to match the rest of the form's logic. */
function DOBPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef(null);
  const popRef = useRef(null);
  const POPUP_W = 260;
  const nowY = new Date().getFullYear();

  const initial = value ? new Date(value) : new Date(nowY - 18, 0, 1);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [selectedDay, setSelectedDay] = useState(value ? initial.getDate() : null);

  useEffect(() => {
    if (!value) return;
    const d = new Date(value);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDay(d.getDate());
  }, [value]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target) && popRef.current && !popRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const reposition = useCallback(() => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const margin = 8;
    let left = Math.min(r.left, window.innerWidth - POPUP_W - margin);
    left = Math.max(left, margin);
    const popH = popRef.current ? popRef.current.offsetHeight : 360;
    let top = r.bottom + 6;
    if (top + popH > window.innerHeight - margin) top = Math.max(margin, r.top - popH - 6);
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    const onWin = () => reposition();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => { window.removeEventListener('resize', onWin); window.removeEventListener('scroll', onWin, true); };
  }, [open, reposition]);

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayNames = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const pad = (n) => String(n).padStart(2, '0');
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const firstWeekday = (y, m) => new Date(y, m, 1).getDay();

  const buildGrid = () => {
    const total = daysInMonth(viewYear, viewMonth);
    const startWeekday = firstWeekday(viewYear, viewMonth);
    const prevMonthIdx = viewMonth - 1 < 0 ? 11 : viewMonth - 1;
    const prevTotal = daysInMonth(viewYear, prevMonthIdx);
    const cells = [];
    for (let i = startWeekday - 1; i >= 0; i--) cells.push({ day: prevTotal - i, current: false });
    for (let d = 1; d <= total; d++) cells.push({ day: d, current: true });
    let next = 1;
    while (cells.length % 7 !== 0) cells.push({ day: next++, current: false });
    return cells;
  };

  const clampDay = (y, m, d) => Math.min(d, daysInMonth(y, m));

  const [yearDraft, setYearDraft] = useState(String(viewYear));
  useEffect(() => { setYearDraft(String(viewYear)); }, [viewYear]);

  const stepMonth = (dir) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    y = Math.max(1900, Math.min(nowY, y));
    setViewMonth(m);
    setViewYear(y);
    setSelectedDay(d => d ? clampDay(y, m, d) : d);
  };
  const stepYear = (dir) => {
    const y = Math.max(1900, Math.min(nowY, viewYear + dir));
    setViewYear(y);
    setSelectedDay(d => d ? clampDay(y, viewMonth, d) : d);
  };
  const confirm = () => {
    if (!selectedDay) { setOpen(false); return; }
    onChange(`${viewYear}-${pad(viewMonth + 1)}-${pad(selectedDay)}`);
    setOpen(false);
  };
  const cancel = () => setOpen(false);
  const clearVal = () => { onChange(''); setSelectedDay(null); setOpen(false); };

  const displayVal = value
    ? `${pad(new Date(value).getDate())}-${pad(new Date(value).getMonth() + 1)}-${new Date(value).getFullYear()}`
    : '';

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input className="rg-input" readOnly placeholder="dd-mm-yyyy" value={displayVal}
        onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer' }} />
      {open && ReactDOM.createPortal(
        <div ref={popRef} style={{ position: 'fixed', zIndex: 1200, top: pos.top, left: pos.left, background: '#03101f', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 6, padding: 12, width: POPUP_W, maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.6)', fontFamily: "'Rajdhani', sans-serif" }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <select
              value={viewMonth}
              onChange={e => { const m = Number(e.target.value); setViewMonth(m); setSelectedDay(d => d ? clampDay(viewYear, m, d) : d); }}
              onWheel={e => { e.preventDefault(); stepMonth(e.deltaY < 0 ? -1 : 1); }}
              style={{ flex: 1, background: 'rgba(0,30,70,0.6)', border: '1px solid rgba(0,229,255,0.25)', color: '#e0f4ff', borderRadius: 4, padding: '4px 6px', fontSize: 13 }}
            >
              {monthNames.map((mn, i) => <option key={mn} value={i}>{mn}</option>)}
            </select>
            <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 4, overflow: 'hidden' }}>
              <button type="button" onClick={() => stepMonth(-1)} style={{ background: 'rgba(0,229,255,0.08)', border: 'none', color: '#00e5ff', cursor: 'pointer', width: 18, height: 12, fontSize: 9, lineHeight: 1 }}>▲</button>
              <button type="button" onClick={() => stepMonth(1)} style={{ background: 'rgba(0,229,255,0.08)', border: 'none', color: '#00e5ff', cursor: 'pointer', width: 18, height: 12, fontSize: 9, lineHeight: 1 }}>▼</button>
            </div>
            <input
              type="text" inputMode="numeric" value={yearDraft} className="rg-year-input"
              onChange={e => {
                const v = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
                setYearDraft(v);
                if (v.length === 4) {
                  const y = Math.max(1900, Math.min(nowY, parseInt(v, 10)));
                  setViewYear(y);
                  setSelectedDay(d => d ? clampDay(y, viewMonth, d) : d);
                }
              }}
              onBlur={() => {
                const y = Math.max(1900, Math.min(nowY, parseInt(yearDraft, 10) || viewYear));
                setViewYear(y);
                setYearDraft(String(y));
                setSelectedDay(d => d ? clampDay(y, viewMonth, d) : d);
              }}
              onWheel={e => { e.preventDefault(); stepYear(e.deltaY < 0 ? 1 : -1); }}
              style={{ width: 64, background: 'rgba(0,30,70,0.6)', border: '1px solid rgba(0,229,255,0.25)', color: '#e0f4ff', borderRadius: 4, padding: '4px 6px', fontSize: 13 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 4, overflow: 'hidden' }}>
              <button type="button" onClick={() => stepYear(1)} style={{ background: 'rgba(0,229,255,0.08)', border: 'none', color: '#00e5ff', cursor: 'pointer', width: 18, height: 12, fontSize: 9, lineHeight: 1 }}>▲</button>
              <button type="button" onClick={() => stepYear(-1)} style={{ background: 'rgba(0,229,255,0.08)', border: 'none', color: '#00e5ff', cursor: 'pointer', width: 18, height: 12, fontSize: 9, lineHeight: 1 }}>▼</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
            {dayNames.map(d => <div key={d} style={{ textAlign: 'center', color: '#00e5ff', fontSize: 10, fontWeight: 700, padding: '3px 0' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 10 }}>
            {buildGrid().map((c, i) => {
              const isSelected = c.current && c.day === selectedDay;
              return (
                <button type="button" key={i} onClick={() => c.current && setSelectedDay(c.day)}
                  style={{ padding: '5px 0', borderRadius: 4, border: 'none', cursor: c.current ? 'pointer' : 'default',
                    background: isSelected ? '#00b8d4' : 'transparent',
                    color: !c.current ? 'rgba(0,229,255,0.15)' : isSelected ? '#00121f' : '#e0f4ff',
                    fontSize: 12, fontWeight: isSelected ? 700 : 500 }}>
                  {c.day}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" onClick={clearVal} style={{ background: 'none', border: 'none', color: '#00e5ff', cursor: 'pointer', fontSize: 12, padding: 0 }}>Clear</button>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={cancel} style={{ background: 'none', border: '1px solid rgba(0,229,255,0.3)', color: '#8bd8ea', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={confirm} style={{ background: '#00b8d4', color: '#00121f', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>OK</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function Register() {
  const [fullName, setFullName]   = useState('');
  const [phone, setPhone]         = useState('');
  const [voterId, setVoterId]     = useState('');
  const [dob, setDob]             = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [confirm, setConfirm]     = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [agree, setAgree]         = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [message, setMessage]     = useState('');
  const [error, setError]         = useState('');
  const [phoneTaken, setPhoneTaken] = useState(false);
  const navigate = useNavigate();

  const autoPassword  = generatePassword(fullName, dob);
  const passwordReady = autoPassword.length >= 2;

  useEffect(() => {
    if (phone.length !== 10) { setPhoneTaken(false); return; }
    const t = setTimeout(() => {
      api.get('/check-phone', { params: { phone: `+91${phone}` } })
        .then(r => setPhoneTaken(!!r.data.exists))
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [phone]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (!agree)                        { setError('Please accept the terms to continue.'); return; }
    if (!fullName.trim())              { setError('Enter your full name.'); return; }
    if (!phone || phone.length !== 10) { setError('Enter a valid 10-digit phone number.'); return; }
    if (phoneTaken)                    { setError('This phone number is already registered.'); return; }
    if (voterId.length !== 6) { setError('Voter ID is required: VOT followed by exactly 3 digits.'); return; }
    if (!dob)                          { setError('Date of birth is required.'); return; }
    const today = new Date();
    const birth = new Date(dob);
    const age = today.getFullYear() - birth.getFullYear() -
      (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
    if (age < 18)                      { setError('You must be at least 18 years old to register.'); return; }
    if (!passwordReady)                 { setError('Please enter your full name and date of birth first to set your password.'); return; }
    if (!password)                     { setError('Please enter your password.'); return; }
    if (/[A-Z]/.test(password))        { setError('Password must be lowercase only.'); return; }
    if (password !== autoPassword)     { setError('Password must follow the format: first 4 letters of your name + day of birth.'); return; }
    if (password !== confirm)          { setError('Passwords do not match.'); return; }
    try {
      const response = await api.post('/register', {
        name:     fullName.trim(),
        phone:    `+91${phone}`,
        voter_id: voterId,
        dob: isoToDMY(dob),
        password,
      });
      setMessage(response.data.message);
      setTimeout(() => navigate('/'), 3500);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration could not be completed.');
    }
  };

  return (
    <div className="rg-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .rg-root {
          min-height: 100vh; width: 100vw; background: #020b1a;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Rajdhani', sans-serif; position: relative; overflow-x: hidden; padding: 3.5rem 1rem 2.5rem;
        }
        .rg-root::before {
          content: ''; position: fixed; inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px);
          pointer-events: none; z-index: 0;
        }
        .rg-blob1 { position: fixed; width: 500px; height: 500px; border-radius: 50%; background: radial-gradient(circle, rgba(0,102,255,0.07) 0%, transparent 70%); top: -120px; left: -120px; pointer-events: none; z-index: 0; }
        .rg-blob2 { position: fixed; width: 400px; height: 400px; border-radius: 50%; background: radial-gradient(circle, rgba(0,229,255,0.05) 0%, transparent 70%); bottom: -100px; right: -100px; pointer-events: none; z-index: 0; }
        .rg-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: flex-end; padding: 1rem 2rem; background: rgba(2,11,26,0.7); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(0,229,255,0.10); }
        .rg-back { font-family: 'Orbitron', monospace; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.12em; padding: 0.45rem 1.2rem; border-radius: 3px; cursor: pointer; text-transform: uppercase; transition: all 0.25s ease; background: transparent; border: 1px solid rgba(0,229,255,0.4); color: #00e5ff; text-decoration: none; }
        .rg-back:hover { background: rgba(0,229,255,0.08); box-shadow: 0 0 16px rgba(0,229,255,0.3); }
        .rg-card { position: relative; z-index: 10; width: 100%; max-width: 500px; padding: 1.5rem 2.8rem; background: rgba(0,18,45,0.75); border: 1px solid rgba(0,229,255,0.18); backdrop-filter: blur(16px); animation: rg-fadeUp 0.8s ease backwards; }
        .rg-c { position: absolute; width: 18px; height: 18px; border-color: #00e5ff; border-style: solid; }
        .rg-c-tl { top:-1px; left:-1px; border-width:2px 0 0 2px; }
        .rg-c-tr { top:-1px; right:-1px; border-width:2px 2px 0 0; }
        .rg-c-bl { bottom:-1px; left:-1px; border-width:0 0 2px 2px; }
        .rg-c-br { bottom:-1px; right:-1px; border-width:0 2px 2px 0; }
        .rg-card-label { position: absolute; top: -0.65rem; left: 50%; transform: translateX(-50%); font-family: 'Orbitron', monospace; font-size: 0.48rem; letter-spacing: 0.28em; color: #00e5ff; background: #020b1a; padding: 0 0.8rem; white-space: nowrap; opacity: 0.75; }
        .rg-title { font-family: 'Orbitron', monospace; font-size: 1.4rem; font-weight: 900; color: #fff; letter-spacing: 0.06em; text-align: center; text-shadow: 0 0 20px rgba(0,229,255,0.3); margin-bottom: 0.8rem; }
        .rg-field { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.6rem; }
        .rg-field label { font-family: 'Orbitron', monospace; font-size: 0.52rem; letter-spacing: 0.2em; color: rgba(0,229,255,0.6); text-transform: uppercase; }
        .rg-input { background: rgba(0,30,70,0.6); border: 1px solid rgba(0,229,255,0.2); color: #e0f4ff; font-family: 'Rajdhani', sans-serif; font-size: 1rem; padding: 0.5rem 1rem; outline: none; transition: all 0.25s ease; border-radius: 2px; letter-spacing: 0.04em; width: 100%; }
        .rg-input::placeholder { color: rgba(180,220,255,0.25); }
        .rg-input:focus { border-color: rgba(0,229,255,0.6); background: rgba(0,40,90,0.6); box-shadow: 0 0 16px rgba(0,229,255,0.12); }
        .rg-input[type="date"] { color-scheme: dark; }
        .rg-year-input::-webkit-outer-spin-button,
        .rg-year-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .rg-year-input { -moz-appearance: textfield; appearance: textfield; }
        .rg-input[type="date"]::-webkit-calendar-picker-indicator { filter: brightness(0) invert(1) sepia(1) saturate(10) hue-rotate(175deg) brightness(2); opacity: 1; cursor: pointer; width: 20px; height: 20px; }
        .rg-input[type="date"]::-webkit-datetime-edit { color: #e0f4ff; }
        .rg-input[type="date"]::-webkit-datetime-edit-fields-wrapper { color: #e0f4ff; }
        .rg-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .rg-phone-row { display: flex; align-items: stretch; }
        .rg-prefix { padding: 0.5rem 0.9rem; background: rgba(0,229,255,0.08); border: 1px solid rgba(0,229,255,0.2); border-right: none; border-radius: 2px 0 0 2px; color: #00e5ff; font-family: 'Rajdhani', sans-serif; font-size: 1rem; user-select: none; white-space: nowrap; }
        .rg-pass-wrap { position: relative; }
        .rg-pass-wrap .rg-input { padding-right: 3rem; }
        .rg-pass-wrap .rg-input::-ms-reveal,
        .rg-pass-wrap .rg-input::-ms-clear,
        .rg-pass-wrap .rg-input::-webkit-credentials-auto-fill-button,
        .rg-pass-wrap .rg-input::-webkit-contacts-auto-fill-button { display: none !important; }
        .rg-eye { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: rgba(0,229,255,0.5); padding: 0.2rem; display: flex; align-items: center; transition: color 0.2s; }
        .rg-eye:hover { color: #00e5ff; }
        .rg-hint { font-size: 0.78rem; color: rgba(0,229,255,0.45); margin-top: 0.3rem; letter-spacing: 0.02em; font-family: 'Rajdhani', sans-serif; }
        .rg-hint strong { color: rgba(0,229,255,0.75); }
        .rg-checkbox { display: flex; align-items: center; gap: 0.6rem; margin: 0.5rem 0; cursor: pointer; }
        .rg-checkbox input { accent-color: #00e5ff; width: 15px; height: 15px; }
        .rg-checkbox span { font-size: 0.85rem; color: rgba(180,220,255,0.5); }
        .rg-checkbox a { color: #00e5ff; text-decoration: none; }
        .rg-msg-success { font-size: 0.82rem; color: #00e5ff; background: rgba(0,229,255,0.07); border: 1px solid rgba(0,229,255,0.2); padding: 0.6rem 0.9rem; margin-bottom: 0.8rem; letter-spacing: 0.03em; border-radius: 2px; }
        .rg-msg-error { font-size: 0.82rem; color: #ff6b6b; background: rgba(255,107,107,0.07); border: 1px solid rgba(255,107,107,0.25); padding: 0.6rem 0.9rem; margin-bottom: 0.8rem; letter-spacing: 0.03em; border-radius: 2px; }
        .rg-submit { width: 100%; padding: 0.95rem; font-family: 'Orbitron', monospace; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(0,229,255,0.5); color: #00e5ff; background: rgba(0,229,255,0.06); transition: all 0.3s ease; border-radius: 2px; margin-top: 0.4rem; }
        .rg-submit:hover { background: rgba(0,229,255,0.12); box-shadow: 0 0 28px rgba(0,229,255,0.35), inset 0 0 16px rgba(0,229,255,0.05); transform: translateY(-1px); }
        .rg-footer-bar { position: fixed; bottom: 0; left: 0; right: 0; z-index: 100; text-align: center; padding: 0.8rem; font-family: 'Orbitron', monospace; font-size: 0.48rem; letter-spacing: 0.18em; color: rgba(0,229,255,0.2); border-top: 1px solid rgba(0,229,255,0.06); background: rgba(2,11,26,0.7); backdrop-filter: blur(10px); }
        .rg-signin { text-align: center; color: rgba(180,220,255,0.4); font-size: 0.88rem; margin-top: 1.2rem; font-family: 'Rajdhani', sans-serif; }
        .rg-signin a { color: #00e5ff; font-weight: 600; text-decoration: none; }
        @keyframes rg-fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .rg-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(4px); }
        .rg-modal { position: relative; width: 100%; max-width: 600px; max-height: 80vh; background: rgba(0,12,32,0.98); border: 1px solid rgba(0,229,255,0.25); padding: 2rem 2rem 1.5rem; overflow-y: auto; animation: rg-fadeUp 0.3s ease both; }
        .rg-modal-title { font-family: 'Orbitron', monospace; font-size: 1rem; font-weight: 900; color: #00e5ff; letter-spacing: 0.1em; margin-bottom: 1.2rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(0,229,255,0.15); }
        .rg-modal h3 { font-family: 'Orbitron', monospace; font-size: 0.65rem; letter-spacing: 0.15em; color: rgba(0,229,255,0.7); margin: 1.2rem 0 0.5rem; text-transform: uppercase; }
        .rg-modal p { font-family: 'Rajdhani', sans-serif; font-size: 0.92rem; color: rgba(180,220,255,0.65); line-height: 1.7; margin-bottom: 0.5rem; }
        .rg-modal ul { padding-left: 1.2rem; margin-bottom: 0.5rem; }
        .rg-modal ul li { font-family: 'Rajdhani', sans-serif; font-size: 0.92rem; color: rgba(180,220,255,0.65); line-height: 1.7; }
        .rg-modal-close { width: 100%; margin-top: 1.5rem; padding: 0.8rem; font-family: 'Orbitron', monospace; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(0,229,255,0.4); color: #00e5ff; background: rgba(0,229,255,0.06); border-radius: 2px; transition: all 0.25s; }
        .rg-modal-close:hover { background: rgba(0,229,255,0.12); box-shadow: 0 0 20px rgba(0,229,255,0.25); }
      `}</style>

      <div className="rg-blob1" />
      <div className="rg-blob2" />
      <nav className="rg-nav">
        <Link to="/" className="rg-back">← Back to Home</Link>
      </nav>

      <div className="rg-card">
        <span className="rg-c rg-c-tl" /><span className="rg-c rg-c-tr" />
        <span className="rg-c rg-c-bl" /><span className="rg-c rg-c-br" />
        <div className="rg-card-label">{"// VOTER REGISTRATION"}</div>
        <div className="rg-title">Register</div>

        <form onSubmit={handleSubmit} autoComplete="off">
          <input type="text" name="username" style={{ display: 'none' }} readOnly />
          <input type="password" name="password" style={{ display: 'none' }} readOnly />
          {/* Full Name */}
          <div className="rg-field">
            <label>Full Name</label>
            <input className="rg-input" type="text" placeholder=""
              value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>

          {/* Phone */}
          <div className="rg-field">
            <label>Phone Number</label>
            <div className="rg-phone-row">
              <span className="rg-prefix">+91</span>
              <input className="rg-input" type="tel" inputMode="numeric"
                style={{ borderRadius: '0 2px 2px 0', borderLeft: 'none', flex: 1 }}
                maxLength={10} placeholder=""
                onKeyDown={e => { if (/^[0-9]$/.test(e.key) && phone.length >= 10) e.preventDefault(); }}
                value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} required />
            </div>
            {phoneTaken && (
              <div className="rg-hint" style={{ color: 'rgba(255,107,107,0.8)' }}>
                ⚠ This phone number is already registered
              </div>
            )}
          </div>

          {/* Voter ID + DOB */}
          <div className="rg-row2" style={{ marginBottom: '1rem' }}>
            <div className="rg-field" style={{ marginBottom: 0 }}>
              <label>Voter ID <span style={{ color: '#ff6b6b' }}>*</span></label>
              <div className="rg-phone-row">
                <span className="rg-prefix">VOT</span>
                <input className="rg-input" type="text" inputMode="numeric"
                  style={{ borderRadius: '0 2px 2px 0', borderLeft: 'none', flex: 1 }}
                  maxLength={3} placeholder="001"
                  autoComplete="off"
                  value={voterId.replace(/^VOT/, '')}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
                    setVoterId(digits ? 'VOT' + digits : '');
                  }} />
              </div>
              {voterId && voterId.length !== 6 && (
                <div className="rg-hint" style={{ color: 'rgba(255,107,107,0.8)' }}>
                  ⚠ Enter exactly 3 digits after VOT
                </div>
              )}
            </div>
            <div className="rg-field" style={{ marginBottom: 0 }}>
              <label>Date of Birth <span style={{ color: '#ff6b6b' }}>*</span></label>
              <DOBPicker value={dob} onChange={setDob} />
            </div>
          </div>

          {/* Password */}
          <div className="rg-field">
            <label>Password</label>
            <div className="rg-pass-wrap">
              <input className="rg-input" type="text"
                placeholder=""
                autoComplete="off" data-form-type="other" data-lpignore="true" name="new-secret" value={password} onChange={e => setPassword(e.target.value)}
                style={{ WebkitTextSecurity: showPass ? 'none' : 'disc', textSecurity: showPass ? 'none' : 'disc' }} required />
              <button type="button" className="rg-eye" onClick={() => setShowPass(p => !p)} aria-label="Toggle password">
                {showPass
                  ? <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            <div className="rg-hint">
              🔑 Password format: <strong>first 4 letters of your name</strong> + <strong>day of birth</strong>
            </div>
            {password && /[A-Z]/.test(password) && (
              <div className="rg-hint" style={{ color: 'rgba(255,107,107,0.8)', marginTop: '0.2rem' }}>
                ⚠ Password must be lowercase only
              </div>
            )}
            {password && !/[A-Z]/.test(password) && passwordReady && password !== autoPassword && (
              <div className="rg-hint" style={{ color: 'rgba(255,107,107,0.8)', marginTop: '0.2rem' }}>
                ✗ Password does not match the required format
              </div>
            )}
            {password && !/[A-Z]/.test(password) && passwordReady && password === autoPassword && (
              <div className="rg-hint" style={{ color: 'rgba(0,229,255,0.8)', marginTop: '0.2rem' }}>
                ✓ Password is correct
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="rg-field">
            <label>Confirm Password</label>
            <div className="rg-pass-wrap">
              <input className="rg-input" type="text"
                placeholder=""
                autoComplete="off" data-form-type="other" data-lpignore="true" name="confirm-secret" value={confirm} onChange={e => setConfirm(e.target.value)}
                style={{ WebkitTextSecurity: showConfirm ? 'none' : 'disc', textSecurity: showConfirm ? 'none' : 'disc' }} required />
              <button type="button" className="rg-eye" onClick={() => setShowConfirm(p => !p)} aria-label="Toggle confirm password">
                {showConfirm
                  ? <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          {/* Terms */}
          <label className="rg-checkbox">
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>I agree to the <button type="button" onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', color: '#00e5ff', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.85rem', padding: 0, textDecoration: 'underline' }}>Terms &amp; Privacy Policy</button></span>
          </label>

          {message && <div className="rg-msg-success">{message}</div>}
          {error   && <div className="rg-msg-error">{error}</div>}

          <button type="submit" className="rg-submit">Create Voter Account</button>
        </form>

        {/* Terms Modal */}
        {showTerms && (
          <div className="rg-modal-overlay" onClick={() => setShowTerms(false)}>
            <div className="rg-modal" onClick={e => e.stopPropagation()}>
              <span className="rg-c rg-c-tl" /><span className="rg-c rg-c-tr" />
              <span className="rg-c rg-c-bl" /><span className="rg-c rg-c-br" />
              <div className="rg-modal-title">{"// TERMS & PRIVACY POLICY"}</div>

              <h3>1. Acceptance of Terms</h3>
              <p>By registering and participating in the SecureVote Online Voting System, you agree to be bound by these Terms and Conditions. If you do not agree, you may not register or cast a vote.</p>

              <h3>2. Eligibility</h3>
              <p>You must be a verified eligible voter as determined by the system administrator. Registration does not guarantee the right to vote — your account must be approved by an admin before you can participate. You must be at least 18 years of age to register and cast a vote; registrations from individuals under 18 will not be accepted.</p>

              <h3>3. Account Responsibility</h3>
              <ul>
                <li>You are solely responsible for maintaining the confidentiality of your password and OTP.</li>
                <li>You must not share your login credentials with any other person.</li>
                <li>Any vote cast using your credentials is considered your own.</li>
                <li>Report any unauthorized access to the administrator immediately.</li>
              </ul>

              <h3>4. Voting Integrity</h3>
              <ul>
                <li>Each registered voter may cast only one vote per election.</li>
                <li>Votes are encrypted using Paillier homomorphic encryption and cannot be altered once submitted.</li>
                <li>Attempting to vote more than once, impersonate another voter, or tamper with the system is strictly prohibited and may result in legal consequences.</li>
              </ul>

              <h3>5. Data Collection & Privacy</h3>
              <p>We collect your name, phone number, Voter ID, and date of birth solely for the purpose of identity verification and election participation. Your data will not be sold or shared with third parties. Votes are stored in encrypted form and are not linked to your identity in the public record.</p>

              <h3>6. OTP & Authentication</h3>
              <p>A one-time password (OTP) will be sent to your registered phone number as part of the login process. This ensures two-factor authentication and protects the integrity of each vote cast.</p>

              <h3>7. System Availability</h3>
              <p>The platform is provided on a best-effort basis. We are not liable for any downtime, data loss, or technical failures beyond our reasonable control. Voting windows are strictly enforced by the system clock.</p>

              <h3>8. Prohibited Conduct</h3>
              <ul>
                <li>Attempting to reverse-engineer, hack, or disrupt the platform.</li>
                <li>Registering with false information or impersonating another individual.</li>
                <li>Coercing or incentivizing another voter to vote in a particular way.</li>
              </ul>

              <h3>9. Amendments</h3>
              <p>These terms may be updated at any time by the system administrator. Continued use of the system constitutes acceptance of the revised terms.</p>

              <h3>10. Contact</h3>
              <p>For any questions or concerns regarding these terms, please contact the election administrator through official channels.</p>

              <button className="rg-modal-close" onClick={() => setShowTerms(false)}>
                ✓ Close &amp; Return to Registration
              </button>
            </div>
          </div>
        )}

        <p className="rg-signin">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>

      <footer className="rg-footer-bar">
        DECENTRALIZED VOTING PROTOCOL — ALL TRANSACTIONS CRYPTOGRAPHICALLY SECURED
      </footer>
    </div>
  );
}

export default Register;