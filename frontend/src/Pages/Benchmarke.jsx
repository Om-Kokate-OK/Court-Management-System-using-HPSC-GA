import React, { useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Benchmark() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('http://localhost:8000/api/benchmark');
      setResults(res.data.results || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Benchmark request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">📊 Algorithm Benchmark</h1>
      <div className="card">
        <p>Compare HPCS-GA against FCFS, Original Weighted, and SJF on real metrics.</p>
        <button className="btn" style={{ marginTop: 12 }} onClick={run} disabled={loading}>
          {loading ? '⏳ Running...' : '▶️ Run Benchmark'}
        </button>
        {error && <p style={{ color: '#d32f2f', marginTop: 10 }}>{error}</p>}
      </div>

      {results.length > 0 && (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <h3>Performance Metrics</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={results}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="algorithm" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avg_hearing_wait" fill="#f44336" name="Avg Hearing Wait (days)" />
                <Bar dataKey="judge_utilization_pct" fill="#4caf50" name="Utilization %" />
                <Bar dataKey="throughput" fill="#2196f3" name="Throughput" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Algorithm</th><th>Avg Wait</th><th>Violations %</th>
                  <th>Utilization %</th><th>Starvation</th><th>Throughput</th><th>Fairness</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.algorithm} className={r.algorithm.includes('HPCS') ? 'winner-row' : ''}>
                    <td>{r.algorithm}</td>
                    <td>{r.avg_hearing_wait}</td>
                    <td>{r.deadline_violations_pct}%</td>
                    <td>{r.judge_utilization_pct}%</td>
                    <td>{r.starvation_count}</td>
                    <td>{r.throughput}</td>
                    <td>{r.fairness_index}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}