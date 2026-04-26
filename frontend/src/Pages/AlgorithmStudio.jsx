import React, { useState } from 'react';
import axios from 'axios';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';

const API = 'http://localhost:8000/api';

export default function AlgorithmStudio() {
    const [hungarian, setHungarian] = useState(null);
    const [gaHistory, setGaHistory] = useState([]);
    const [gaMeta, setGaMeta] = useState(null);
    const [loadingHungarian, setLoadingHungarian] = useState(false);
    const [loadingGa, setLoadingGa] = useState(false);
    const [error, setError] = useState('');

    const [topN, setTopN] = useState(12);
    const [gaCases, setGaCases] = useState(120);
    const [gaRooms, setGaRooms] = useState(5);
    const [gaGenerations, setGaGenerations] = useState(20);
    const [gaPop, setGaPop] = useState(30);

    const loadHungarian = async () => {
        setLoadingHungarian(true);
        setError('');
        try {
            const res = await axios.get(`${API}/visualization/hungarian`, {
                params: { top_n: topN },
            });
            setHungarian(res.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to load Hungarian visualization');
        } finally {
            setLoadingHungarian(false);
        }
    };

    const runGaEvolution = async () => {
        setLoadingGa(true);
        setError('');
        try {
            const res = await axios.get(`${API}/ga-evolution`, {
                params: {
                    num_cases: gaCases,
                    num_rooms: gaRooms,
                    generations: gaGenerations,
                    pop_size: gaPop,
                },
            });
            setGaHistory(res.data.history || []);
            setGaMeta({
                finalWeights: res.data.final_weights,
                numCases: res.data.num_cases,
                numRooms: res.data.num_rooms,
            });
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to run GA evolution');
        } finally {
            setLoadingGa(false);
        }
    };

    const downloadPdf = () => {
        window.open(`${API}/report/pdf`, '_blank');
    };

    return (
        <div>
            <h1 className="page-title">Algorithm Studio</h1>

            {error && <p style={{ color: '#d32f2f', marginBottom: 10 }}>{error}</p>}

            <div className="card">
                <h3>Hungarian Execution Visualization</h3>
                <p style={{ marginTop: 8 }}>
                    Shows ranked cases, cost matrix, and the selected minimum-cost case-room pairs.
                </p>
                <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label>
                        Top cases
                        <input
                            type="number"
                            min="4"
                            max="20"
                            value={topN}
                            onChange={(e) => setTopN(Number(e.target.value || 0))}
                            style={{ marginLeft: 8, width: 70 }}
                        />
                    </label>
                    <button className="btn" onClick={loadHungarian} disabled={loadingHungarian}>
                        {loadingHungarian ? 'Loading...' : 'Run Hungarian View'}
                    </button>
                </div>

                {hungarian && (
                    <div style={{ marginTop: 16 }}>
                        <p>
                            Reference date:{' '}
                            <strong>
                                {hungarian.reference_time ? new Date(hungarian.reference_time).toLocaleDateString() : 'n/a'}
                            </strong>
                        </p>
                        <ol style={{ marginTop: 10, marginLeft: 18 }}>
                            {(hungarian.steps || []).map((s) => (
                                <li key={s}>{s}</li>
                            ))}
                        </ol>

                        <div className="card" style={{ marginTop: 14, padding: 14 }}>
                            <h4>Selected Pairs</h4>
                            <table style={{ marginTop: 8 }}>
                                <thead>
                                    <tr>
                                        <th>Case</th>
                                        <th>Room</th>
                                        <th>Slot Column</th>
                                        <th>Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(hungarian.selected_pairs || []).map((p) => (
                                        <tr key={`${p.case_id}-${p.room_id}-${p.slot_col}`}>
                                            <td>{p.case_id}</td>
                                            <td>{p.room_name}</td>
                                            <td>{p.slot_col}</td>
                                            <td>{p.cost}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <div className="card">
                <h3>GA Evolution Visualization</h3>
                <p style={{ marginTop: 8 }}>Track best, average, and worst fitness across generations.</p>
                <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label>
                        Cases
                        <input type="number" min="20" max="500" value={gaCases} onChange={(e) => setGaCases(Number(e.target.value || 0))} style={{ marginLeft: 8, width: 80 }} />
                    </label>
                    <label>
                        Rooms
                        <input type="number" min="2" max="20" value={gaRooms} onChange={(e) => setGaRooms(Number(e.target.value || 0))} style={{ marginLeft: 8, width: 70 }} />
                    </label>
                    <label>
                        Generations
                        <input type="number" min="5" max="100" value={gaGenerations} onChange={(e) => setGaGenerations(Number(e.target.value || 0))} style={{ marginLeft: 8, width: 70 }} />
                    </label>
                    <label>
                        Population
                        <input type="number" min="8" max="100" value={gaPop} onChange={(e) => setGaPop(Number(e.target.value || 0))} style={{ marginLeft: 8, width: 70 }} />
                    </label>
                    <button className="btn" onClick={runGaEvolution} disabled={loadingGa}>
                        {loadingGa ? 'Running...' : 'Run GA Evolution'}
                    </button>
                </div>

                {gaHistory.length > 0 && (
                    <>
                        <div style={{ marginTop: 14 }}>
                            <ResponsiveContainer width="100%" height={320}>
                                <LineChart data={gaHistory}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="generation" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="best_fitness" stroke="#2e7d32" dot={false} name="Best" />
                                    <Line type="monotone" dataKey="avg_fitness" stroke="#1565c0" dot={false} name="Average" />
                                    <Line type="monotone" dataKey="worst_fitness" stroke="#c62828" dot={false} name="Worst" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        {gaMeta?.finalWeights && (
                            <div style={{ marginTop: 12, background: '#f5f9ff', padding: 12, borderRadius: 8 }}>
                                <strong>Final Weights:</strong>{' '}
                                alpha={gaMeta.finalWeights.alpha}, beta={gaMeta.finalWeights.beta}, gamma={gaMeta.finalWeights.gamma}, delta={gaMeta.finalWeights.delta}, epsilon={gaMeta.finalWeights.epsilon}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="card">
                <h3>Final PDF Report Generator</h3>
                <p style={{ marginTop: 8 }}>
                    Generate a downloadable report based on the currently loaded database cases.
                </p>
                <button className="btn" style={{ marginTop: 12 }} onClick={downloadPdf}>
                    Download PDF Report
                </button>
            </div>
        </div>
    );
}
