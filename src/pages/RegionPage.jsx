import { useParams, Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { tr } from '../utils/translations';
import { usePrograms, getRegionByName } from '../hooks/usePrograms';

export default function RegionPage() {
  const { regionName } = useParams();
  const { lang } = useLang();
  const { data, loading, error } = usePrograms(lang);

  if (loading) return <div className="center-msg">{tr('loading', lang)}</div>;
  if (error) return <div className="center-msg">{tr('error', lang)}: {error}</div>;

  const region = getRegionByName(data, regionName);
  if (!region) return <div className="center-msg">Region not found</div>;

  return (
    <div className="region-page">
      <div className="breadcrumb">
        <Link to="/">{tr('home', lang)}</Link>
        <span> / </span>
        <span>{region.name}</span>
      </div>

      <h2 className="page-title">{region.name}</h2>
      <p className="page-subtitle">
        {region.states.length} {tr('states', lang)} &middot;{' '}
        {region.states.reduce((a, s) => a + s.universities.length, 0)} {tr('universities', lang)}
      </p>

      <div className="state-list">
        {region.states.map(state => {
          const uniCount = state.universities.length;
          return (
            <div key={state.name} className="state-section">
              <h3 className="state-name">{state.name}</h3>
              <p className="state-meta">{uniCount} {tr('universities', lang)}</p>
              <div className="uni-list">
                {state.universities.map(uni => (
                  <Link
                    key={uni.acronym}
                    to={`/universidade/${encodeURIComponent(region.name)}/${encodeURIComponent(uni.acronym || uni.name)}`}
                    className="uni-card"
                  >
                    <div className="uni-card-header">
                      <span className="uni-acronym">{uni.acronym}</span>
                      <span className="uni-prog-count">{uni.programs.length} {tr('programs', lang)}</span>
                    </div>
                    <p className="uni-name">{uni.name}</p>
                    <div className="uni-card-footer">
                      <span>{[...new Set(uni.programs.map(p => p.level))].join(', ')}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
