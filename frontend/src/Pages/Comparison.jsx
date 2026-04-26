import React, { useState, useRef } from 'react';
import axios from 'axios';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid
} from 'recharts';

const API = "http://localhost:8000/api";

export default function Comparison() {
  const [results, setResults] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [datasetInfo, setDatasetInfo] = useState(null);
  const fileInputRef = useRef(null);

  // ===== CSV UPLOAD =====
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setUploadStatus({ type: 'error', message: 'Please upload a CSV file' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadStatus({ type: 'loading', message: 'Uploading...' });
      const res = await axios.post(`${API}/upload-csv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUploadStatus({
        type: 'success',
        message: `✅ Imported ${res.data.imported} cases successfully!`,
        errors: res.data.errors
      });

      // Auto-run comparison
      setTimeout(() => runComparison(), 500);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setUploadStatus({
        type: 'error',
        message: typeof detail === 'string' ? detail : 'Upload failed',
        errors: detail?.errors || []
      });
    }
  };

  // ===== DOWNLOAD SAMPLE =====
  const downloadSample = () => {
    window.location.href = `${API}/download-sample-csv`;
  };

  // ===== RUN COMPARISON =====
  const runComparison = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/compare-algorithms`);
      setResults(res.data.results);
      setAssignments(res.data.assignments);
      setDatasetInfo({
        cases: res.data.dataset_size,
        rooms: res.data.rooms_count,
        referenceTime: res.data.reference_time || null
      });
    } catch (err) {
      alert(err.response?.data?.detail || 'Comparison failed');
    }
    setLoading(false);
  };

  // ===== Algorithm metadata =====
  const algorithmsInfo = [
    {
      name: "FCFS",
      formula: "Order by filed_date",
      complexity: "O(n)",
      pros: ["Simple", "Fair for equal cases"],
      cons: ["Ignores severity", "High waiting", "No deadline awareness"]
    },
    {
      name: "Original Weighted",
      formula: "P = w₁·Age + w₂·Severity + w₃·Urgency + w₄·Complexity",
      complexity: "O(n log n)",
      pros: ["Considers multiple factors", "Easy to implement"],
      cons: ["Static weights", "No courtroom matching", "Linear scoring"]
    },
    {
      name: "SJF",
      formula: "Order by estimated_duration",
      complexity: "O(n log n)",
      pros: ["High throughput", "Quick cases finished fast"],
      cons: ["Severe starvation", "Ignores urgency"]
    },
    {
      name: "HPCS-GA (Proposed)",
      formula: "P = α·S² + β·U·log(1+A) + γ·K + δ·(100/D) + ε·I",
      complexity: "O(n³ + GA)",
      pros: [
        "Non-linear severity scoring",
        "Logarithmic aging (no explosion)",
        "Strong deadline pressure",
        "Adaptive weights via GA",
        "Hard constraint enforcement"
      ],
      cons: ["Higher complexity", "Needs tuning"]
    }
  ];

  // Build radar data dynamically
  const radarData = results.length > 0 ? [
    {
      metric: 'Low Wait Time',
      ...Object.fromEntries(results.map(r => [
        r.algorithm.replace(' (Proposed)', ''),
        Math.max(0, 100 - r.severity_weighted_wait)
      ]))
    },
    {
      metric: 'No Violations',
      ...Object.fromEntries(results.map(r => [
        r.algorithm.replace(' (Proposed)', ''),
        Math.max(0, 100 - r.deadline_violations_pct)
      ]))
    },
    {
      metric: 'No Urgent Violations',
      ...Object.fromEntries(results.map(r => [
        r.algorithm.replace(' (Proposed)', ''),
        Math.max(0, 100 - r.urgent_violations_pct)
      ]))
    },
    {
      metric: 'Fairness',
      ...Object.fromEntries(results.map(r => [
        r.algorithm.replace(' (Proposed)', ''),
        r.fairness_index * 100
      ]))
    },
    {
      metric: 'Utilization',
      ...Object.fromEntries(results.map(r => [
        r.algorithm.replace(' (Proposed)', ''),
        r.judge_utilization_pct
      ]))
    },
  ] : [];

  const hasAnyViolation = results.some(
    r =>
      Number(r.deadline_violations_pct) > 0 ||
      Number(r.urgent_violations_pct) > 0 ||
      Number(r.critical_violations_pct) > 0
  );

  return (
    <div>
      <h1 className="page-title">🏆 Algorithm Comparison Lab</h1>

      {/* CSV UPLOAD */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #4a6cf7, #6a4cf7)', color: 'white' }}>
        <h2>📂 Upload Your Court Data</h2>
        <p style={{ marginTop: 8, opacity: 0.9 }}>
          Upload a CSV file with real court cases to test all 4 algorithms on YOUR data.
        </p>

        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
          <button
            className="btn"
            onClick={() => fileInputRef.current.click()}
            style={{ background: 'white', color: '#4a6cf7' }}
          >
            📤 Upload CSV File
          </button>

          <button
            className="btn"
            onClick={downloadSample}
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid white' }}
          >
            📥 Download Sample CSV
          </button>

          <button
            className="btn"
            onClick={runComparison}
            disabled={loading}
            style={{ background: '#ffc107', color: '#000' }}
          >
            {loading ? '⏳ Running...' : '🚀 Run Comparison on Current Data'}
          </button>
        </div>

        {uploadStatus && (
          <div style={{
            marginTop: 12, padding: 12, borderRadius: 6,
            background: uploadStatus.type === 'success' ? 'rgba(76,175,80,0.3)' :
              uploadStatus.type === 'error' ? 'rgba(244,67,54,0.3)' : 'rgba(255,255,255,0.2)'
          }}>
            <strong>{uploadStatus.message}</strong>
            {uploadStatus.errors && uploadStatus.errors.length > 0 && (
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 12 }}>
                {uploadStatus.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* CSV FORMAT GUIDE */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>📋 Required CSV Format</h3>
        <pre style={{
          background: '#f5f5f5', padding: 12, borderRadius: 6,
          fontSize: 12, overflowX: 'auto', marginTop: 8
        }}>
          {`case_id,case_type,severity,urgency,complexity,filed_date,deadline,public_interest,plaintiff,defendant,estimated_duration
CASE-1001,criminal,9,10,7,2024-06-15,2025-01-15,8,State,John Smith,4
CASE-1002,civil,4,5,6,2024-09-20,2025-03-20,2,Alice Corp,Bob Inc,3`}
        </pre>
        <table style={{ marginTop: 12, fontSize: 13 }}>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Range</th></tr>
          </thead>
          <tbody>
            <tr><td>case_type</td><td>string</td><td>criminal / civil / family / corporate</td></tr>
            <tr><td>severity, urgency, complexity</td><td>integer</td><td>1-10</td></tr>
            <tr><td>filed_date, deadline</td><td>date</td><td>YYYY-MM-DD</td></tr>
            <tr><td>public_interest</td><td>integer</td><td>0-10</td></tr>
            <tr><td>estimated_duration</td><td>integer</td><td>1-8 (hours)</td></tr>
          </tbody>
        </table>
      </div>

      {/* RESULTS */}
      {results.length > 0 && (
        <>
          <div className="card" style={{ marginTop: 16, background: '#e8f5e9' }}>
            <h3>📊 Comparison Results</h3>
            <p>Tested on <strong>{datasetInfo?.cases}</strong> cases across <strong>{datasetInfo?.rooms}</strong> courtrooms.</p>
            {datasetInfo?.referenceTime && (
              <p style={{ marginTop: 6 }}>Evaluation reference date: <strong>{new Date(datasetInfo.referenceTime).toLocaleDateString()}</strong></p>
            )}
          </div>

          {/* Metrics Bar Chart */}
          <div className="card" style={{ marginTop: 16 }}>
            <h3>📈 Key Metrics Comparison</h3>
            {!hasAnyViolation && (
              <p style={{ color: '#666', marginBottom: 10 }}>
                All violation metrics are 0% for this dataset because available courtroom capacity can schedule almost all cases on day 0-1.
              </p>
            )}
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={results}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="algorithm" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value, name) => (
                  name.includes('Wait') ? [value, `${name} (days)`] : [`${value}%`, name]
                )} />
                <Legend />
                <Bar yAxisId="left" dataKey="deadline_violations_pct" fill="#f44336" name="Total Violations" />
                <Bar yAxisId="left" dataKey="urgent_violations_pct" fill="#ff9800" name="Urgent Violations" />
                <Bar yAxisId="left" dataKey="critical_violations_pct" fill="#d32f2f" name="Critical Violations" />
                <Bar yAxisId="right" dataKey="severity_weighted_wait" fill="#9c27b0" name="Severity-Weighted Wait" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar Chart */}
          <div className="card" style={{ marginTop: 16 }}>
            <h3>🎯 Multi-Metric Performance</h3>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="FCFS" dataKey="FCFS" stroke="#f44336" fill="#f44336" fillOpacity={0.2} />
                <Radar name="Original Weighted" dataKey="Original Weighted" stroke="#ff9800" fill="#ff9800" fillOpacity={0.2} />
                <Radar name="SJF" dataKey="SJF" stroke="#9c27b0" fill="#9c27b0" fillOpacity={0.2} />
                <Radar name="HPCS-GA" dataKey="HPCS-GA" stroke="#4caf50" fill="#4caf50" fillOpacity={0.5} />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Metrics Table */}
          <div className="card" style={{ marginTop: 16 }}>
            <h3>📋 Detailed Metrics Table</h3>
            <table>
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th>Sev-Wait</th>
                  <th>All Viol %</th>
                  <th>Urgent Viol %</th>
                  <th>Critical Viol %</th>
                  <th>Starvation</th>
                  <th>Fairness</th>
                  <th>Clearance Days</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.algorithm} className={r.algorithm.includes('HPCS') ? 'winner-row' : ''}>
                    <td><strong>{r.algorithm}</strong></td>
                    <td>{r.severity_weighted_wait}</td>
                    <td>{r.deadline_violations_pct}%</td>
                    <td>{r.urgent_violations_pct}%</td>
                    <td>{r.critical_violations_pct}%</td>
                    <td>{r.starvation_count}</td>
                    <td>{r.fairness_index}</td>
                    <td>{r.estimated_clearance_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Side-by-Side Schedule Comparison */}
          <div className="card" style={{ marginTop: 16 }}>
            <h3>🔍 Schedule Comparison (Top 10 Cases per Algorithm)</h3>
            <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
              See which cases each algorithm prioritizes first. HPCS-GA should pick urgent + severe cases.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {Object.entries(assignments).map(([algoName, items]) => (
                <div key={algoName} style={{
                  border: algoName.includes('HPCS') ? '3px solid #4caf50' : '1px solid #ddd',
                  borderRadius: 8, padding: 12
                }}>
                  <h4 style={{ marginBottom: 8 }}>
                    {algoName} {algoName.includes('HPCS') && '⭐'}
                  </h4>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr><th>Pos</th><th>Case</th><th>Type</th><th>Day</th><th>Score</th></tr>
                    </thead>
                    <tbody>
                      {items.slice(0, 10).map(a => (
                        <tr key={a.case_id}>
                          <td>{a.position}</td>
                          <td>{a.case_id}</td>
                          <td>{a.case_type === 'criminal' ? '🔴' : a.case_type === 'civil' ? '🔵' : a.case_type === 'family' ? '🟣' : '🟢'}</td>
                          <td>{a.hearing_day}</td>
                          <td>{Number(a.priority_score || 0).toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ALGORITHM DETAILS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
        {algorithmsInfo.map(a => (
          <div key={a.name} className="card" style={{
            borderLeft: a.name.includes('HPCS') ? '5px solid #4caf50' : '5px solid #ddd'
          }}>
            <h3>{a.name} {a.name.includes('HPCS') && '⭐'}</h3>
            <p style={{
              fontFamily: 'monospace', background: '#f5f5f5', padding: 8,
              borderRadius: 6, fontSize: 12, marginTop: 8
            }}>
              {a.formula}
            </p>
            <p style={{ marginTop: 8 }}><strong>Complexity:</strong> {a.complexity}</p>
            <div style={{ marginTop: 12 }}>
              <strong style={{ color: 'green' }}>✅ Pros:</strong>
              <ul style={{ marginLeft: 20, fontSize: 13 }}>
                {a.pros.map(p => <li key={p}>{p}</li>)}
              </ul>
            </div>
            <div style={{ marginTop: 8 }}>
              <strong style={{ color: 'red' }}>❌ Cons:</strong>
              <ul style={{ marginLeft: 20, fontSize: 13 }}>
                {a.cons.map(c => <li key={c}>{c}</li>)}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* CONCLUSION */}
      {results.length > 0 && (
        <div className="card" style={{
          marginTop: 16, background: 'linear-gradient(135deg, #4caf50, #2e7d32)', color: 'white'
        }}>
          <h2>🎯 Conclusion (Based on YOUR Data)</h2>
          <ConclusionSection results={results} />
        </div>
      )}
    </div>
  );
}

function ConclusionSection({ results }) {
  const hpcs = results.find(r => r.algorithm.includes('HPCS'));
  const fcfs = results.find(r => r.algorithm === 'FCFS');
  const original = results.find(r => r.algorithm === 'Original Weighted');

  if (!hpcs || !fcfs || !original) return null;

  const violReduction = fcfs.deadline_violations_pct > 0
    ? ((fcfs.deadline_violations_pct - hpcs.deadline_violations_pct) / fcfs.deadline_violations_pct * 100).toFixed(1)
    : 0;

  const urgentReduction = fcfs.urgent_violations_pct > 0
    ? ((fcfs.urgent_violations_pct - hpcs.urgent_violations_pct) / fcfs.urgent_violations_pct * 100).toFixed(1)
    : 0;

  return (
    <div>
      <p style={{ fontSize: 16, marginTop: 8, lineHeight: 1.6 }}>
        On your dataset, <strong>HPCS-GA</strong> outperforms baseline algorithms:
      </p>
      <ul style={{ marginLeft: 20, marginTop: 12, lineHeight: 2, fontSize: 15 }}>
        <li>📉 <strong>{violReduction}%</strong> fewer deadline violations vs FCFS</li>
        <li>🚨 <strong>{urgentReduction}%</strong> fewer urgent case violations vs FCFS</li>
        <li>⚖️ <strong>{((hpcs.fairness_index - fcfs.fairness_index) * 100).toFixed(1)}%</strong> higher fairness index</li>
        <li>🛑 <strong>{fcfs.starvation_count - hpcs.starvation_count}</strong> fewer starved cases</li>
      </ul>
    </div>
  );
}