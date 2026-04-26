import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function Cases() {
  const [cases, setCases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    case_type: 'criminal', severity: 5, urgency: 5, complexity: 5,
    public_interest: 5, deadline_days: 30, plaintiff: '', defendant: ''
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('http://localhost:8000/api/cases');
      setCases(res.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setError('');
    try {
      await axios.post('http://localhost:8000/api/cases/add', form);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add case');
    }
  };

  return (
    <div>
      <h1 className="page-title">📁 Case Management</h1>
      <div className="card page-toolbar">
        <div>
          <h3>Case Intake Console</h3>
          <p>Track incoming legal matters and file new cases with structured priority factors.</p>
        </div>
        <button className="btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Hide Case Form' : '+ File New Case'}
        </button>
      </div>
      {error && <p style={{ color: '#d32f2f', marginTop: 10 }}>{error}</p>}
      {loading && <p style={{ marginTop: 10 }}>Loading cases...</p>}

      <div className="stats-grid" style={{ marginTop: 6 }}>
        <div className="stat-card"><h3>{cases.length}</h3><p>Total Loaded Cases</p></div>
        <div className="stat-card"><h3>{cases.filter(c => c.case_type === 'criminal').length}</h3><p>Criminal Queue</p></div>
        <div className="stat-card"><h3>{cases.filter(c => c.case_type === 'civil').length}</h3><p>Civil Queue</p></div>
        <div className="stat-card"><h3>{cases.filter(c => c.case_type === 'family').length}</h3><p>Family Queue</p></div>
      </div>

      {showForm && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>File New Case</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
            <input placeholder="Plaintiff" value={form.plaintiff} onChange={e => setForm({ ...form, plaintiff: e.target.value })} />
            <input placeholder="Defendant" value={form.defendant} onChange={e => setForm({ ...form, defendant: e.target.value })} />
            <select value={form.case_type} onChange={e => setForm({ ...form, case_type: e.target.value })}>
              <option value="criminal">Criminal</option><option value="civil">Civil</option>
              <option value="family">Family</option><option value="corporate">Corporate</option>
            </select>
            <input type="number" min="1" max="10" placeholder="Severity (1-10)" value={form.severity} onChange={e => setForm({ ...form, severity: +e.target.value })} />
            <input type="number" min="1" max="10" placeholder="Urgency (1-10)" value={form.urgency} onChange={e => setForm({ ...form, urgency: +e.target.value })} />
            <input type="number" min="1" max="10" placeholder="Complexity (1-10)" value={form.complexity} onChange={e => setForm({ ...form, complexity: +e.target.value })} />
            <input type="number" min="0" max="10" placeholder="Public Interest (0-10)" value={form.public_interest} onChange={e => setForm({ ...form, public_interest: +e.target.value })} />
            <input type="number" min="1" max="120" placeholder="Deadline (days)" value={form.deadline_days} onChange={e => setForm({ ...form, deadline_days: +e.target.value })} />
          </div>
          <button className="btn" style={{ marginTop: 12 }} onClick={submit}>Submit Case</button>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 10 }}>Recent Cases (Top 30)</h3>
        <table>
          <thead>
            <tr><th>ID</th><th>Type</th><th>Plaintiff</th><th>Severity</th><th>Urgency</th><th>Priority Score</th></tr>
          </thead>
          <tbody>
            {cases.slice(0, 30).map(c => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td><span className={`badge badge-${c.case_type}`}>{c.case_type}</span></td>
                <td>{c.plaintiff}</td>
                <td>{c.severity}</td>
                <td>{c.urgency}</td>
                <td><strong>{c.priority_score}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}