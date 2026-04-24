import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import Login from './Login';
import Register from './Register';
import ElectionList from './ElectionList';
import VoteForm from './VoteForm';
import AdminPanel from './AdminPanel';
import Results from './Results';
import VoterPanel from './VoterPanel';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
  };

  return (
    <Router>
      <div>
        {user && (
          <nav style={styles.nav}>
            <div>
              <Link
                to={user.role === 'admin' ? '/admin' : '/voter'}
                style={styles.link}
              >
                {user.role === 'admin' ? 'Admin Panel' : 'Voter Dashboard'}
              </Link>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: '#E6EEF8' }}>Welcome, {user.name}</span>
              <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
            </div>
          </nav>
        )}
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/login"
            element={!user ? <Login onLogin={handleLogin} /> : <Navigate to={user.role === 'admin' ? '/admin' : '/voter'} />}
          />
          <Route
            path="/register"
            element={!user ? <Register /> : <Navigate to={user.role === 'admin' ? '/admin' : '/voter'} />}
          />
          {/* Voter Panel - main page for voters */}
          <Route
            path="/voter"
            element={user && user.role !== 'admin' ? <VoterPanel token={token} user={user} /> : <Navigate to="/login" />}
          />
          {/* Keep /elections for backward compat */}
          <Route
            path="/elections"
            element={user ? <ElectionList token={token} user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/vote/:electionId"
            element={user ? <VoteForm token={token} user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/admin"
            element={user && user.role === 'admin' ? <AdminPanel token={token} /> : <Navigate to="/login" />}
          />
          <Route path="/results/:electionId" element={<Results />} />
        </Routes>
      </div>
    </Router>
  );
}

const styles = {
  nav: {
    background: 'rgba(15,23,37,0.95)',
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  link: {
    color: '#E6EEF8',
    textDecoration: 'none',
    fontWeight: 'bold',
    fontSize: '1.1rem'
  },
  logoutBtn: {
    background: '#FF6B6B',
    color: '#0B101A',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold'
  }
};

export default App;
