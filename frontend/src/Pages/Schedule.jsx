import React, { useState } from 'react';
import axios from 'axios';

export default function Schedule() {
  const [assignments, setAssignments] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [referenceTime, setReferenceTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runScheduler = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('http://localhost:8000/api/schedule');
      setAssignments(res.data.assignments || []);
      setMetrics(res.data.metrics || null);
      setReferenceTime(res.data.reference_time || '');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to run scheduler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">🤖 HPCS-GA Smart Scheduler</h1>
      <div className="card">
        <p>Run the proposed <strong>HPCS-GA algorithm</strong> to optimally assign cases to courtrooms using Hungarian Algorithm + Genetic Adaptation.</p>
        <button className="btn" style={{ marginTop: 12 }} onClick={runScheduler} disabled={loading}>
          {loading ? '⏳ Optimizing...' : '🚀 Run Smart Scheduler'}
        </button>
        {error && <p style={{ color: '#d32f2f', marginTop: 10 }}>{error}</p>}
      </div>

      {metrics && (
        <div className="card" style={{ marginTop: 16, background: '#eef6ff' }}>
          <p style={{ margin: 0 }}>
            Evaluation Reference Date: <strong>{referenceTime ? new Date(referenceTime).toLocaleDateString() : 'Current date'}</strong>
          </p>
        </div>
      )}

      {metrics && (
        <div className="stats-grid" style={{ marginTop: 16 }}>
          <div className="stat-card"><h3>{metrics.throughput}</h3><p>Scheduled Cases</p></div>
          <div className="stat-card"><h3>{metrics.deadline_violations_pct}%</h3><p>Deadline Violations</p></div>
          <div className="stat-card"><h3>{metrics.urgent_violations_pct}%</h3><p>Urgent Violations</p></div>
          <div className="stat-card"><h3>{metrics.avg_hearing_wait}</h3><p>Avg Hearing Wait</p></div>
          <div className="stat-card"><h3>{metrics.fairness_index}</h3><p>Fairness Index</p></div>
          <div className="stat-card"><h3>{metrics.estimated_clearance_days}</h3><p>Clearance Days</p></div>
        </div>
      )}

      {assignments.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Optimal Assignments ({assignments.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Case</th><th>Type</th><th>Courtroom</th><th>Judge</th><th>Priority</th><th>Queue Position</th><th>Hearing Day</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => (
                <tr key={a.case_id}>
                  <td>{a.case_id}</td>
                  <td><span className={`badge badge-${a.case_type}`}>{a.case_type}</span></td>
                  <td>{a.courtroom_name}</td>
                  <td>{a.judge}</td>
                  <td><strong>{Number(a.priority_score).toFixed(2)}</strong></td>
                  <td>{a.position}</td>
                  <td>{a.hearing_day}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}