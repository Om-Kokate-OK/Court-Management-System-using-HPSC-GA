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

  return (
    <div>
      <h1 className="page-title">🏛️ Courtrooms</h1>
      {error && <p style={{ color: '#d32f2f', marginTop: 10 }}>{error}</p>}
      {loading && <p style={{ marginTop: 10 }}>Loading courtrooms...</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {rooms.map(r => (
          <div key={r.id} className="card">
            <h3>{r.name}</h3>
            <p style={{ color: '#8a9ab5', marginTop: 4 }}>👨‍⚖️ {r.judge_name}</p>
            <div style={{ marginTop: 12 }}>
              {r.judge_expertise.map(e => <span key={e} className={`badge badge-${e}`} style={{ marginRight: 4 }}>{e}</span>)}
            </div>
            <p style={{ marginTop: 12, fontSize: 13 }}>Capacity: {r.capacity} | Load: {r.current_load}</p>
            <p style={{ color: r.available ? 'green' : 'red', fontSize: 13, marginTop: 4 }}>● {r.available ? 'Available' : 'Busy'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}