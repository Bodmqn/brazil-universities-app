import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import UniversityList from './pages/UniversityList'
import UniversityDetail from './pages/UniversityDetail'
import CallsPage from './pages/CallsPage'
import ProgramList from './pages/ProgramList'
import ProgramDetail from './pages/ProgramDetail'
import { api } from './services/api'

function NavLink({ to, children }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-green-600 text-white'
          : 'text-gray-600 hover:text-green-700 hover:bg-green-50'
      }`}
    >
      {children}
    </Link>
  );
}

function App() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">BR</span>
                </div>
                <span className="font-bold text-lg text-gray-900">UniScanner</span>
              </Link>
            </div>
            <nav className="flex items-center gap-1">
              <NavLink to="/">Dashboard</NavLink>
              <NavLink to="/universities">Universities</NavLink>
              <NavLink to="/programs">Programs</NavLink>
              <NavLink to="/calls">Calls</NavLink>
              {stats && (
                <span className="ml-4 px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                  {stats.total_universities} uni
                </span>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/universities" element={<UniversityList />} />
          <Route path="/universities/:id" element={<UniversityDetail />} />
          <Route path="/programs" element={<ProgramList />} />
          <Route path="/programs/:id" element={<ProgramDetail />} />
          <Route path="/calls" element={<CallsPage />} />
        </Routes>
      </main>

      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          Brazilian Public Universities Application Scanner — Data sourced from MEC, QS, THE, and university websites
        </div>
      </footer>
    </div>
  );
}

export default App
