import { Link } from 'react-router-dom';
import { usePrograms } from '../hooks/usePrograms';

const regionColors = {
  Norte: '#2ecc71',
  Nordeste: '#e67e22',
  'Centro-Oeste': '#f1c40f',
  Sudeste: '#e74c3c',
  Sul: '#3498db'
};

const regionIcons = {
  Norte: '\u{1F333}',
  Nordeste: '\u{2600}\u{FE0F}',
  'Centro-Oeste': '\u{1F30E}',
  Sudeste: '\u{1F306}',
  Sul: '\u{1F3D4}\u{FE0F}'
};

export default function HomePage() {
  const { data, statusMap, loading, error } = usePrograms();

  if (loading) return <div className="center-msg">Carregando...</div>;
  if (error) return <div className="center-msg">Erro ao carregar dados: {error}</div>;
  if (!data) return null;

  const totalPrograms = data.reduce(
    (a, r) => a + r.states.reduce((b, s) => b + s.universities.reduce((c, u) => c + u.programs.length, 0), 0),
    0
  );
  const totalUnis = data.reduce((a, r) => a + r.states.reduce((b, s) => b + s.universities.length, 0), 0);

  const openCallCount = statusMap
    ? Object.values(statusMap).filter(s => s.status === 'likely_open').length
    : null;

  return (
    <div className="home-page">
      <div className="stats-bar">
        <span><strong>{data.length}</strong> Regiões</span>
        <span><strong>{totalUnis}</strong> Universidades</span>
        <span><strong>{totalPrograms}</strong> Programas</span>
        {openCallCount !== null && (
          <span className="stat-open-calls">
            <strong>{openCallCount}</strong> Editais Abertos
          </span>
        )}
      </div>

      <div className="region-grid">
        {data.map(region => {
          const uniCount = region.states.reduce((a, s) => a + s.universities.length, 0);
          const progCount = region.states.reduce(
            (a, s) => a + s.universities.reduce((b, u) => b + u.programs.length, 0),
            0
          );
          const stateCount = region.states.length;
          const color = regionColors[region.name] || '#999';

          return (
            <Link
              key={region.name}
              to={`/regiao/${encodeURIComponent(region.name)}`}
              className="region-card"
              style={{ borderTopColor: color }}
            >
              <div className="region-header">
                <span className="region-icon">{regionIcons[region.name] || '\u{1F4CD}'}</span>
                <h2>{region.name}</h2>
              </div>
              <div className="region-states">{stateCount} Estados</div>
              <div className="region-stats">
                <span>{uniCount} Universidades</span>
                <span>{progCount} Programas</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
