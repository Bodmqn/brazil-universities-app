import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import SearchBar from './SearchBar';

function getInitialTheme() {
  try { return localStorage.getItem('theme') || 'light'; } catch { return 'light'; }
}

export default function Layout() {
  const [theme, setTheme] = useState(getInitialTheme);
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo">
            <img src="/logo.png" alt="Kehra W" className="logo-img" />
            <div>
              <h1>Universidades Brasileiras</h1>
              <p className="subtitle">Programas de P\u00f3s-Gradua\u00e7\u00e3o (Mestrado e Doutorado)</p>
            </div>
          </Link>
          <div className="header-right">
            <Link to="/todos-programas" className="nav-link nav-link-dash">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              Tabela Completa
            </Link>
            <Link to="/calendario" className="nav-link nav-link-dash">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Calend\u00e1rio
            </Link>
            <Link to="/filtro" className="nav-link nav-link-dash">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46" />
              </svg>
              Filtro
            </Link>
            <Link to="/email" className="nav-link nav-link-dash">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22,4 L12,13 L2,4" />
              </svg>
              Email
            </Link>
            <Link to="/editais" className="nav-link nav-link-dash">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
              Editais Abertos
            </Link>
            <button onClick={toggleTheme} className="theme-btn" aria-label="Toggle theme">
              {theme === 'light' ? '\u{1F319}' : '\u{2600}\u{FE0F}'}
            </button>
          </div>
        </div>
        {!isHome && (
          <div className="header-bottom">
            <SearchBar />
          </div>
        )}
      </header>

      {isHome && (
        <div className="hero-search">
          <SearchBar />
        </div>
      )}

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <p>Dados atualizados para 2026-2027</p>
        <p style={{ fontSize: '0.78rem', opacity: 0.7, marginTop: '0.3rem' }}>
          Design by - The Kehra Corporation.
        </p>
      </footer>
    </div>
  );
}
