import { useState } from 'react';
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

const PROGRAMS_PER_PAGE = 20;

export default function UniversityPage() {
  const { regionName: regionSlug, uniKey } = useParams();
  const { data, statusMap, loading, error } = usePrograms();
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [page, setPage] = useState(0);

  if (loading) return <div className="center-msg">Carregando...</div>;
  if (error) return <div className="center-msg">Erro ao carregar dados: {error}</div>;

  let foundUni = null;
  let foundState = '';
  let foundRegion = '';
  for (const region of data || []) {
    if (region.name.toLowerCase() !== decodeURIComponent(regionSlug).toLowerCase()) continue;
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

  const totalPages = Math.ceil(foundUni.programs.length / PROGRAMS_PER_PAGE);
  const paginatedProgs = foundUni.programs.slice(page * PROGRAMS_PER_PAGE, (page + 1) * PROGRAMS_PER_PAGE);

  const levels = [...new Set(foundUni.programs.map(p => p.level))];
  const hasRanking = foundUni.qsRanking || foundUni.theRanking;
  const hasMoreInfo = foundUni.category || foundUni.mastersCount != null || foundUni.phdCount != null
    || foundUni.englishProgrammes || foundUni.graduatePageUrl
    || foundUni.intOfficeEmail || foundUni.intOfficePhone || foundUni.intOfficeUrl;

  return (
    <div className="university-page">
      <div className="breadcrumb">
        <Link to="/">In&#237;cio</Link>
        <span> / </span>
        <Link to={`/regiao/${encodeURIComponent(foundRegion)}`}>{regionName(foundRegion)}</Link>
        <span> / </span>
        <span translate="no">{foundUni.acronym || foundUni.name}</span>
      </div>

      <div className="uni-header">
        <div className="uni-header-info">
          <h2>{foundUni.name}</h2>
          <p className="uni-meta">
            <strong translate="no">{foundUni.acronym}</strong> &middot; {foundState} &middot; {regionName(foundRegion)}
          </p>
        </div>
        <div className="uni-header-stats">
          <span><strong>{foundUni.programs.length}</strong> Programas</span>
          <span><strong>{levels.join(', ')}</strong></span>
        </div>
      </div>

      {hasRanking && (
        <div className="uni-rankings">
          {foundUni.qsRanking && <span className="ranking-badge qs">QS: {foundUni.qsRanking}</span>}
          {foundUni.theRanking && <span className="ranking-badge the">THE: {foundUni.theRanking}</span>}
        </div>
      )}

      {foundUni.sigaaUrl && (
        <div className="sigaa-info">
          <span className={`sigaa-status ${foundUni.sigaaStatus === 'Working' ? 'sigaa-working' : 'sigaa-not-found'}`}>
            {foundUni.sigaaStatus === 'Working' ? '✓ SIGAA Funcionando' : '✗ SIGAA Não Encontrado'}
          </span>
          <a href={foundUni.sigaaUrl} target="_blank" rel="noopener noreferrer" className="web-link">
            Acessar SIGAA
          </a>
          {foundUni.sigaaNotes && <span className="sigaa-notes">{foundUni.sigaaNotes}</span>}
        </div>
      )}

      {hasMoreInfo && (
        <div className="uni-more-info">
          <button
            className="uni-more-toggle"
            onClick={() => setShowMoreInfo(v => !v)}
          >
            {showMoreInfo ? 'Ocultar Informações ▲' : 'Mais Informações ▼'}
          </button>
          {showMoreInfo && (
            <div className="uni-more-details">
              {foundUni.category && (
                <div className="uni-detail-row">
                  <span className="uni-detail-label">Tipo</span>
                  <span className="uni-detail-value">{foundUni.category}</span>
                </div>
              )}
              {foundUni.mastersCount != null && (
                <div className="uni-detail-row">
                  <span className="uni-detail-label">Programas de Mestrado</span>
                  <span className="uni-detail-value">{foundUni.mastersCount}</span>
                </div>
              )}
              {foundUni.phdCount != null && (
                <div className="uni-detail-row">
                  <span className="uni-detail-label">Programas de Doutorado</span>
                  <span className="uni-detail-value">{foundUni.phdCount}</span>
                </div>
              )}
              {foundUni.englishProgrammes && (
                <div className="uni-detail-row">
                  <span className="uni-detail-label">Programas em Inglês</span>
                  <span className="uni-detail-value">{foundUni.englishProgrammes}</span>
                </div>
              )}
              {foundUni.graduatePageUrl && (
                <div className="uni-detail-row">
                  <span className="uni-detail-label">Página de Pós-Graduação</span>
                  <span className="uni-detail-value">
                    <a href={foundUni.graduatePageUrl} target="_blank" rel="noopener noreferrer" className="web-link">
                      Acessar
                    </a>
                  </span>
                </div>
              )}
              {foundUni.website && (
                <div className="uni-detail-row">
                  <span className="uni-detail-label">Site Oficial</span>
                  <span className="uni-detail-value">
                    <a href={foundUni.website} target="_blank" rel="noopener noreferrer" className="web-link">
                      Acessar
                    </a>
                  </span>
                </div>
              )}
              {(foundUni.intOfficeEmail || foundUni.intOfficePhone || foundUni.intOfficeUrl) && (
                <div className="uni-detail-row">
                  <span className="uni-detail-label">Escritório Internacional</span>
                  <span className="uni-detail-value uni-int-office">
                    {foundUni.intOfficeUrl && (
                      <a href={foundUni.intOfficeUrl} target="_blank" rel="noopener noreferrer" className="web-link">
                        Site
                      </a>
                    )}
                    {foundUni.intOfficeEmail && <span>{foundUni.intOfficeEmail}</span>}
                    {foundUni.intOfficePhone && <span>{foundUni.intOfficePhone}</span>}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="programs-table-wrap">
        <table className="programs-table">
          <thead>
            <tr>
              <th>N&#237;vel</th>
              <th>Programa</th>
              <th>Cidade</th>
              <th>Campus</th>
              <th>In&#237;cio</th>
              <th>Duração</th>
              <th>Requisito de Idioma</th>
              <th>Editais Abertos</th>
              <th>Site</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProgs.map((prog, idx) => {
              const realIdx = page * PROGRAMS_PER_PAGE + idx;
              const s = getStatus(prog.url, statusMap);
              return (
                <tr key={realIdx}>
                  <td><span className="badge">{prog.level}</span></td>
                  <td className="prog-name">
                    <Link
                      to={`/programa/${encodeURIComponent(foundRegion)}/${encodeURIComponent(foundUni.acronym || foundUni.name)}/${realIdx}`}
                      className="prog-link"
                    >
                      {prog.program}
                    </Link>
                  </td>
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
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              &laquo; Anterior
            </button>
            <span className="pagination-info">
              P&aacute;gina {page + 1} de {totalPages}
            </span>
            <button
              className="pagination-btn"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            >
              Pr&oacute;ximo &raquo;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
