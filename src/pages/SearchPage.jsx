import { useSearchParams, Link } from 'react-router-dom';
import { usePrograms, findPrograms } from '../hooks/usePrograms';

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

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { data, statusMap, loading, error } = usePrograms();

  if (loading) return <div className="center-msg">Carregando...</div>;
  if (error) return <div className="center-msg">Erro ao carregar dados: {error}</div>;

  const results = findPrograms(data, query);

  return (
    <div className="search-page">
      <div className="breadcrumb">
        <Link to="/">Início</Link>
        <span> / </span>
        <span>Resultados da Pesquisa</span>
      </div>

      <h2 className="page-title">Resultados da Pesquisa</h2>
      <p className="page-subtitle">"{query}" &mdash; {results.length} Programas</p>

      {results.length === 0 ? (
        <div className="center-msg">
          <p>Nenhum resultado encontrado.</p>
          <p className="hint">Tente ajustar sua pesquisa ou filtros.</p>
        </div>
      ) : (
        <div className="search-results">
          {results.map((r, idx) => {
            const progUrl = r.program.url ? (
              r.program.url.startsWith('http') ? r.program.url : `https://${r.program.url}`
            ) : '';
            const s = statusMap?.[progUrl] || null;
            return (
              <div key={idx} className="search-card">
                <div className="search-card-header">
                  <Link
                    to={`/universidade/${encodeURIComponent(r.region)}/${encodeURIComponent(r.university.acronym || r.university.name)}`}
                    className="search-uni-link"
                  >
                    <strong>{r.university.acronym}</strong> — {r.university.name}
                  </Link>
                  <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {statusBadge(s?.status)}
                    <span className="badge">{r.program.level}</span>
                  </span>
                </div>
                <p className="search-program">{r.program.program}</p>
                <div className="search-card-meta">
                  <span>{r.region} &middot; {r.state} &middot; {r.program.city}</span>
                  <span>Início: {r.program.startDate}</span>
                  {progUrl && (
                    <a href={progUrl} target="_blank" rel="noopener noreferrer" className="web-link">
                      Site
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
