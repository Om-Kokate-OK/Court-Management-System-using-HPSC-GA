import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const API = 'http://localhost:8000/api';

export default function LiveSimulation() {
  const [source, setSource] = useState('database');
  const [numCases, setNumCases] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const runSimulation = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/simulation/dynamic`, {
        params: {
          case_source: source,
          num_cases: numCases,
        },
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to run dynamic simulation');
    } finally {
      setLoading(false);
    }
  };

  const timelineData = useMemo(() => {
    if (!result?.timeline) {
      return [];
    }
    return result.timeline.map((item) => ({
      day: item.day,
      remaining: item.remaining_after,
      closed: item.closed_today,
      overdue: item.overdue_today,
    }));
  }, [result]);

  return (
    <div>
      <h1 className="page-title">Live Court Simulation Arena</h1>

      <div className="card simulation-hero">
        <div>
          <h3>Real Court Vibe Test</h3>
          <p>
            Run HPCS-inspired day-by-day closure simulation. It keeps scheduling until all cases are closed or no
            capacity remains, so you can verify behavior clearly.
          </p>
        </div>

        <div className="simulation-controls">
          <label htmlFor="source-mode">Case Source</label>
          <select id="source-mode" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="database">Current Database Cases</option>
            <option value="synthetic">Synthetic Dynamic Cases</option>
          </select>

          <label htmlFor="num-cases">Synthetic Case Count</label>
          <input
            id="num-cases"
            type="number"
            min="10"
            max="120"
            value={numCases}
            onChange={(e) => setNumCases(Number(e.target.value || 0))}
            disabled={source !== 'synthetic'}
          />

          <button className="btn" onClick={runSimulation} disabled={loading}>
            {loading ? 'Running simulation...' : 'Start Live Simulation'}
          </button>
        </div>
      </div>

      {error && <p style={{ color: '#b22b2b', marginTop: 10 }}>{error}</p>}

      {result && (
        <>
          <div className="stats-grid" style={{ marginTop: 8 }}>
            <div className="stat-card"><h3>{result.summary.total_cases}</h3><p>Total Cases</p></div>
            <div className="stat-card"><h3>{result.summary.closed_cases}</h3><p>Closed Cases</p></div>
            <div className="stat-card"><h3>{result.summary.remaining_cases}</h3><p>Remaining Cases</p></div>
            <div className="stat-card"><h3>{result.summary.simulation_days}</h3><p>Simulation Days</p></div>
            <div className="stat-card"><h3>{result.summary.deadline_breaches}</h3><p>Deadline Breaches</p></div>
            <div className="stat-card"><h3>{result.summary.fairness_index}</h3><p>Fairness Index</p></div>
          </div>

          <div className="card">
            <h3>Backlog vs Closure Trend</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="remaining" stroke="#c0392b" name="Remaining Cases" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="closed" stroke="#0e8f86" name="Closed per Day" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="overdue" stroke="#d37b18" name="Overdue per Day" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3>Court Docket Feed (Day-by-Day)</h3>
            <div className="docket-grid">
              {result.timeline.slice(0, 12).map((day) => (
                <div className="docket-day" key={day.day}>
                  <div className="docket-day-head">
                    <strong>Day {day.day}</strong>
                    <span>{day.date}</span>
                  </div>
                  <p>
                    Closed: <strong>{day.closed_today}</strong> | Remaining: <strong>{day.remaining_after}</strong>
                  </p>
                  <div className="docket-tags">
                    {day.assignments.slice(0, 6).map((a) => (
                      <span key={`${day.day}-${a.case_id}`} className={`badge badge-${a.case_type}`}>
                        {a.case_id} -> {a.courtroom}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <div className="card" style={{ marginBottom: 0 }}>
              <h3>Top Ranked Cases Snapshot</h3>
              <table style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Type</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {result.ranked_snapshot.slice(0, 10).map((item) => (
                    <tr key={item.case_id}>
                      <td>{item.case_id}</td>
                      <td><span className={`badge badge-${item.case_type}`}>{item.case_type}</span></td>
                      <td>{item.priority_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <h3>Courtroom Usage</h3>
              <table style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th>Courtroom</th>
                    <th>Cases Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.room_usage).map(([room, count]) => (
                    <tr key={room}>
                      <td>{room}</td>
                      <td>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
