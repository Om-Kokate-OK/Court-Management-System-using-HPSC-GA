import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './Pages/Dashboard';
import Cases from './Pages/cases';
import Courtrooms from './Pages/CourtRoom';
import Schedule from './Pages/Schedule';
import Benchmark from './Pages/Benchmarke';
import Comparison from './Pages/Comparison';
import { Scale, FileText, Building2, Calendar, BarChart3, Trophy } from 'lucide-react';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <aside className="sidebar">
          <div className="logo">
            <Scale size={32} />
            <h2>JusticeFlow</h2>
            <p>Court Management System</p>
          </div>
          <nav>
            <Link to="/"><BarChart3 size={18} /> Dashboard</Link>
            <Link to="/cases"><FileText size={18} /> Cases</Link>
            <Link to="/courtrooms"><Building2 size={18} /> Courtrooms</Link>
            <Link to="/schedule"><Calendar size={18} /> Smart Schedule</Link>
            <Link to="/benchmark"><BarChart3 size={18} /> Benchmark</Link>
            <Link to="/comparison"><Trophy size={18} /> Algo Comparison</Link>
          </nav>
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cases" element={<Cases />} />
            <Route path="/courtrooms" element={<Courtrooms />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/benchmark" element={<Benchmark />} />
            <Route path="/comparison" element={<Comparison />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
export default App;