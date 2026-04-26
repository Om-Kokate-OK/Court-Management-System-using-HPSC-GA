import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const API = "http://localhost:8000/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API}/stats`)
      .then(r => setStats(r.data || {}))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load dashboard stats'));
  }, []);

  const pieData = [
    { name: 'Criminal', value: stats.criminal || 0, color: '#d32f2f' },
    { name: 'Civil', value: stats.civil || 0, color: '#1976d2' },
    { name: 'Family', value: stats.family || 0, color: '#7b1fa2' },
    { name: 'Corporate', value: stats.corporate || 0, color: '#388e3c' },
  ];

  const unlockArchitectureLab = async () => {
    setUnlocking(true);
    setError('');
    try {
      const res = await axios.get(`${API}/architecture/access`);
      if (res.data?.access_granted && res.data?.key) {
        navigate(`/architecture-lab?key=${encodeURIComponent(res.data.key)}`);
      } else {
        setError('Architecture lab access denied by API');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to unlock architecture lab');
    } finally {
      setUnlocking(false);
    }
  };

  const pendingPct = stats.total_cases ? Math.round(((stats.pending || 0) / stats.total_cases) * 100) : 0;

  return (
    <div>
      <h1 className="page-title">⚖️ Court Dashboard</h1>
      <div className="card dashboard-hero">
        <div>
          <h3>Today's System Pulse</h3>
          <p>
            Monitor active caseload, courtroom readiness, and run architecture simulation mode for your presentation.
          </p>
        </div>
        <button className="btn" onClick={unlockArchitectureLab} disabled={unlocking}>
          {unlocking ? 'Unlocking...' : 'Open Hidden Architecture Lab'}
        </button>
      </div>
      {error && <p style={{ color: '#d32f2f', marginTop: 10 }}>{error}</p>}
      <div className="stats-grid">
        <div className="stat-card"><h3>{stats.total_cases || 0}</h3><p>Total Cases</p></div>
        <div className="stat-card"><h3>{stats.total_courtrooms || 0}</h3><p>Active Courtrooms</p></div>
        <div className="stat-card"><h3>{stats.pending || 0}</h3><p>Pending Cases ({pendingPct}%)</p></div>
        <div className="stat-card"><h3>{stats.criminal || 0}</h3><p>Criminal Cases</p></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div className="card">
          <h3>Case Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Cases by Type</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={pieData}>
              <XAxis dataKey="name" /><YAxis /><Tooltip />
              <Bar dataKey="value" fill="#4a6cf7" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}