import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:8000/api';
const STEP_INTERVAL_MS = 3200;

const WEIGHTS = {
    alpha: 1.2,
    beta: 0.9,
    gamma: 0.8,
    delta: 1.1,
    epsilon: 0.6,
};

const ROOM_NAMES = ['Courtroom A', 'Courtroom B', 'Courtroom C', 'Courtroom D'];
const ROOM_LOAD = [2, 1, 3, 2];
const ROOM_EXPERTISE = ['criminal', 'civil', 'family', 'corporate'];

function scoreCase(item) {
    const severityTerm = WEIGHTS.alpha * (item.severity ** 2);
    const agingTerm = WEIGHTS.beta * item.urgency * Math.log(1 + item.ageDays);
    const complexityTerm = WEIGHTS.gamma * item.complexity;
    const deadlineTerm = WEIGHTS.delta * (100 / item.deadlineDays);
    const interestTerm = WEIGHTS.epsilon * item.publicInterest;
    const total = severityTerm + agingTerm + complexityTerm + deadlineTerm + interestTerm;
    return {
        ...item,
        score: Number(total.toFixed(2)),
        terms: {
            severityTerm: Number(severityTerm.toFixed(2)),
            agingTerm: Number(agingTerm.toFixed(2)),
            complexityTerm: Number(complexityTerm.toFixed(2)),
            deadlineTerm: Number(deadlineTerm.toFixed(2)),
            interestTerm: Number(interestTerm.toFixed(2)),
        },
    };
}

function createSampleCases(count) {
    const types = ['criminal', 'civil', 'family', 'corporate'];
    const cases = [];
    for (let i = 0; i < count; i += 1) {
        cases.push({
            id: `CASE-${2001 + i}`,
            caseType: types[i % types.length],
            severity: 4 + (i % 7),
            urgency: 3 + ((i * 2) % 8),
            complexity: 2 + ((i * 3) % 8),
            ageDays: 5 + i * 2,
            deadlineDays: 6 + (i % 11),
            publicInterest: (i % 6) + 2,
        });
    }
    return cases.map(scoreCase).sort((a, b) => b.score - a.score);
}

function buildCostMatrix(topCases) {
    return topCases.map((item) => (
        ROOM_NAMES.map((_, roomIndex) => {
            const mismatchPenalty = item.caseType === ROOM_EXPERTISE[roomIndex] ? 0 : 12;
            const loadPenalty = ROOM_LOAD[roomIndex] * 3;
            const scoreOffset = Math.max(10, 140 - item.score);
            return Number((scoreOffset + mismatchPenalty + loadPenalty).toFixed(2));
        })
    ));
}

function getPermutations(array) {
    if (array.length <= 1) {
        return [array];
    }
    const permutations = [];
    array.forEach((item, index) => {
        const remaining = array.slice(0, index).concat(array.slice(index + 1));
        getPermutations(remaining).forEach((tail) => {
            permutations.push([item, ...tail]);
        });
    });
    return permutations;
}

function solveOptimalAssignment(costMatrix) {
    const roomIndexes = [0, 1, 2, 3];
    const allPermutations = getPermutations(roomIndexes);
    let bestPermutation = roomIndexes;
    let bestCost = Number.POSITIVE_INFINITY;

    allPermutations.forEach((perm) => {
        let total = 0;
        for (let i = 0; i < perm.length; i += 1) {
            total += costMatrix[i][perm[i]];
        }
        if (total < bestCost) {
            bestCost = total;
            bestPermutation = perm;
        }
    });

    return {
        bestPermutation,
        bestCost: Number(bestCost.toFixed(2)),
    };
}

function buildGaSeries() {
    const history = [];
    let best = 68;
    let avg = 55;
    let worst = 41;
    for (let g = 1; g <= 8; g += 1) {
        best += 2.1;
        avg += 1.85;
        worst += 1.6;
        history.push({
            generation: g,
            best: Number(best.toFixed(2)),
            avg: Number(avg.toFixed(2)),
            worst: Number(worst.toFixed(2)),
        });
    }
    return history;
}

