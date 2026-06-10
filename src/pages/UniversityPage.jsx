import { useParams, Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { tr } from '../utils/translations';
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

export default function UniversityPage() {
  const { regionName, uniKey } = useParams();
  const { lang } = useLang();
  const { data, statusMap, loading, error } = usePrograms(lang);

  if (loading) return <div className="center-msg">{tr('loading', lang)}</div>;
  if (error) return <div className="center-msg">{tr('error', lang)}: {error}</div>;

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

  if (!foundUni) return <div className="center-msg">{tr('noResults', lang)}</div>;

  const levels = [...new Set(foundUni.programs.map(p => p.level))];

  return (
    <div className="university-page">
      <div className="breadcrumb">
        <Link to="/">{tr('home', lang)}</Link>
        <span> / </span>
        <Link to={`/regiao/${encodeURIComponent(foundRegion)}`}>{foundRegion}</Link>
        <span> / </span>
        <span>{foundUni.acronym || foundUni.name}</span>
      </div>

      <div className="uni-header">
        <div className="uni-header-info">
          <h2>{foundUni.name}</h2>
          <p className="uni-meta">
            <strong>{foundUni.acronym}</strong> &middot; {foundState} &middot; {foundRegion}
          </p>
        </div>
        <div className="uni-header-stats">
          <span><strong>{foundUni.programs.length}</strong> {tr('programs', lang)}</span>
          <span><strong>{levels.join(', ')}</strong></span>
        </div>
      </div>

      <div className="programs-table-wrap">
        <table className="programs-table">
          <thead>
            <tr>
              <th>{tr('level', lang)}</th>
              <th>{tr('programs', lang)}</th>
              <th>{tr('city', lang)}</th>
              <th>{tr('campus', lang)}</th>
              <th>{tr('startDate', lang)}</th>
              <th>{tr('duration', lang)}</th>
              <th>{tr('languageReq', lang)}</th>
              <th>{tr('openCalls', lang)}</th>
              <th>{tr('website', lang)}</th>
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
                  <td>{prog.duration} {tr('months', lang)}</td>
                  <td className="lang-cell">{prog.languageRequirement}</td>
                  <td>{statusBadge(s?.status, lang)}</td>
                  <td>
                    {prog.url && (
                      <a href={normalizeUrl(prog.url)}
                        target="_blank" rel="noopener noreferrer" className="web-link">
                        {tr('checkWebsite', lang)}
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
