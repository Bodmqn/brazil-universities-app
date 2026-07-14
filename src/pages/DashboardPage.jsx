import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePrograms } from '../hooks/usePrograms';
import { regionName } from '../utils/regionName';
import ScannerButton from '../components/ScannerButton';

const YEARS = ['2025', '2026', '2027', '2028'];

function normalizeUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

function matchesYear(text, year) {
  if (!text) return false;
  return text.includes(year);
}

function formatLastRun(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage() {
  const [scanYear, setScanYear] = useState('2026');
  const { data, statusMap, discovered, loading, error, refreshStatus } = usePrograms();

  const scanStats = useMemo(() => {
    if (!statusMap) return null;
    const counts = { likely_open: 0, possible: 0, error: 0, unknown: 0 };
    for (const entry of Object.values(statusMap)) {
      const s = entry?.status || 'unknown';
      if (counts[s] !== undefined) counts[s]++;
      else counts.unknown++;
    }
    return counts;
  }, [statusMap]);

  const totalScanned = scanStats ? scanStats.likely_open + scanStats.possible + scanStats.error + scanStats.unknown : 0;

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
        .filter(([, v]) => matchesYear(v.title, scanYear) || matchesYear(v.snippet, scanYear))
        .sort((a, b) => (b[1].confidence || 0) - (a[1].confidence || 0))
    : [];

  return (
    <div className="dashboard-page">
      <div className="breadcrumb">
        <Link to="/">In&#237;cio</Link>
        <span> / </span>
        <span>Editais Abertos</span>
      </div>

      <h2 className="page-title">Editais Abertos</h2>
      <p className="page-subtitle">
        {totalOpen} programas com editais abertos em {openUnis.length} universidades
      </p>

      {scanStats && (
        <div className="scan-status-overview">
          <div className="scan-status-header">
            <h3>Status do Scanner</h3>
            {statusMap?.last_run && (
              <span className="scan-last-run-label">
                &#128337; &#218;ltima verifica&#231;&#227;o: {formatLastRun(statusMap.last_run)}
              </span>
            )}
          </div>
          <div className="scan-status-bar">
            <div className="scan-bar-segment scan-bar-open" style={{ flex: scanStats.likely_open }}>
              <span>{scanStats.likely_open}</span>
              <label>Abertos</label>
            </div>
            <div className="scan-bar-segment scan-bar-possible" style={{ flex: scanStats.possible }}>
              <span>{scanStats.possible}</span>
              <label>Poss&#237;veis</label>
            </div>
            <div className="scan-bar-segment scan-bar-error" style={{ flex: scanStats.error }}>
              <span>{scanStats.error}</span>
              <label>Erros</label>
            </div>
            <div className="scan-bar-segment scan-bar-unknown" style={{ flex: scanStats.unknown }}>
              <span>{scanStats.unknown}</span>
              <label>Desconhecidos</label>
            </div>
          </div>
          <p className="scan-status-total">{totalScanned} URLs verificadas</p>
          {scanStats.unknown > 0 && (
            <p className="scan-status-note">
              Programas &quot;Desconhecidos&quot; s&#227;o p&#225;ginas que n&#227;o continham palavras-chave detect&#225;veis.
              Muitos s&#227;o sites que dependem de JavaScript (SPAs) ou p&#225;ginas vazias.
              O scanner tenta novamente com URLs limpas, mas alguns podem precisar de verifica&#231;&#227;o manual.
            </p>
          )}
        </div>
      )}

      <div className="scanner-toolbar">
        <div className="scanner-year-filter">
          <label>Ano:</label>
          <select value={scanYear} onChange={e => setScanYear(e.target.value)}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <ScannerButton year={scanYear} onScanComplete={refreshStatus} />
      </div>

      {openUnis.length === 0 && discoveredList.length === 0 ? (
        <div className="center-msg">
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#128225;</p>
          <p>Nenhum edital aberto encontrado no momento.</p>
          <p className="hint">
            Execute o scanner acima para verificar os sites dos programas.
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
                        {uni.acronym && <span className="dash-acronym" translate="no">{uni.acronym}</span>}
                        <h3>{uni.name}</h3>
                        <span className="dash-location">{regionName(uni.region)} &middot; {uni.state}</span>
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
                Oportunidades encontradas pela busca na web que n&#227;o est&#227;o no nosso banco de dados.
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
                            {item.status === 'likely_open' ? 'Alta' : 'M&#233;dia'}
                          </span>
                          <span className="dash-stat-label">Confian&#231;a</span>
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
