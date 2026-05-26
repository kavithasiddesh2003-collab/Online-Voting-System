import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';

/* ─── tiny helpers ─── */
const badge = (status) => {
  const map = { active: '#22c55e', tallied: '#f59e0b', scheduled: '#6366f1', closed: '#6b7280' };
  const c = map[status] || '#6b7280';
  return <span style={{ background: c + '22', color: c, border: `1px solid ${c}66`, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginLeft: 10 }}>{status?.toUpperCase()}</span>;
};

const Btn = ({ color, children, ...p }) => (
  <button {...p} style={{ padding: '6px 16px', background: color, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: p.disabled ? 0.55 : 1, ...p.style }}>{children}</button>
);

/* ─── candidate row for forms ─── */
function CandidateRow({ idx, name, photo, onChange, onRemove }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e2a45', border: '2px solid #2a3a5c', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {photo
          ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
          : <svg width="22" height="22" viewBox="0 0 24 24" fill="#4a5a7a"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input style={inp} placeholder={`Candidate ${idx + 1} name`} value={name} onChange={e => onChange(idx, 'name', e.target.value)} />
        <input style={inp} placeholder="Photo URL (optional)" value={photo} onChange={e => onChange(idx, 'photo', e.target.value)} />
      </div>
      {onRemove && <button onClick={() => onRemove(idx)} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>}
    </div>
  );
}

