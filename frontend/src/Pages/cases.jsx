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
      <button className="btn" onClick={() => setShowForm(!showForm)}>+ File New Case</button>
      {error && <p style={{ color: '#d32f2f', marginTop: 10 }}>{error}</p>}
      {loading && <p style={{ marginTop: 10 }}>Loading cases...</p>}

      {showForm && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>File New Case</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <input placeholder="Plaintiff" onChange={e => setForm({ ...form, plaintiff: e.target.value })} />
            <input placeholder="Defendant" onChange={e => setForm({ ...form, defendant: e.target.value })} />
            <select onChange={e => setForm({ ...form, case_type: e.target.value })}>
              <option value="criminal">Criminal</option><option value="civil">Civil</option>
              <option value="family">Family</option><option value="corporate">Corporate</option>
            </select>
            <input type="number" placeholder="Severity (1-10)" onChange={e => setForm({ ...form, severity: +e.target.value })} />
            <input type="number" placeholder="Urgency (1-10)" onChange={e => setForm({ ...form, urgency: +e.target.value })} />
            <input type="number" placeholder="Complexity (1-10)" onChange={e => setForm({ ...form, complexity: +e.target.value })} />
          </div>
          <button className="btn" style={{ marginTop: 12 }} onClick={submit}>Submit Case</button>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
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