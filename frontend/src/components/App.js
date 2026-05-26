import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import LandingPage from './LandingPage';
import Login from './Login';
import Register from './Register';
import ElectionList from './ElectionList';
import VoteForm from './VoteForm';
import AdminPanel from './AdminPanel';
import Results from './Results';
import VoterPanel from './VoterPanel';

function NavBar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dashboardPath = user.role === 'admin' ? '/admin' : '/voter';
  const dashboardLabel = user.role === 'admin' ? 'Admin Panel' : 'Voter Dashboard';
  const isOnDashboard = location.pathname === dashboardPath;
  return (
    <nav style={styles.nav}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {!isOnDashboard && <button onClick={() => navigate(-1)} style={styles.backBtn}>← Back</button>}
        <Link to={dashboardPath} style={styles.link}>{dashboardLabel}</Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ color: '#E6EEF8', fontSize: 'clamp(0.78rem, 3vw, 1rem)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px', whiteSpace: 'nowrap' }}>Hi, {user.name}</span>
        <button onClick={onLogout} style={styles.logoutBtn}>Logout</button>
      </div>
    </nav>
  );
}

function AppInner() {
  const navigate = useNavigate();

  // Read from sessionStorage on first load
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('sv_user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => {
    return sessionStorage.getItem('sv_token') || null;
  });

  const handleLogin = (userData, authToken) => {
    console.log('APP handleLogin fired, role:', userData.role);
    sessionStorage.setItem('sv_user', JSON.stringify(userData));
    sessionStorage.setItem('sv_token', authToken);
    setUser(userData);
    setToken(authToken);
    const dest = userData.role === 'admin' ? '/admin' : '/voter';
    console.log('APP navigating to:', dest);
    navigate(dest);
    console.log('APP navigate called');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('sv_user');
    sessionStorage.removeItem('sv_token');
    setUser(null);
    setToken(null);
    navigate('/login');
  };

  return (
    <div>
      {user && <NavBar user={user} onLogout={handleLogout} />}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={!user ? <Login onLogin={handleLogin} /> : <Navigate to={user.role === 'admin' ? '/admin' : '/voter'} />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to={user.role === 'admin' ? '/admin' : '/voter'} />} />
        <Route path="/voter" element={user ? <VoterPanel token={token} user={user} /> : <Navigate to="/login" />} />
        <Route path="/elections" element={user ? <ElectionList token={token} user={user} /> : <Navigate to="/login" />} />
        <Route path="/vote/:electionId" element={user ? <VoteForm token={token} user={user} /> : <Navigate to="/login" />} />
        <Route path="/admin" element={user && user.role === 'admin' ? <AdminPanel token={token} user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
        <Route path="/results/:electionId" element={<Results />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppInner />
    </Router>
  );
}

const styles = {
  nav: { background: 'rgba(15,23,37,0.97)', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, flexWrap: 'wrap', gap: '0.5rem', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(108,162,255,0.1)' },
  link: { color: '#E6EEF8', textDecoration: 'none', fontWeight: 'bold', fontSize: 'clamp(0.85rem, 3vw, 1rem)', whiteSpace: 'nowrap' },
  backBtn: { background: '#1B2537', color: '#6CA2FF', border: '1px solid #6CA2FF44', padding: '0.45rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: 'clamp(0.78rem, 2.5vw, 0.9rem)', whiteSpace: 'nowrap' },
  logoutBtn: { background: '#FF6B6B', color: '#0B101A', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: 'clamp(0.78rem, 2.5vw, 0.9rem)', whiteSpace: 'nowrap' }
};

export default App;