/* ─── create election (inline) ─── */
function CreateElectionForm({ onCreated, onError }) {
  const [name, setName]         = useState('');
  const [duration, setDuration] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]   = useState('');
  const [candidates, setCandidates] = useState([{ name: '', photo: '' }, { name: '', photo: '' }]);
  const [saving, setSaving]     = useState(false);

  const changeCandidate = (i, field, val) => setCandidates(c => c.map((x, j) => j === i ? { ...x, [field]: val } : x));
  const addCandidate    = () => setCandidates(c => [...c, { name: '', photo: '' }]);
  const removeCandidate = (i) => setCandidates(c => c.filter((_, j) => j !== i));

  const submit = async () => {
    const cList = candidates.filter(c => c.name.trim());
    if (!name.trim())     { onError('Enter an election name.'); return; }
    if (cList.length < 2) { onError('Add at least 2 candidates.'); return; }
    setSaving(true);
    try {
      await api.post('/admin/election', {
        name: name.trim(),
        candidates: cList.map(c => c.name.trim()),
        candidate_photos: cList.map(c => c.photo.trim()),
        duration_minutes: parseInt(duration) || 0,
        start_time: startTime || null,
        end_time: endTime || null,
      });
      onCreated('Election created!');
      setName(''); setDuration(''); setStartTime(''); setEndTime('');
      setCandidates([{ name: '', photo: '' }, { name: '', photo: '' }]);
    } catch (e) { onError(e.response?.data?.error || 'Failed to create.'); }
    finally { setSaving(false); }
  };

  return (
    <div style={card}>
      <h3 style={cardTitle}>Create New Election</h3>
      <input style={{ ...inp, marginBottom: 10 }} placeholder="Election name" value={name} onChange={e => setName(e.target.value)} />
      <input style={{ ...inp, marginBottom: 10 }} placeholder="Voting duration (minutes, 0=no limit)" type="number" value={duration} onChange={e => setDuration(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={sublabel}>Start Time (optional)</div>
          <input style={inp} type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} />
        </div>
        <div>
          <div style={sublabel}>End Time (optional)</div>
          <input style={inp} type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: '#e6eef8', fontWeight: 700 }}>Candidates</span>
        <button onClick={addCandidate} style={{ background: 'none', border: '1px solid #6366f1', color: '#6366f1', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+ Add Candidate</button>
      </div>
      {candidates.map((c, i) => <CandidateRow key={i} idx={i} name={c.name} photo={c.photo} onChange={changeCandidate} onRemove={candidates.length > 2 ? removeCandidate : null} />)}
      <button onClick={submit} disabled={saving} style={{ marginTop: 8, padding: '10px 28px', background: '#5b7cf6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>
        {saving ? 'Creating…' : 'Create Election'}
      </button>
    </div>
  );
}

/* ─── edit election modal ─── */
function EditModal({ election, onSave, onClose }) {
  const [duration, setDuration]   = useState('');
  const [candidates, setCandidates] = useState((election.candidates || []).map((n, i) => ({ name: n, photo: election.candidate_photos?.[i] || '' })));
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const changeCandidate = (i, field, val) => setCandidates(c => c.map((x, j) => j === i ? { ...x, [field]: val } : x));
  const addCandidate    = () => setCandidates(c => [...c, { name: '', photo: '' }]);

  const submit = async () => {
    const cList = candidates.filter(c => c.name.trim());
    if (cList.length < 2) { setErr('At least 2 candidates required.'); return; }
    setSaving(true); setErr('');
    try {
      await api.put(`/admin/election/${election.id}`, {
        candidates: cList.map(c => c.name.trim()),
        candidate_photos: cList.map(c => c.photo.trim()),
        duration_minutes: parseInt(duration) || undefined,
      });
      onSave('Election updated!');
    } catch (e) { setErr(e.response?.data?.error || 'Update failed.'); setSaving(false); }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...modalBox, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ color: '#e6eef8', margin: 0, fontSize: 18 }}>✏️ Edit Election</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8899aa', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ background: '#1e2a45', borderRadius: 8, padding: '12px 14px', marginBottom: 12, color: '#e6eef8', fontWeight: 600 }}>{election.name}</div>
        <input style={{ ...inp, marginBottom: 14 }} type="number" placeholder="New duration (minutes, 0=no limit)" value={duration} onChange={e => setDuration(e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ color: '#e6eef8', fontWeight: 700 }}>Candidates</span>
          <button onClick={addCandidate} style={{ background: 'none', border: '1px solid #6366f1', color: '#6366f1', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+ Add</button>
        </div>
        {candidates.map((c, i) => <CandidateRow key={i} idx={i} name={c.name} photo={c.photo} onChange={changeCandidate} onRemove={candidates.length > 2 ? (i) => setCandidates(c => c.filter((_, j) => j !== i)) : null} />)}
        {err && <div style={{ color: '#ff6b6b', fontSize: 13, margin: '8px 0' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={submit} disabled={saving} style={{ flex: 1, padding: '12px', background: '#5b7cf6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            💾 {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 24px', background: '#2a3a5c', color: '#e6eef8', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ─── live count bar ─── */
function LiveCount({ id }) {
  const [data, setData] = useState(null);
  const timerRef = useRef();

  const fetch = useCallback(async () => {
    try { const r = await api.get(`/admin/live-count/${id}`); setData(r.data); } catch {}
  }, [id]);

  useEffect(() => { fetch(); timerRef.current = setInterval(fetch, 5000); return () => clearInterval(timerRef.current); }, [fetch]);

  if (!data) return <div style={{ color: '#8899aa', fontSize: 13, padding: '8px 0' }}>Loading live count…</div>;
  const total = data.total_votes || 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: '#e6eef8', fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
        📊 Live Vote Count — <span style={{ color: '#5b7cf6' }}>{total} vote{total !== 1 ? 's' : ''} so far</span>
        <span style={{ color: '#8899aa', fontWeight: 400, fontSize: 12, marginLeft: 8 }}>(refreshes every 5s)</span>
      </div>
      {Object.entries(data.counts || {}).map(([name, votes]) => {
        const pct = total ? Math.round((votes / total) * 100) : 0;
        return (
          <div key={name} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a0b4d0', fontSize: 13, marginBottom: 4 }}>
              <span>{name}</span><span>{votes} vote{votes !== 1 ? 's' : ''} ({pct}%)</span>
            </div>
            <div style={{ height: 10, background: '#1e2a45', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#5b7cf6,#22c55e)', borderRadius: 5, transition: 'width 0.5s' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── voter status table ─── */
function VoterStatus({ id }) {
  const [data, setData] = useState(null);
  const timerRef = useRef();

  const fetch = useCallback(async () => {
    try { const r = await api.get(`/admin/voter-status/${id}`); setData(r.data); } catch {}
  }, [id]);

  useEffect(() => { fetch(); timerRef.current = setInterval(fetch, 10000); return () => clearInterval(timerRef.current); }, [fetch]);

  if (!data) return <div style={{ color: '#8899aa', fontSize: 13 }}>Loading voter status…</div>;
  const voted = data.voters?.filter(v => v.has_voted).length || 0;
  const total = data.voters?.length || 0;
  return (
    <div>
      <div style={{ color: '#e6eef8', fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
        👥 Voter Status — <span style={{ color: '#5b7cf6' }}>{voted} / {total} voted</span>
        <span style={{ color: '#8899aa', fontWeight: 400, fontSize: 12, marginLeft: 8 }}>(refreshes every 10s)</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>{['Name','Phone','Voter ID','Status'].map(h => <th key={h} style={{ color: '#5b7cf6', textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #2a3a5c', fontWeight: 700 }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {(data.voters || []).map((v, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #1e2a45' }}>
              <td style={{ padding: '7px 10px', color: '#e6eef8' }}>{v.name}</td>
              <td style={{ padding: '7px 10px', color: '#8899aa' }}>{v.phone}</td>
              <td style={{ padding: '7px 10px', color: '#8899aa' }}>{v.voter_id || '—'}</td>
              <td style={{ padding: '7px 10px' }}>
                <span style={{ color: v.has_voted ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>{v.has_voted ? '✓ Voted' : 'Pending'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── single election row ─── */
function ElectionRow({ e, onDeleted, onEdited, onError }) {
  const [showLive, setShowLive]     = useState(false);
  const [showVoters, setShowVoters] = useState(false);
  const [editOpen, setEditOpen]     = useState(false);
  const [tallying, setTallying]     = useState(false);

  const now   = new Date();
  const ended = e.end_time && now > new Date(e.end_time);

  const tally = async () => {
    setTallying(true);
    try {
      const r = await api.post(`/admin/tally-auto/${e.id}`);
      onEdited(`Tallied! ${Object.entries(r.data.results || {}).map(([k,v]) => `${k}: ${v}`).join(', ')}`);
    } catch (ex) { onError(ex.response?.data?.error || 'Tally failed.'); }
    finally { setTallying(false); }
  };

  const del = async () => {
    if (!window.confirm(`Delete "${e.name}"?`)) return;
    try { await api.delete(`/admin/election/${e.id}`); onDeleted(); }
    catch (ex) { onError(ex.response?.data?.error || 'Delete failed.'); }
  };

  return (
    <>
      {editOpen && <EditModal election={e} onSave={(msg) => { setEditOpen(false); onEdited(msg); }} onClose={() => setEditOpen(false)} />}

      <div style={{ background: '#111827', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
        {/* header row */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <span style={{ color: '#e6eef8', fontWeight: 700, fontSize: 15 }}>ID: {e.id} — {e.name}</span>
          {badge(e.status)}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Btn color={showLive ? '#374151' : '#1d4ed8'} onClick={() => setShowLive(v => !v)}>{showLive ? '▲ Hide' : '▼ Show'}</Btn>
            <Btn color={showVoters ? '#374151' : '#1d4ed8'} onClick={() => setShowVoters(v => !v)}>{showVoters ? '▲ Hide Voters' : '▼ Show Voters'}</Btn>
            <Btn color='#b45309' onClick={() => setEditOpen(true)}>✏️ Edit</Btn>
            {e.status === 'active' && <Btn color='#15803d' onClick={tally} disabled={tallying}>{tallying ? '…' : 'Tally'}</Btn>}
            <Btn color='#dc2626' onClick={del}>Delete</Btn>
          </div>
        </div>

        {/* candidate pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {(e.candidates || []).map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e2a45', borderRadius: 999, padding: '4px 12px 4px 4px' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2a3a5c', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {e.candidate_photos?.[i]
                  ? <img src={e.candidate_photos[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="#4a5a7a"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
              </div>
              <span style={{ color: '#c0d0e8', fontSize: 13, fontWeight: 600 }}>{c}</span>
            </div>
          ))}
        </div>

        {ended && e.status === 'active' && (
          <div style={{ color: '#22c55e', fontSize: 13, marginBottom: 8 }}>✅ Voting ended — ready to tally</div>
        )}

        {/* live count */}
        {showLive && (
          <div style={{ background: '#0f172a', borderRadius: 8, padding: '14px 16px', marginBottom: 8 }}>
            <LiveCount id={e.id} />
          </div>
        )}

        {/* voter status */}
        {showVoters && (
          <div style={{ background: '#0f172a', borderRadius: 8, padding: '14px 16px' }}>
            <VoterStatus id={e.id} />
          </div>
        )}
      </div>
    </>
  );
}

/* ─── main ─── */
export default function AdminPanel({ token, user, onLogout }) {
  const [elections, setElections] = useState([]);
  const [voters, setVoters]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [msg, setMsg]             = useState('');
  const [err, setErr]             = useState('');
  const [voterOpen, setVoterOpen] = useState(false);

  const flash = (type, text) => {
    if (type === 'ok') { setMsg(text); setErr(''); } else { setErr(text); setMsg(''); }
    setTimeout(() => { setMsg(''); setErr(''); }, 4000);
  };

  const loadElections = useCallback(async () => {
    try { const r = await api.get('/elections'); setElections(r.data); } catch {}
  }, []);
  const loadVoters = useCallback(async () => {
    try { const r = await api.get('/admin/pending-voters'); setVoters(r.data); } catch {}
  }, []);

  useEffect(() => { Promise.all([loadElections(), loadVoters()]).finally(() => setLoading(false)); }, [loadElections, loadVoters]);

  const approveVoter = async (id) => {
    try { await api.post(`/admin/approve-voter/${id}`); flash('ok', 'Voter approved!'); loadVoters(); }
    catch (e) { flash('err', e.response?.data?.error || 'Failed.'); }
  };
  const rejectVoter = async (id, name) => {
    if (!window.confirm(`Reject "${name}"?`)) return;
    try { await api.delete(`/admin/reject-voter/${id}`); flash('ok', 'Voter removed.'); loadVoters(); }
    catch (e) { flash('err', e.response?.data?.error || 'Failed.'); }
  };
  const reloadCSV = async () => {
    try { await api.post('/admin/reload-users'); flash('ok', 'Users reloaded from CSV.'); loadVoters(); }
    catch { flash('err', 'Reload failed.'); }
  };

  const pendingVoters  = voters.filter(v => !v.approved);
  const approvedVoters = voters.filter(v =>  v.approved);

  if (loading) return <div style={{ background: '#0d1117', minHeight: '100vh', color: '#8899aa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading…</div>;

  return (
    <div style={{ background: '#0d1117', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <h2 style={{ color: '#e6eef8', fontWeight: 800, fontSize: 22, marginBottom: 20 }}>Admin Panel</h2>

        {msg && <div style={{ background: '#14532d', border: '1px solid #22c55e55', color: '#86efac', padding: '10px 16px', borderRadius: 8, marginBottom: 16 }}>{msg}</div>}
        {err && <div style={{ background: '#450a0a', border: '1px solid #dc262655', color: '#fca5a5', padding: '10px 16px', borderRadius: 8, marginBottom: 16 }}>{err}</div>}

        {/* Create Election */}
        <CreateElectionForm onCreated={(m) => { flash('ok', m); loadElections(); }} onError={(e) => flash('err', e)} />

        {/* Manage Elections */}
        <div style={card}>
          <h3 style={cardTitle}>Manage Elections</h3>
          {elections.length === 0
            ? <p style={{ color: '#8899aa' }}>No elections yet. Create one above.</p>
            : elections.map(e => (
                <ElectionRow key={e.id} e={e}
                  onDeleted={() => { flash('ok', 'Election deleted.'); loadElections(); }}
                  onEdited={(m) => { flash('ok', m); loadElections(); }}
                  onError={(e) => flash('err', e)}
                />
              ))
          }
        </div>

        {/* Voter Management */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: voterOpen ? 16 : 0 }}>
            <h3 style={{ ...cardTitle, marginBottom: 0 }}>
              Voter Management
              {pendingVoters.length > 0 && <span style={{ background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, marginLeft: 10 }}>{pendingVoters.length} pending</span>}
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={reloadCSV} style={{ padding: '6px 14px', background: 'none', border: '1px solid #2a3a5c', color: '#8899aa', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>↻ Reload CSV</button>
              <button onClick={() => setVoterOpen(v => !v)} style={{ padding: '6px 14px', background: '#1e2a45', border: 'none', color: '#e6eef8', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {voterOpen ? '▲ Hide' : '▼ Show Voters'}
              </button>
            </div>
          </div>

          {voterOpen && (
            <>
              {pendingVoters.length > 0 && (
                <>
                  <div style={{ ...sublabel, marginBottom: 8 }}>⏳ Pending Approval</div>
                  {pendingVoters.map(v => (
                    <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', borderRadius: 8, padding: '10px 14px', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <strong style={{ color: '#e6eef8' }}>{v.name}</strong>
                        <span style={{ color: '#8899aa', fontSize: 13, marginLeft: 10 }}>{v.phone} · {v.voter_id || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn color='#15803d' onClick={() => approveVoter(v.id)}>✓ Approve</Btn>
                        <Btn color='#dc2626' onClick={() => rejectVoter(v.id, v.name)}>✗ Reject</Btn>
                      </div>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid #1e2a45', margin: '14px 0' }} />
                </>
              )}
              <div style={{ ...sublabel, marginBottom: 8 }}>✅ Approved Voters ({approvedVoters.length})</div>
              {approvedVoters.map(v => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', borderRadius: 8, padding: '10px 14px', marginBottom: 6 }}>
                  <div>
                    <strong style={{ color: '#e6eef8' }}>{v.name}</strong>
                    <span style={{ color: '#8899aa', fontSize: 13, marginLeft: 10 }}>{v.phone}</span>
                  </div>
                  <span style={{ background: '#14532d', color: '#86efac', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Approved</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── shared styles ─── */
const inp = { width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #1e2a45', borderRadius: 8, color: '#e6eef8', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const card = { background: '#161b2e', borderRadius: 12, padding: '20px', marginBottom: 20, border: '1px solid #1e2a45' };
const cardTitle = { color: '#e6eef8', fontSize: 16, fontWeight: 700, marginBottom: 16, marginTop: 0 };
const sublabel = { fontSize: 12, color: '#8899aa', fontWeight: 600, marginBottom: 4 };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const modalBox = { background: '#161b2e', borderRadius: 14, padding: 24, width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #1e2a45' };