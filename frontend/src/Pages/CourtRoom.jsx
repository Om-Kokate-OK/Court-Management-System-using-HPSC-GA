import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function Courtrooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get('http://localhost:8000/api/courtrooms');
        setRooms(res.data || []);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load courtrooms');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const availableCount = rooms.filter((r) => r.available).length;
  const avgLoad = rooms.length
    ? (rooms.reduce((sum, r) => sum + Number(r.current_load || 0), 0) / rooms.length).toFixed(1)
    : 0;

  return (
    <div>
      <h1 className="page-title">🏛️ Courtrooms</h1>
      <div className="card page-toolbar">
        <div>
          <h3>Bench Capacity Overview</h3>
          <p>Review judge expertise, room utilization, and availability before running optimization.</p>
        </div>
      </div>
      {error && <p style={{ color: '#d32f2f', marginTop: 10 }}>{error}</p>}
      {loading && <p style={{ marginTop: 10 }}>Loading courtrooms...</p>}
      <div className="stats-grid" style={{ marginTop: 6 }}>
        <div className="stat-card"><h3>{rooms.length}</h3><p>Total Courtrooms</p></div>
        <div className="stat-card"><h3>{availableCount}</h3><p>Available Now</p></div>
        <div className="stat-card"><h3>{rooms.length - availableCount}</h3><p>Busy Rooms</p></div>
        <div className="stat-card"><h3>{avgLoad}</h3><p>Average Load</p></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {rooms.map(r => (
          <div key={r.id} className="card">
            <h3>{r.name}</h3>
            <p style={{ color: '#557f7b', marginTop: 4 }}>👨‍⚖️ {r.judge_name}</p>
            <div style={{ marginTop: 12 }}>
              {r.judge_expertise.map(e => <span key={e} className={`badge badge-${e}`} style={{ marginRight: 4 }}>{e}</span>)}
            </div>
            <p style={{ marginTop: 12, fontSize: 13 }}>Capacity: {r.capacity} | Load: {r.current_load}</p>
            <p style={{ color: r.available ? '#177a58' : '#aa3b34', fontSize: 13, marginTop: 4 }}>● {r.available ? 'Available' : 'Busy'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}