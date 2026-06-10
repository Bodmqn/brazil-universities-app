import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { tr } from '../utils/translations';
import { usePrograms } from '../hooks/usePrograms';

function normalizeUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

export default function DashboardPage() {
  const { lang } = useLang();
  const { data, statusMap, loading, error } = usePrograms(lang);

  if (loading) return <div className="center-msg">{tr('loading', lang)}</div>;
  if (error) return <div className="center-msg">{tr('error', lang)}: {error}</div>;
  if (!data) return null;

  const openUnis = [];

  for (const region of data) {
    for (const state of region.states) {
      for (const uni of state.universities) {
        const openPrograms = uni.programs.filter(prog => {
          const progUrl = normalizeUrl(prog.url);
          const s = statusMap?.[progUrl];
          return s?.status === 'likely_open';
        });
        if (openPrograms.length > 0) {
          openUnis.push({
            region: region.name,
            state: state.name,
            name: uni.name,
            acronym: uni.acronym,
            programCount: uni.programs.length,
            openCount: openPrograms.length,
            openPrograms,
          });
        }
      }
    }
  }

  openUnis.sort((a, b) => b.openCount - a.openCount);

  const totalOpen = openUnis.reduce((a, u) => a + u.openCount, 0);

  return (
    <div className="dashboard-page">
      <div className="breadcrumb">
        <Link to="/">{tr('home', lang)}</Link>
        <span> / </span>
        <span>{tr('openCalls', lang)}</span>
      </div>

      <h2 className="page-title">{tr('openCalls', lang)}</h2>
      <p className="page-subtitle">
        {totalOpen} {tr('programs', lang)} {lang === 'pt' ? 'com editais abertos em' : 'with open calls at'}{' '}
        {openUnis.length} {tr('universities', lang)}
      </p>

      {openUnis.length === 0 ? (
        <div className="center-msg">
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#128225;</p>
          <p>{lang === 'pt' ? 'Nenhum edital aberto encontrado no momento.' : 'No open calls found at this time.'}</p>
          <p className="hint">
            {lang === 'pt'
              ? 'O scanner de editais verifica os sites periodicamente. Volte mais tarde.'
              : 'The scanner checks websites periodically. Check back later.'}
          </p>
        </div>
      ) : (
        <div className="dashboard-list">
          {openUnis.map((uni, idx) => (
            <Link
              key={(uni.acronym || uni.name) + idx}
              to={`/universidade/${encodeURIComponent(uni.region)}/${encodeURIComponent(uni.acronym || uni.name)}`}
              className="dashboard-card"
            >
              <div className="dash-card-top">
                <div className="dash-card-info">
                  {uni.acronym && <span className="dash-acronym">{uni.acronym}</span>}
                  <h3>{uni.name}</h3>
                  <span className="dash-location">{uni.region} &middot; {uni.state}</span>
                </div>
                <div className="dash-card-stats">
                  <div className="dash-stat">
                    <span className="dash-stat-num open">{uni.openCount}</span>
                    <span className="dash-stat-label">{lang === 'pt' ? 'Editais' : 'Open Calls'}</span>
                  </div>
                  <div className="dash-stat">
                    <span className="dash-stat-num">{uni.programCount}</span>
                    <span className="dash-stat-label">{tr('programs', lang)}</span>
                  </div>
                </div>
              </div>
              <div className="dash-card-progs">
                {uni.openPrograms.slice(0, 4).map((p, i) => (
                  <span key={i} className="dash-prog-tag">{p.program}</span>
                ))}
                {uni.openPrograms.length > 4 && (
                  <span className="dash-prog-tag more">+{uni.openPrograms.length - 4}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