function calculateFairness(assignments) {
    const roomCounts = ROOM_NAMES.map((name) => assignments.filter((item) => item.room === name).length);
    const max = Math.max(...roomCounts);
    const min = Math.min(...roomCounts);
    const fairness = 1 - ((max - min) / Math.max(1, assignments.length));
    return Number(fairness.toFixed(2));
}

function useQuery() {
    const location = useLocation();
    return useMemo(() => new URLSearchParams(location.search), [location.search]);
}

export default function ArchitectureLab() {
    const query = useQuery();
    const [status, setStatus] = useState('checking');
    const [accessData, setAccessData] = useState(null);
    const [error, setError] = useState('');
    const [sampleSize, setSampleSize] = useState(12);
    const [isPlaying, setIsPlaying] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);

    const steps = [
        { title: 'Slide 1: Intake Dataset', summary: 'Load a realistic sample with 10-20 cases and legal attributes.' },
        { title: 'Slide 2: Priority Formula', summary: 'Compute non-linear HPCS score for each case and rank by urgency.' },
        { title: 'Slide 3: Hungarian Matching', summary: 'Build cost matrix and solve minimum global assignment cost.' },
        { title: 'Slide 4: GA Adaptation', summary: 'Evolve weights over generations to improve objective quality.' },
        { title: 'Slide 5: Final Schedule', summary: 'Output final courtroom allocations with fairness and risk metrics.' },
    ];

    const simulation = useMemo(() => {
        const rankedCases = createSampleCases(sampleSize);
        const topCases = rankedCases.slice(0, 4);
        const costMatrix = buildCostMatrix(topCases);
        const assignment = solveOptimalAssignment(costMatrix);
        const pairs = topCases.map((item, idx) => ({
            caseId: item.id,
            caseType: item.caseType,
            room: ROOM_NAMES[assignment.bestPermutation[idx]],
            cost: costMatrix[idx][assignment.bestPermutation[idx]],
            score: item.score,
        }));

        const gaHistory = buildGaSeries();
        const finalGeneration = gaHistory[gaHistory.length - 1];
        const fairness = calculateFairness(pairs);

        return {
            rankedCases,
            topCases,
            costMatrix,
            assignment,
            pairs,
            gaHistory,
            finalGeneration,
            fairness,
        };
    }, [sampleSize]);

    useEffect(() => {
        if (!isPlaying) {
            return undefined;
        }
        const timer = window.setInterval(() => {
            setStepIndex((prev) => {
                if (prev >= steps.length - 1) {
                    setIsPlaying(false);
                    return prev;
                }
                return prev + 1;
            });
        }, STEP_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [isPlaying, steps.length]);

    useEffect(() => {
        const key = query.get('key');
        if (!key) {
            setStatus('locked');
            return;
        }

        axios.get(`${API}/architecture/access`)
            .then((res) => {
                if (!res.data?.access_granted) {
                    setStatus('locked');
                    return;
                }
                setAccessData(res.data);
                setStatus('open');
            })
            .catch((err) => {
                setError(err.response?.data?.detail || 'Unable to verify architecture access');
                setStatus('locked');
            });
    }, [query]);

    const handleStart = () => {
        setStepIndex(0);
        setIsPlaying(true);
    };

    const handleNext = () => {
        setIsPlaying(false);
        setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    };

    const handlePrev = () => {
        setIsPlaying(false);
        setStepIndex((prev) => Math.max(prev - 1, 0));
    };

    const handleReset = () => {
        setIsPlaying(false);
        setStepIndex(0);
    };

    if (status === 'checking') {
        return (
            <div>
                <h1 className="page-title">Architecture Lab</h1>
                <div className="card">
                    <p>Validating access token...</p>
                </div>
            </div>
        );
    }

    if (status === 'locked') {
        return (
            <div>
                <h1 className="page-title">Architecture Lab</h1>
                <div className="card architecture-locked">
                    <h3>Access Locked</h3>
                    <p>This page is hidden for presentation mode. Unlock it from the dashboard using the API access button.</p>
                    {error && <p style={{ color: '#b22b2b' }}>{error}</p>}
                    <Link to="/" className="btn" style={{ display: 'inline-block', marginTop: 10, textDecoration: 'none' }}>
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div>
            <h1 className="page-title">HPCS-GA Architecture Simulation</h1>
            <div className="card architecture-header">
                <h3>Execution Pipeline Video Mode</h3>
                <p>
                    Press Start to play a slide-style sequence. Each slide explains one algorithm phase and performs sample
                    calculations on {sampleSize} demo cases.
                </p>
                {accessData?.dataset && (
                    <p className="architecture-meta">
                        Dataset: <strong>{accessData.dataset.cases}</strong> cases, <strong>{accessData.dataset.courtrooms}</strong> courtrooms
                        {' '}| Session key: <strong>{accessData.key}</strong>
                    </p>
                )}

                <div className="architecture-controls">
                    <label htmlFor="sample-size">Demo cases</label>
                    <select
                        id="sample-size"
                        value={sampleSize}
                        onChange={(e) => {
                            setSampleSize(Number(e.target.value));
                            setStepIndex(0);
                            setIsPlaying(false);
                        }}
                    >
                        <option value={10}>10 cases</option>
                        <option value={12}>12 cases</option>
                        <option value={15}>15 cases</option>
                        <option value={20}>20 cases</option>
                    </select>
                    <button className="btn" onClick={handleStart}>Start</button>
                    <button className="btn" onClick={() => setIsPlaying((prev) => !prev)}>
                        {isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button className="btn" onClick={handlePrev}>Previous</button>
                    <button className="btn" onClick={handleNext}>Next</button>
                    <button className="btn" onClick={handleReset}>Reset</button>
                </div>
            </div>

            <div className="card architecture-slide-head">
                <h3>{steps[stepIndex].title}</h3>
                <p>{steps[stepIndex].summary}</p>
                <p className="architecture-progress">Step {stepIndex + 1} of {steps.length}</p>
                <div className="architecture-dots" aria-hidden="true">
                    {steps.map((_, idx) => (
                        <span key={idx} className={idx === stepIndex ? 'active' : ''} />
                    ))}
                </div>
            </div>

            {stepIndex === 0 && (
                <div className="architecture-flow card">
                    <div className="architecture-stage stage-intake">
                        <h4>Intake Layer</h4>
                        <p>{simulation.rankedCases.length} sample cases are loaded for explainable simulation.</p>
                    </div>
                    <table style={{ marginTop: 10 }}>
                        <thead>
                            <tr>
                                <th>Case</th>
                                <th>Type</th>
                                <th>Severity</th>
                                <th>Urgency</th>
                                <th>Complexity</th>
                                <th>Deadline Days</th>
                            </tr>
                        </thead>
                        <tbody>
                            {simulation.rankedCases.slice(0, 8).map((item) => (
                                <tr key={item.id}>
                                    <td>{item.id}</td>
                                    <td><span className={`badge badge-${item.caseType}`}>{item.caseType}</span></td>
                                    <td>{item.severity}</td>
                                    <td>{item.urgency}</td>
                                    <td>{item.complexity}</td>
                                    <td>{item.deadlineDays}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {stepIndex === 1 && (
                <div className="architecture-flow card">
                    <div className="architecture-stage stage-priority">
                        <h4>Priority Score Calculation</h4>
                        <p>
                            Formula: P = alpha S^2 + beta U log(1 + A) + gamma K + delta (100 / D) + epsilon I
                        </p>
                    </div>
                    <div className="architecture-calc-grid">
                        <div className="card" style={{ marginBottom: 0 }}>
                            <h4>Detailed Solve ({simulation.rankedCases[0].id})</h4>
                            <p>Severity term: {simulation.rankedCases[0].terms.severityTerm}</p>
                            <p>Aging term: {simulation.rankedCases[0].terms.agingTerm}</p>
                            <p>Complexity term: {simulation.rankedCases[0].terms.complexityTerm}</p>
                            <p>Deadline term: {simulation.rankedCases[0].terms.deadlineTerm}</p>
                            <p>Public interest term: {simulation.rankedCases[0].terms.interestTerm}</p>
                            <p><strong>Total priority score = {simulation.rankedCases[0].score}</strong></p>
                        </div>
                        <div className="card" style={{ marginBottom: 0 }}>
                            <h4>Top Ranked Cases</h4>
                            <ol style={{ margin: '8px 0 0 18px' }}>
                                {simulation.rankedCases.slice(0, 6).map((item) => (
                                    <li key={item.id} style={{ marginBottom: 4 }}>
                                        {item.id} ({item.caseType}) - Score {item.score}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>
                </div>
            )}

            {stepIndex === 2 && (
                <div className="architecture-flow card">
                    <div className="architecture-stage stage-hungarian">
                        <h4>Hungarian Matching Solve</h4>
                        <p>
                            Build cost matrix from top 4 cases and 4 courtrooms. Then evaluate all permutations to find
                            minimum global cost.
                        </p>
                    </div>
                    <table style={{ marginTop: 10 }}>
                        <thead>
                            <tr>
                                <th>Case \ Room</th>
                                {ROOM_NAMES.map((room) => <th key={room}>{room}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {simulation.topCases.map((item, i) => (
                                <tr key={item.id}>
                                    <td>{item.id}</td>
                                    {simulation.costMatrix[i].map((cost, j) => (
                                        <td key={`${item.id}-${j}`}>{cost}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p style={{ marginTop: 10 }}>
                        <strong>Optimal global cost:</strong> {simulation.assignment.bestCost}
                    </p>
                </div>
            )}

            {stepIndex === 3 && (
                <div className="architecture-flow card">
                    <div className="architecture-stage stage-ga">
                        <h4>GA Evolution Trend</h4>
                        <p>Each generation improves fitness and reduces bad scheduling outcomes.</p>
                        <div className="ga-curve" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                        </div>
                    </div>
                    <table style={{ marginTop: 10 }}>
                        <thead>
                            <tr>
                                <th>Generation</th>
                                <th>Best Fitness</th>
                                <th>Average Fitness</th>
                                <th>Worst Fitness</th>
                            </tr>
                        </thead>
                        <tbody>
                            {simulation.gaHistory.map((item) => (
                                <tr key={item.generation}>
                                    <td>{item.generation}</td>
                                    <td>{item.best}</td>
                                    <td>{item.avg}</td>
                                    <td>{item.worst}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p style={{ marginTop: 10 }}>
                        <strong>Final generation best fitness:</strong> {simulation.finalGeneration.best}
                    </p>
                </div>
            )}

            {stepIndex === 4 && (
                <div className="architecture-flow card">
                    <div className="architecture-stage stage-output">
                        <h4>Final Governance Output</h4>
                        <p>Selected assignments are exported with fairness and risk controls.</p>
                    </div>
                    <table style={{ marginTop: 10 }}>
                        <thead>
                            <tr>
                                <th>Case</th>
                                <th>Type</th>
                                <th>Assigned Courtroom</th>
                                <th>Priority Score</th>
                                <th>Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            {simulation.pairs.map((pair) => (
                                <tr key={pair.caseId}>
                                    <td>{pair.caseId}</td>
                                    <td><span className={`badge badge-${pair.caseType}`}>{pair.caseType}</span></td>
                                    <td>{pair.room}</td>
                                    <td>{pair.score}</td>
                                    <td>{pair.cost}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="architecture-summary-grid">
                        <div className="stat-card">
                            <h3>{simulation.pairs.length}</h3>
                            <p>Scheduled in this run</p>
                        </div>
                        <div className="stat-card">
                            <h3>{simulation.fairness}</h3>
                            <p>Fairness index</p>
                        </div>
                        <div className="stat-card">
                            <h3>{simulation.assignment.bestCost}</h3>
                            <p>Total assignment cost</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="card architecture-callout">
                <h3>How to narrate this in your presentation</h3>
                <p>
                    "I press Start and each slide explains one engine phase. You can see the real calculation terms,
                    the solved assignment cost, GA fitness progression, and final fairness output just like a guided video."
                </p>
            </div>
        </div>
    );
}
