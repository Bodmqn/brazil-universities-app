import { useParams, Link } from 'react-router-dom';
import { usePrograms } from '../hooks/usePrograms';

function normalizeUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

function getStatus(url, statusMap) {
  const norm = normalizeUrl(url);
  return statusMap?.[norm] || null;
}

function statusBadge(status) {
  if (!status || status === 'unknown') return null;
  const labels = { likely_open: 'Edital Aberto', possible: 'Possível Edital', error: 'Erro' };
  const colors = { likely_open: 'status-open', possible: 'status-maybe', error: 'status-error' };
  return (
    <span className={`status-badge ${colors[status] || ''}`}>
      {labels[status] || status}
    </span>
  );
}

export default function UniversityPage() {
  const { regionName, uniKey } = useParams();
  const { data, statusMap, loading, error } = usePrograms();

  if (loading) return <div className="center-msg">Carregando...</div>;
  if (error) return <div className="center-msg">Erro ao carregar dados: {error}</div>;

  let foundUni = null;
  let foundState = '';
  let foundRegion = '';
  for (const region of data || []) {
    if (region.name.toLowerCase() !== decodeURIComponent(regionName).toLowerCase()) continue;
    for (const state of region.states) {
      for (const uni of state.universities) {
        const key = uni.acronym || uni.name;
        if (key.toLowerCase().includes(decodeURIComponent(uniKey).toLowerCase())) {
          foundUni = uni;
          foundState = state.name;
          foundRegion = region.name;
          break;
        }
      }
      if (foundUni) break;
    }
    if (foundUni) break;
  }

  if (!foundUni) return <div className="center-msg">Nenhum resultado encontrado</div>;

  const levels = [...new Set(foundUni.programs.map(p => p.level))];

  return (
    <div className="university-page">
      <div className="breadcrumb">
        <Link to="/">Início</Link>
        <span> / </span>
        <Link to={`/regiao/${encodeURIComponent(foundRegion)}`}>{foundRegion}</Link>
        <span> / </span>
        <span translate="no">{foundUni.acronym || foundUni.name}</span>
      </div>

      <div className="uni-header">
        <div className="uni-header-info">
          <h2>{foundUni.name}</h2>
          <p className="uni-meta">
            <strong translate="no">{foundUni.acronym}</strong> &middot; {foundState} &middot; {foundRegion}
          </p>
        </div>
        <div className="uni-header-stats">
          <span><strong>{foundUni.programs.length}</strong> Programas</span>
          <span><strong>{levels.join(', ')}</strong></span>
        </div>
      </div>

      <div className="programs-table-wrap">
        <table className="programs-table">
          <thead>
            <tr>
              <th>Nível</th>
              <th>Programa</th>
              <th>Cidade</th>
              <th>Campus</th>
              <th>Início</th>
              <th>Duração</th>
              <th>Requisito de Idioma</th>
              <th>Editais Abertos</th>
              <th>Site</th>
            </tr>
          </thead>
          <tbody>
            {foundUni.programs.map((prog, idx) => {
              const s = getStatus(prog.url, statusMap);
              return (
                <tr key={idx}>
                  <td><span className="badge">{prog.level}</span></td>
                  <td className="prog-name">{prog.program}</td>
                  <td>{prog.city}</td>
                  <td>{prog.campus}</td>
                  <td>{prog.startDate}</td>
                  <td>{prog.duration} meses</td>
                  <td className="lang-cell">{prog.languageRequirement}</td>
                  <td>{statusBadge(s?.status)}</td>
                  <td>
                    {prog.url && (
                      <a href={normalizeUrl(prog.url)}
                        target="_blank" rel="noopener noreferrer" className="web-link">
                        Site
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
