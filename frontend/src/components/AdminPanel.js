import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#6CA2FF', '#3EB489', '#FFA726', '#FF6B6B', '#A78BFA', '#34D399'];

function LiveResults({ electionId, token }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 5000);
    return () => clearInterval(interval);
  }, [electionId]);
  const fetchLive = async () => {
    try {
      const res = await api.get(`/admin/live-count/${electionId}`, { headers: { Authorization: `Bearer ${token}` } });
      setData(res.data);
    } catch {}
  };
  if (!data) return <div style={{ color: '#8899AA', fontSize: '0.85rem', padding: '0.5rem' }}>Loading...</div>;
  const total = data.total_votes;
  const entries = Object.entries(data.counts).sort((a, b) => b[1] - a[1]);
  return (
    <div style={liveStyles.box}>
      <div style={liveStyles.header}>
        📊 Live Vote Count — <span style={{ color: '#8CFAC7' }}>{total} vote{total !== 1 ? 's' : ''} so far</span>
        <span style={{ fontSize: '0.72rem', color: '#8899AA', marginLeft: '0.5rem' }}>(refreshes every 5s)</span>
      </div>
      {entries.map(([name, count], idx) => {
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        const color = COLORS[idx % COLORS.length];
        return (
          <div key={name} style={liveStyles.row}>
            <div style={liveStyles.rowTop}>
              <span style={{ ...liveStyles.name, color }}>{name}</span>
              <span style={{ ...liveStyles.count, color }}>{count} vote{count !== 1 ? 's' : ''} ({pct}%)</span>
            </div>
            <div style={liveStyles.track}>
              <div style={{ ...liveStyles.fill, width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const liveStyles = {
  box: { marginTop: '0.8rem', background: '#0B1220', border: '1px solid #263250', borderRadius: '10px', padding: '1rem' },
  header: { fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.8rem', color: '#E6EEF8' },
  row: { marginBottom: '0.7rem' },
  rowTop: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' },
  name: { fontSize: '0.88rem', fontWeight: 600 },
  count: { fontSize: '0.82rem', fontWeight: 700 },
  track: { background: '#162033', height: '14px', borderRadius: '7px', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: '7px', transition: 'width 0.5s ease' }
};

function VoterStatus({ electionId, token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [electionId]);
  const fetchStatus = async () => {
    try {
      const res = await api.get(`/admin/voter-status/${electionId}`, { headers: { Authorization: `Bearer ${token}` } });
      setData(res.data);
    } catch {}
    finally { setLoading(false); }
  };
  if (loading) return <div style={{ color: '#8899AA', padding: '0.5rem' }}>Loading voter list...</div>;
  if (!data) return null;
  return (
    <div style={vsStyles.box}>
      <div style={vsStyles.header}>
        👥 Voter Status — <span style={{ color: '#8CFAC7' }}>{data.total_voted}</span>
        <span style={{ color: '#8899AA' }}> / {data.total_voters} voted</span>
        <span style={{ fontSize: '0.72rem', color: '#8899AA', marginLeft: '0.5rem' }}>(refreshes every 10s)</span>
      </div>
      <div style={vsStyles.tableWrap}>
        <table style={vsStyles.table}>
          <thead>
            <tr>
              <th style={vsStyles.th}>Name</th>
              <th style={vsStyles.th}>Phone</th>
              <th style={vsStyles.th}>Voter ID</th>
              <th style={vsStyles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.voters.map(v => (
              <tr key={v.id} style={{ borderBottom: '1px solid #1E2B44' }}>
                <td style={vsStyles.td}>{v.name}</td>
                <td style={vsStyles.td}>{v.phone || '—'}</td>
                <td style={vsStyles.td}>{v.voter_id || '—'}</td>
                <td style={vsStyles.td}>
                  {v.voted ? <span style={vsStyles.voted}>✅ Voted</span> : <span style={vsStyles.notVoted}>⏳ Not yet</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const vsStyles = {
  box: { marginTop: '0.8rem', background: '#0B1220', border: '1px solid #263250', borderRadius: '10px', padding: '1rem' },
  header: { fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.8rem', color: '#E6EEF8' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: { textAlign: 'left', padding: '0.5rem 0.8rem', color: '#6CA2FF', fontWeight: 700, borderBottom: '1px solid #263250', whiteSpace: 'nowrap' },
  td: { padding: '0.5rem 0.8rem', color: '#E6EEF8' },
  voted: { background: '#1B3A2F', color: '#8CFAC7', border: '1px solid #2E6B50', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700 },
  notVoted: { background: '#2A2000', color: '#FFA726', border: '1px solid #7A5200', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700 }
};

function CreateElectionModal({ token, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rows, setRows] = useState([{ name: '', photo: '' }, { name: '', photo: '' }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const addRow = () => rows.length < 20 && setRows([...rows, { name: '', photo: '' }]);
  const removeRow = (idx) => rows.length > 2 && setRows(rows.filter((_, i) => i !== idx));
  const updateRow = (idx, field, value) => {
    const updated = [...rows];
    updated[idx][field] = value;
    setRows(updated);
  };

  const handleCreate = async () => {
    const validRows = rows.filter(r => r.name.trim());
    if (!title.trim()) { setError('Enter election title.'); return; }
    if (validRows.length < 2) { setError('Add at least 2 candidates.'); return; }
    if (endDate && startDate && new Date(endDate) <= new Date(startDate)) {
      setError('End date must be after start date.'); return;
    }
    setSaving(true); setError('');
    try {
      await api.post('/admin/election', {
        name: title.trim(),
        description: description.trim(),
        candidates: validRows.map(r => r.name.trim()),
        candidate_photos: validRows.map(r => r.photo.trim()),
        end_time: endDate ? new Date(endDate).toISOString() : null,
        start_time: startDate ? new Date(startDate).toISOString() : null
      }, { headers: { Authorization: `Bearer ${token}` } });
      onCreated();
      onClose();
    } catch (err) {
      console.error('Create election error:', err);
      console.error('Response:', err.response);
      console.error('Response data:', err.response?.data);
      console.error('Token used:', token ? token.substring(0, 20) + '...' : 'NULL TOKEN!');
      const msg = err.response?.data?.error
        || (err.response ? `Server error ${err.response.status}: ${JSON.stringify(err.response.data)}` : `Network error: ${err.message}`);
      setError(msg);
    } finally { setSaving(false); }
  };

  return (
    <div style={cm.overlay}>
      <div style={cm.box}>
        <div style={cm.titleRow}>
          <span style={cm.titleIcon}>+</span>
          <h3 style={cm.title}>Create New Election</h3>
        </div>

        <label style={cm.label}>ELECTION TITLE</label>
        <input style={cm.input} type="text" placeholder=""
          value={title} onChange={e => setTitle(e.target.value)} />

        <div style={cm.dateRow}>
          <div style={{ flex: 1 }}>
            <label style={cm.label}>START DATE</label>
            <input style={cm.input} type="datetime-local"
              value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={cm.label}>END DATE</label>
            <input style={cm.input} type="datetime-local"
              value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <label style={cm.label}>CANDIDATES</label>
        {rows.map((row, idx) => (
          <div key={idx} style={cm.candidateRow}>
            <div style={cm.photoBox}>
              {row.photo
                ? <img src={row.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
                : <span style={{ fontSize: '1.4rem', color: '#8899AA' }}>👤</span>}
            </div>
            <input style={{ ...cm.input, flex: 1, marginBottom: 0 }} type="text" placeholder="Name"
              value={row.name} onChange={e => updateRow(idx, 'name', e.target.value)} />
            <input style={{ ...cm.input, flex: 1, marginBottom: 0, fontSize: '0.85rem', color: '#8899AA' }}
              type="text" placeholder="Photo URL (optional)"
              value={row.photo} onChange={e => updateRow(idx, 'photo', e.target.value)} />
            {rows.length > 2 && (
              <button onClick={() => removeRow(idx)} style={cm.removeBtn}>✕</button>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={addRow} disabled={rows.length >= 20} style={{ ...cm.addCandidateBtn, opacity: rows.length >= 20 ? 0.4 : 1, cursor: rows.length >= 20 ? 'not-allowed' : 'pointer' }}>+ Add Candidate</button>
          <span style={{ fontSize: '0.78rem', color: rows.length >= 20 ? '#FF6B6B' : '#8899AA' }}>
            {rows.length}/20 {rows.length >= 20 ? '— Maximum reached' : ''}
          </span>
        </div>

        {error && <div style={{ color: '#FF6B6B', fontSize: '0.85rem', margin: '0.5rem 0' }}>{error}</div>}

        <div style={cm.btnRow}>
          <button onClick={onClose} style={cm.cancelBtn}>Cancel</button>
          <button onClick={handleCreate} disabled={saving} style={cm.createBtn}>
            {saving ? 'Creating...' : 'Create Election'}
          </button>
        </div>
      </div>
    </div>
  );
}

const cm = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  box: { background: '#13111e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' },
  titleRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' },
  titleIcon: { fontSize: '1.4rem', color: '#7B61FF', fontWeight: 900 },
  title: { margin: 0, color: '#7B61FF', fontSize: '1.2rem', fontWeight: 700 },
  label: { display: 'block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: '#8899AA', marginBottom: '0.4rem', marginTop: '0.8rem' },
  input: { width: '100%', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: '#1a1828', color: '#E6EEF8', fontSize: '0.95rem', boxSizing: 'border-box', outline: 'none', marginBottom: '0.5rem' },
  textarea: { width: '100%', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: '#1a1828', color: '#E6EEF8', fontSize: '0.95rem', boxSizing: 'border-box', outline: 'none', resize: 'vertical', fontFamily: 'inherit', marginBottom: '0.5rem' },
  dateRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  candidateRow: { display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' },
  photoBox: { width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1828' },
  removeBtn: { background: 'none', border: 'none', color: '#FF6B6B', cursor: 'pointer', fontSize: '1rem', padding: '0.3rem' },
  addCandidateBtn: { background: 'none', border: 'none', color: '#7B61FF', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, padding: '0.3rem 0', marginTop: '0.3rem' },
  btnRow: { display: 'flex', gap: '1rem', marginTop: '1.5rem' },
  cancelBtn: { flex: 1, padding: '0.9rem', background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#8899AA', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' },
  createBtn: { flex: 1, padding: '0.9rem', background: 'linear-gradient(135deg, #7B61FF, #6848ff)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', boxShadow: '0 4px 16px rgba(123,97,255,0.4)' }
};

// Convert UTC ISO string to datetime-local input value (in IST)
function toDatetimeLocal(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  // shift to IST (+5:30)
  const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().slice(0, 16);
}

function EditModal({ election, token, onClose, onSaved }) {
  const [name, setName] = useState(election.name);
  const [startDate, setStartDate] = useState(toDatetimeLocal(election.start_time));
  const [endDate, setEndDate] = useState(toDatetimeLocal(election.end_time));
  const [rows, setRows] = useState(
    election.candidates.map((c, i) => ({
      name: c,
      photo: (election.candidate_photos && election.candidate_photos[i]) || ''
    }))
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const updateRow = (idx, field, value) => {
    const updated = [...rows];
    updated[idx][field] = value;
    setRows(updated);
  };
  const addRow = () => rows.length < 20 && setRows([...rows, { name: '', photo: '' }]);
  const removeRow = (idx) => rows.length > 2 && setRows(rows.filter((_, i) => i !== idx));

  const save = async () => {
    const validRows = rows.filter(r => r.name.trim());
    if (!name.trim() || validRows.length < 2) { setError('Need election name and at least 2 candidates.'); return; }
    if (endDate && startDate && new Date(endDate) <= new Date(startDate)) { setError('End date must be after start date.'); return; }
    setSaving(true); setError('');
    try {
      await api.put(`/admin/election/${election.id}`, {
        name: name.trim(),
        candidates: validRows.map(r => r.name.trim()),
        candidate_photos: validRows.map(r => r.photo.trim()),
        start_time: startDate ? new Date(startDate).toISOString() : null,
        end_time: endDate ? new Date(endDate).toISOString() : null,
      }, { headers: { Authorization: `Bearer ${token}` } });
      onSaved(); onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div style={modal.overlay}>
      <div style={modal.box}>
        <div style={modal.header}>
          <h3 style={{ margin: 0, color: '#E6EEF8' }}>✏️ Edit Election</h3>
          <button onClick={onClose} style={modal.closeBtn}>✕</button>
        </div>
        <input style={modal.input} type="text" placeholder="Election name" value={name} onChange={e => setName(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: '#8899AA', marginBottom: '0.4rem' }}>START DATE</label>
            <input style={{ ...modal.input, marginBottom: 0 }} type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: '#8899AA', marginBottom: '0.4rem' }}>END DATE</label>
            <input style={{ ...modal.input, marginBottom: 0 }} type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: '#E6EEF8', fontWeight: 700 }}>Candidates</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <button onClick={addRow} disabled={rows.length >= 20} style={{ ...modal.addBtn, opacity: rows.length >= 20 ? 0.4 : 1, cursor: rows.length >= 20 ? 'not-allowed' : 'pointer' }}>+ Add</button>
                <span style={{ fontSize: '0.75rem', color: rows.length >= 20 ? '#FF6B6B' : '#8899AA' }}>{rows.length}/20{rows.length >= 20 ? ' — Max' : ''}</span>
              </div>
          </div>
          {rows.map((row, idx) => (
            <div key={idx} style={modal.candidateRow}>
              <div style={modal.photoPreview}>
                {row.photo
                  ? <img src={row.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
                  : <span style={{ fontSize: '1.2rem' }}>👤</span>}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <input style={modal.smallInput} type="text" placeholder="Candidate name" value={row.name} onChange={e => updateRow(idx, 'name', e.target.value)} />
                <input style={{ ...modal.smallInput, color: '#8899AA' }} type="text" placeholder="Photo URL (optional)" value={row.photo} onChange={e => updateRow(idx, 'photo', e.target.value)} />
              </div>
              {rows.length > 2 && <button onClick={() => removeRow(idx)} style={modal.removeBtn}>✕</button>}
            </div>
          ))}
        </div>
        {error && <div style={{ color: '#FF6B6B', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <button onClick={save} disabled={saving} style={modal.saveBtn}>{saving ? 'Saving...' : '💾 Save Changes'}</button>
          <button onClick={onClose} style={modal.cancelBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const modal = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  box: { background: '#0F1725', border: '1px solid #263250', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  closeBtn: { background: 'none', border: 'none', color: '#8899AA', fontSize: '1.2rem', cursor: 'pointer' },
  input: { width: '100%', padding: '0.8rem', marginBottom: '0.8rem', borderRadius: '10px', border: '1px solid #2C3958', background: '#162033', color: '#E6EEF8', boxSizing: 'border-box' },
  candidateRow: { display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', background: '#162033', border: '1px solid #2C3958', borderRadius: '10px', padding: '0.5rem' },
  photoPreview: { width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid #2C3958', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F1725' },
  smallInput: { width: '100%', padding: '0.5rem 0.7rem', borderRadius: '8px', border: '1px solid #2C3958', background: '#0F1725', color: '#E6EEF8', boxSizing: 'border-box', fontSize: '0.9rem' },
  addBtn: { padding: '0.3rem 0.7rem', background: '#1B2537', color: '#6CA2FF', border: '1px solid #6CA2FF44', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' },
  removeBtn: { background: 'none', border: 'none', color: '#FF6B6B', cursor: 'pointer' },
  saveBtn: { flex: 1, padding: '0.85rem', background: '#6CA2FF', color: '#0B101A', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 },
  cancelBtn: { padding: '0.85rem 1.2rem', background: '#1B2537', color: '#E6EEF8', border: '1px solid #2C3958', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }
};

function AdminPanel({ token }) {
  const [elections, setElections] = useState([]);
  const [pendingVoters, setPendingVoters] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [voterStatusId, setVoterStatusId] = useState(null);
  const [editingElection, setEditingElection] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showVoters, setShowVoters] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchElections();
    fetchPendingVoters();
    const interval = setInterval(() => { fetchElections(); fetchPendingVoters(); }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchElections = async () => {
    try {
      const res = await api.get('/elections', { headers: { Authorization: `Bearer ${token}` } });
      setElections(res.data);
    } catch {}
  };

  const fetchPendingVoters = async () => {
    try {
      const res = await api.get('/admin/pending-voters', { headers: { Authorization: `Bearer ${token}` } });
      setPendingVoters(res.data);
    } catch {}
  };

  const approveVoter = async (id) => {
    try {
      await api.post(`/admin/approve-voter/${id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setMessage('Voter approved successfully!');
      fetchPendingVoters();
    } catch (err) { setError(err.response?.data?.error || 'Failed to approve'); }
  };

  const rejectVoter = async (id, name) => {
    if (!window.confirm(`Reject and remove ${name}?`)) return;
    try {
      await api.delete(`/admin/reject-voter/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setMessage('Voter rejected and removed.');
      fetchPendingVoters();
    } catch (err) { setError(err.response?.data?.error || 'Failed to reject'); }
  };

  const deleteElection = async (electionId) => {
    if (!window.confirm(`Delete election ${electionId}? This cannot be undone.`)) return;
    setError(''); setMessage('');
    try {
      await api.delete(`/admin/election/${electionId}`, { headers: { Authorization: `Bearer ${token}` } });
      setMessage(`Election ${electionId} deleted`);
      fetchElections();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete election');
    }
  };

  const autoTally = async (electionId) => {
    setError(''); setMessage('');
    try {
      await api.post(`/admin/tally-auto/${electionId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setMessage(`Election ${electionId} tallied! Click "View Results".`);
      fetchElections();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to tally');
    }
  };

  const isVotingEnded = (e) => !e.end_time || new Date() > new Date(e.end_time);
  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);
  const toggleVoterStatus = (id) => setVoterStatusId(voterStatusId === id ? null : id);

  return (
    <div style={styles.container}>
      <style>{`
        input[type="datetime-local"]::-webkit-calendar-picker-indicator {
          filter: brightness(0) invert(1) sepia(1) saturate(10) hue-rotate(175deg) brightness(2);
          opacity: 1; cursor: pointer; width: 18px; height: 18px;
        }
      `}</style>
      {showCreate && (
        <CreateElectionModal
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={() => { fetchElections(); setMessage('Election created successfully!'); }}
        />
      )}
      {editingElection && (
        <EditModal
          election={editingElection}
          token={token}
          onClose={() => setEditingElection(null)}
          onSaved={() => { fetchElections(); setMessage('Election updated successfully!'); }}
        />
      )}

      <div style={styles.topBar}>
        <h2 style={{ margin: 0 }}>Admin Panel</h2>
        <button onClick={() => setShowCreate(true)} style={styles.createBtn}>+ Create Election</button>
      </div>

      {/* Voter Approval Section */}
      <div style={{ ...styles.section, marginBottom: '1.5rem' }}>
        <div
          onClick={() => setShowVoters(v => !v)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
        >
          <h3 style={{ margin: 0 }}>
            👥 Voter Registrations
            {pendingVoters.filter(v => !v.approved).length > 0 && (
              <span style={{ marginLeft: '0.6rem', background: '#FF6B6B', color: '#fff', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem' }}>
                {pendingVoters.filter(v => !v.approved).length} pending
              </span>
            )}
          </h3>
          <span style={{ color: '#6CA2FF', fontSize: '0.85rem', fontWeight: 600 }}>
            {showVoters ? '▲ Hide' : '▼ Show'}
          </span>
        </div>
        {showVoters && (pendingVoters.length === 0 ? (
          <div style={{ ...styles.emptyState, marginTop: '1rem' }}><p style={{ color: '#8899AA', margin: 0 }}>No registered voters yet.</p></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {['Name', 'Phone', 'Voter ID', 'DOB', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.8rem', color: '#6CA2FF', fontWeight: 700, borderBottom: '1px solid #263250', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingVoters.map(v => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #1E2B44' }}>
                    <td style={{ padding: '0.5rem 0.8rem', color: '#E6EEF8' }}>{v.name}</td>
                    <td style={{ padding: '0.5rem 0.8rem', color: '#E6EEF8' }}>{v.phone || '—'}</td>
                    <td style={{ padding: '0.5rem 0.8rem', color: '#E6EEF8' }}>{v.voter_id || '—'}</td>
                    <td style={{ padding: '0.5rem 0.8rem', color: '#E6EEF8' }}>{v.dob || '—'}</td>
                    <td style={{ padding: '0.5rem 0.8rem' }}>
                      {v.approved
                        ? <span style={{ background: '#1B3A2F', color: '#8CFAC7', border: '1px solid #2E6B50', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>✅ Approved</span>
                        : <span style={{ background: '#2A2000', color: '#FFA726', border: '1px solid #7A5200', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>⏳ Pending</span>
                      }
                    </td>
                    <td style={{ padding: '0.5rem 0.8rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {!v.approved && (
                          <button onClick={() => approveVoter(v.id)} style={{ padding: '0.3rem 0.7rem', background: '#3EB489', color: '#0B101A', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>
                            ✓ Approve
                          </button>
                        )}
                        <button onClick={() => rejectVoter(v.id, v.name)} style={{ padding: '0.3rem 0.7rem', background: '#FF6B6B', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>
                          ✕ Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <h3>Manage Elections</h3>
        {elections.length === 0 && (
          <div style={styles.emptyState}>
            <p style={{ color: '#8899AA', margin: 0 }}>No elections yet. Click "+ Create Election" to get started.</p>
          </div>
        )}
        {elections.map(e => (
          <div key={e.id} style={styles.electionCard}>
            <div style={{ flex: 1 }}>
              <div style={styles.electionRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <strong>ID: {e.id}</strong> — {e.name}
                  <span style={{
                    ...styles.statusBadge,
                    background: e.status === 'active' ? '#1B3A2F' : '#2A2000',
                    color: e.status === 'active' ? '#8CFAC7' : '#FFA726',
                    border: `1px solid ${e.status === 'active' ? '#2E6B50' : '#7A5200'}`
                  }}>{e.status.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button onClick={() => toggleExpand(e.id)} style={styles.buttonLive}>
                    {expandedId === e.id ? '▲ Hide' : '📊 Live Count'}
                  </button>
                  <button onClick={() => toggleVoterStatus(e.id)} style={styles.buttonVoters}>
                    {voterStatusId === e.id ? '▲ Hide Voters' : '👥 Who Voted'}
                  </button>
                  {e.status === 'active' && (
                    <button onClick={() => setEditingElection(e)} style={styles.buttonEdit}>✏️ Edit</button>
                  )}
                  {e.status === 'active' && isVotingEnded(e) && (
                    <button onClick={() => autoTally(e.id)} style={styles.buttonSuccess}>Tally</button>
                  )}
                  {e.status === 'tallied' && (
                    <button onClick={() => navigate(`/results/${e.id}`)} style={styles.buttonInfo}>View Results</button>
                  )}
                  <button onClick={() => deleteElection(e.id)} style={styles.buttonDanger}>Delete</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                {e.candidates.map((c, i) => {
                  const photo = e.candidate_photos && e.candidate_photos[i];
                  return (
                    <div key={i} style={styles.candidateChipWithPhoto}>
                      {photo
                        ? <img src={photo} alt={c} style={styles.chipPhoto} onError={ev => { ev.target.style.display = 'none'; }} />
                        : <div style={styles.chipPhotoPlaceholder}>👤</div>}
                      <span style={{ fontSize: '0.78rem', color: '#A0B4D0' }}>{c}</span>
                    </div>
                  );
                })}
              </div>

              {e.end_time && e.status === 'active' && (
                <div style={{ fontSize: '0.82rem', color: isVotingEnded(e) ? '#8CFAC7' : '#FFA726', marginTop: '0.4rem' }}>
                  {isVotingEnded(e) ? '✅ Voting ended — ready to tally' : `⏰ Ends: ${new Date(e.end_time).toLocaleString()}`}
                </div>
              )}

              {expandedId === e.id && <LiveResults electionId={e.id} token={token} />}
              {voterStatusId === e.id && <VoterStatus electionId={e.id} token={token} />}
            </div>
          </div>
        ))}
      </div>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles = {
  container: { background: '#0F1725', color: '#E6EEF8', padding: '2rem', borderRadius: '12px', maxWidth: '960px', margin: '0 auto', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  createBtn: { padding: '0.8rem 1.5rem', background: 'linear-gradient(135deg, #7B61FF, #6848ff)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', boxShadow: '0 4px 16px rgba(123,97,255,0.4)' },
  section: { background: '#162033', border: '1px solid #263250', borderRadius: '12px', padding: '1.2rem' },
  emptyState: { background: '#0F1725', border: '1px dashed #2C3958', borderRadius: '10px', padding: '2rem', textAlign: 'center' },
  electionCard: { display: 'flex', padding: '0.9rem', background: '#0F1725', border: '1px solid #2C3958', borderRadius: '8px', marginBottom: '0.6rem' },
  electionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' },
  statusBadge: { padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 },
  candidateChipWithPhoto: { display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#162033', border: '1px solid #2C3958', borderRadius: '999px', padding: '0.2rem 0.7rem 0.2rem 0.2rem' },
  chipPhoto: { width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' },
  chipPhotoPlaceholder: { width: '24px', height: '24px', borderRadius: '50%', background: '#1E2B44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' },
  buttonLive: { padding: '0.6rem 0.9rem', background: '#1B2B44', color: '#6CA2FF', border: '1px solid #6CA2FF44', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' },
  buttonVoters: { padding: '0.6rem 0.9rem', background: '#1B3A2F', color: '#8CFAC7', border: '1px solid #2E6B5044', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' },
  buttonEdit: { padding: '0.6rem 0.9rem', background: '#2A1F00', color: '#FFA726', border: '1px solid #FFA72644', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' },
  buttonDanger: { padding: '0.6rem 0.9rem', background: '#FF6B6B', color: '#0B101A', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' },
  buttonSuccess: { padding: '0.6rem 0.9rem', background: '#3EB489', color: '#0B101A', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' },
  buttonInfo: { padding: '0.6rem 0.9rem', background: '#FFA726', color: '#0B101A', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' },
  success: { color: '#8CFAC7', marginTop: '0.6rem' },
  error: { color: '#FF8686', marginTop: '0.6rem' },
};

export default AdminPanel;