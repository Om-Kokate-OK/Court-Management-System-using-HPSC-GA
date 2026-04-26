import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './Pages/Dashboard';
import Cases from './Pages/cases';
import Courtrooms from './Pages/CourtRoom';
import Schedule from './Pages/Schedule';
import Benchmark from './Pages/Benchmarke';
import Comparison from './Pages/Comparison';
import AlgorithmStudio from './Pages/AlgorithmStudio';
import ArchitectureLab from './Pages/ArchitectureLab';
import LiveSimulation from './Pages/LiveSimulation';
import { Scale, FileText, Building2, Calendar, BarChart3, Trophy, Activity, PlayCircle } from 'lucide-react';
import './App.css';

function App() {
  const navItems = [
    { to: '/', icon: BarChart3, label: 'Dashboard' },
    { to: '/cases', icon: FileText, label: 'Cases' },
    { to: '/courtrooms', icon: Building2, label: 'Courtrooms' },
    { to: '/schedule', icon: Calendar, label: 'Smart Schedule' },
    { to: '/benchmark', icon: BarChart3, label: 'Benchmark' },
    { to: '/comparison', icon: Trophy, label: 'Algo Comparison' },
    { to: '/studio', icon: Activity, label: 'Algorithm Studio' },
    { to: '/simulation', icon: PlayCircle, label: 'Live Simulation' },
  ];

  return (
    <BrowserRouter>
      <div className="app">
        <aside className="sidebar">
          <div className="logo card-glow">
            <Scale size={32} />
            <h2>JusticeFlow</h2>
            <p>Court Management System</p>
          </div>
          <nav>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <Icon size={18} /> {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="sidebar-footer">
            <p>Adaptive scheduling for faster and fairer hearings.</p>
          </div>
        </aside>
        <main className="content">
          <div className="content-backdrop" aria-hidden="true" />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cases" element={<Cases />} />
            <Route path="/courtrooms" element={<Courtrooms />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/benchmark" element={<Benchmark />} />
            <Route path="/comparison" element={<Comparison />} />
            <Route path="/studio" element={<AlgorithmStudio />} />
            <Route path="/simulation" element={<LiveSimulation />} />
            <Route path="/architecture-lab" element={<ArchitectureLab />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
export default App;