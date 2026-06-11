import { Link } from 'react-router-dom';
import { usePrograms } from '../hooks/usePrograms';
import ScannerButton from '../components/ScannerButton';

function normalizeUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

export default function DashboardPage() {
  const { data, statusMap, discovered, loading, error, refreshStatus } = usePrograms();

  if (loading) return <div className="center-msg">Carregando...</div>;
  if (error) return <div className="center-msg">Erro ao carregar dados: {error}</div>;
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

  const discoveredList = discovered
    ? Object.entries(discovered)
        .filter(([, v]) => v.status === 'likely_open' || v.status === 'possible')
        .sort((a, b) => (b[1].confidence || 0) - (a[1].confidence || 0))
    : [];

  return (
    <div className="dashboard-page">
      <div className="breadcrumb">
        <Link to="/">Início</Link>
        <span> / </span>
        <span>Editais Abertos</span>
      </div>

      <h2 className="page-title">Editais Abertos</h2>
      <p className="page-subtitle">
        {totalOpen} programas com editais abertos em {openUnis.length} universidades
      </p>

      <ScannerButton onScanComplete={refreshStatus} />

      {openUnis.length === 0 && discoveredList.length === 0 ? (
        <div className="center-msg">
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#128225;</p>
          <p>Nenhum edital aberto encontrado no momento.</p>
          <p className="hint">
            O scanner de editais verifica os sites periodicamente. Volte mais tarde.
          </p>
        </div>
      ) : (
        <>
          {openUnis.length > 0 && (
            <>
              <h3 className="dash-section-title">Editais em Programas Conhecidos</h3>
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
                          <span className="dash-stat-label">Editais</span>
                        </div>
                        <div className="dash-stat">
                          <span className="dash-stat-num">{uni.programCount}</span>
                          <span className="dash-stat-label">Programas</span>
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
            </>
          )}

          {discoveredList.length > 0 && (
            <>
              <h3 className="dash-section-title dash-section-title-discovered">Descobertas pela Web</h3>
              <p className="dash-section-subtitle">
                Oportunidades encontradas pela busca na web que não estão no nosso banco de dados.
              </p>
              <div className="dashboard-list">
                {discoveredList.map(([url, item], idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dashboard-card dash-card-discovered"
                  >
                    <div className="dash-card-top">
                      <div className="dash-card-info">
                        <h3 style={{ fontSize: '0.95rem' }}>{item.title || url}</h3>
                        {item.snippet && (
                          <p className="dash-snippet">{item.snippet.slice(0, 200)}</p>
                        )}
                        <span className="dash-source-tag">Descoberto via Web Search</span>
                      </div>
                      <div className="dash-card-stats">
                        <div className="dash-stat">
                          <span className={`dash-stat-num ${item.status === 'likely_open' ? 'open' : 'maybe'}`}>
                            {item.status === 'likely_open' ? 'Alta' : 'Média'}
                          </span>
                          <span className="dash-stat-label">Confiança</span>
                        </div>
                      </div>
                    </div>
                    {item.dates_found && item.dates_found.length > 0 && (
                      <div className="dash-card-progs">
                        <span className="dash-prog-tag date-tag">
                          Datas: {item.dates_found.slice(0, 3).join(', ')}
                        </span>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
