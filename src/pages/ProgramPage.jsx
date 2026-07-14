import { useParams, Link } from 'react-router-dom';
import { regionName } from '../utils/regionName';
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

export default function ProgramPage() {
  const { regionName: regionSlug, uniKey, programIdx } = useParams();
  const { data, statusMap, loading, error } = usePrograms();

  if (loading) return <div className="center-msg">Carregando...</div>;
  if (error) return <div className="center-msg">Erro ao carregar dados: {error}</div>;

  let foundProg = null;
  let foundUni = null;
  let foundState = '';
  let foundRegion = '';
  for (const region of data || []) {
    if (region.name.toLowerCase() !== decodeURIComponent(regionSlug).toLowerCase()) continue;
    for (const state of region.states) {
      for (const uni of state.universities) {
        const key = uni.acronym || uni.name;
        if (!key.toLowerCase().includes(decodeURIComponent(uniKey).toLowerCase())) continue;
        const idx = parseInt(programIdx, 10);
        if (!isNaN(idx) && uni.programs[idx]) {
          foundProg = uni.programs[idx];
          foundUni = uni;
          foundState = state.name;
          foundRegion = region.name;
          break;
        }
      }
      if (foundProg) break;
    }
    if (foundProg) break;
  }

  if (!foundProg) return <div className="center-msg">Nenhum resultado encontrado</div>;

  const currentIdx = parseInt(programIdx, 10);
  const totalProgs = foundUni.programs.length;
  const prevIdx = currentIdx > 0 ? currentIdx - 1 : null;
  const nextIdx = currentIdx < totalProgs - 1 ? currentIdx + 1 : null;

  const s = getStatus(foundProg.url, statusMap);

  return (
    <div className="program-page">
      <div className="breadcrumb">
        <Link to="/">Início</Link>
        <span> / </span>
        <Link to={`/regiao/${encodeURIComponent(foundRegion)}`}>{regionName(foundRegion)}</Link>
        <span> / </span>
        <Link to={`/universidade/${encodeURIComponent(foundRegion)}/${encodeURIComponent(foundUni.acronym || foundUni.name)}`}>
          {foundUni.acronym || foundUni.name}
        </Link>
        <span> / </span>
        <span>{foundProg.program}</span>
      </div>

      <div className="prog-header">
        <div className="prog-header-info">
          <h2>{foundProg.program}</h2>
          <p className="prog-meta">
            <span className="badge">{foundProg.level}</span>
            <span className="prog-meta-sep">&middot;</span>
            {foundUni.name} <strong translate="no">({foundUni.acronym})</strong>
            <span className="prog-meta-sep">&middot;</span>
            {foundState}
            <span className="prog-meta-sep">&middot;</span>
            {regionName(foundRegion)}
          </p>
        </div>
        <div className="prog-header-stats">
          {statusBadge(s?.status)}
        </div>
      </div>

      <div className="prog-details">
        <div className="prog-detail-row">
          <span className="prog-detail-label">Universidade</span>
          <span className="prog-detail-value">
            <Link to={`/universidade/${encodeURIComponent(foundRegion)}/${encodeURIComponent(foundUni.acronym || foundUni.name)}`}
              className="web-link">
              {foundUni.name} <strong translate="no">({foundUni.acronym})</strong>
            </Link>
          </span>
        </div>
        <div className="prog-detail-row">
          <span className="prog-detail-label">Nível</span>
          <span className="prog-detail-value"><span className="badge">{foundProg.level}</span></span>
        </div>
        <div className="prog-detail-row">
          <span className="prog-detail-label">Cidade</span>
          <span className="prog-detail-value">{foundProg.city}</span>
        </div>
        <div className="prog-detail-row">
          <span className="prog-detail-label">Campus</span>
          <span className="prog-detail-value">{foundProg.campus}</span>
        </div>
        <div className="prog-detail-row">
          <span className="prog-detail-label">Início</span>
          <span className="prog-detail-value">{foundProg.startDate}</span>
        </div>
        <div className="prog-detail-row">
          <span className="prog-detail-label">Duração</span>
          <span className="prog-detail-value">{foundProg.duration} meses</span>
        </div>
        <div className="prog-detail-row">
          <span className="prog-detail-label">Requisito de Idioma</span>
          <span className="prog-detail-value lang-cell">{foundProg.languageRequirement}</span>
        </div>
        <div className="prog-detail-row">
          <span className="prog-detail-label">Site</span>
          <span className="prog-detail-value">
            {foundProg.url && (
              <a href={normalizeUrl(foundProg.url)} target="_blank" rel="noopener noreferrer" className="web-link">
                Acessar Site
              </a>
            )}
          </span>
        </div>
      </div>

      <div className="pagination">
        {prevIdx !== null ? (
          <Link
            to={`/programa/${encodeURIComponent(foundRegion)}/${encodeURIComponent(foundUni.acronym || foundUni.name)}/${prevIdx}`}
            className="pagination-btn"
          >
            &laquo; Anterior
          </Link>
        ) : (
          <span className="pagination-btn pagination-btn-disabled">&laquo; Anterior</span>
        )}
        <Link
          to={`/universidade/${encodeURIComponent(foundRegion)}/${encodeURIComponent(foundUni.acronym || foundUni.name)}`}
          className="pagination-back"
        >
          Voltar para {foundUni.acronym || foundUni.name}
        </Link>
        {nextIdx !== null ? (
          <Link
            to={`/programa/${encodeURIComponent(foundRegion)}/${encodeURIComponent(foundUni.acronym || foundUni.name)}/${nextIdx}`}
            className="pagination-btn"
          >
            Pr&oacute;ximo &raquo;
          </Link>
        ) : (
          <span className="pagination-btn pagination-btn-disabled">Pr&oacute;ximo &raquo;</span>
        )}
      </div>
    </div>
  );
}
