import { useParams, Link } from 'react-router-dom';
import { regionName } from '../utils/regionName';
import { usePrograms, getRegionByName } from '../hooks/usePrograms';

export default function RegionPage() {
  const { regionName } = useParams();
  const { data, loading, error } = usePrograms();

  if (loading) return <div className="center-msg">Carregando...</div>;
  if (error) return <div className="center-msg">Erro ao carregar dados: {error}</div>;

  const region = getRegionByName(data, regionName);
  if (!region) return <div className="center-msg">Região não encontrada</div>;

  return (
    <div className="region-page">
      <div className="breadcrumb">
        <Link to="/">Início</Link>
        <span> / </span>
        <span>{regionName(region.name)}</span>
      </div>

      <h2 className="page-title">{regionName(region.name)}</h2>
      <p className="page-subtitle">
        {region.states.length} Estados &middot;{' '}
        {region.states.reduce((a, s) => a + s.universities.length, 0)} Universidades
      </p>

      <div className="state-list">
        {region.states.map(state => {
          const uniCount = state.universities.length;
          return (
            <div key={state.name} className="state-section">
              <h3 className="state-name">{state.name}</h3>
              <p className="state-meta">{uniCount} Universidades</p>
              <div className="uni-list">
                {state.universities.map(uni => (
                  <Link
                    key={uni.acronym}
                    to={`/universidade/${encodeURIComponent(region.name)}/${encodeURIComponent(uni.acronym || uni.name)}`}
                    className="uni-card"
                  >
                    <div className="uni-card-header">
                      <span className="uni-acronym" translate="no">{uni.acronym}</span>
                      <span className="uni-prog-count">{uni.programs.length} Programas</span>
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
