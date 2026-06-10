import { useSearchParams, Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { tr } from '../utils/translations';
import { usePrograms, findPrograms } from '../hooks/usePrograms';

function statusBadge(status, lang) {
  if (!status || status === 'unknown') return null;
  const labels = {
    pt: { likely_open: 'Edital Aberto', possible: 'Possível Edital', error: 'Erro' },
    en: { likely_open: 'Open Call', possible: 'Possible Call', error: 'Error' }
  };
  const colors = { likely_open: 'status-open', possible: 'status-maybe', error: 'status-error' };
  const l = labels[lang] || labels.en;
  return (
    <span className={`status-badge ${colors[status] || ''}`}>
      {l[status] || status}
    </span>
  );
}

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { lang } = useLang();
  const { data, statusMap, loading, error } = usePrograms(lang);

  if (loading) return <div className="center-msg">{tr('loading', lang)}</div>;
  if (error) return <div className="center-msg">{tr('error', lang)}: {error}</div>;

  const results = findPrograms(data, query);

  return (
    <div className="search-page">
      <div className="breadcrumb">
        <Link to="/">{tr('home', lang)}</Link>
        <span> / </span>
        <span>{tr('searchPage', lang)}</span>
      </div>

      <h2 className="page-title">{tr('searchPage', lang)}</h2>
      <p className="page-subtitle">"{query}" &mdash; {results.length} {tr('programs', lang)}</p>

      {results.length === 0 ? (
        <div className="center-msg">
          <p>{tr('noResults', lang)}</p>
          <p className="hint">{tr('noResultsHint', lang)}</p>
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
                    {statusBadge(s?.status, lang)}
                    <span className="badge">{r.program.level}</span>
                  </span>
                </div>
                <p className="search-program">{r.program.program}</p>
                <div className="search-card-meta">
                  <span>{r.region} &middot; {r.state} &middot; {r.program.city}</span>
                  <span>{tr('startDate', lang)}: {r.program.startDate}</span>
                  {progUrl && (
                    <a href={progUrl} target="_blank" rel="noopener noreferrer" className="web-link">
                      {tr('website', lang)}
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
