import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { regionName } from '../utils/regionName';
import { usePrograms } from '../hooks/usePrograms';

const MAX_COMPARE = 4;
const FIELDS = [
  { key: 'acronym', label: 'Sigla' },
  { key: 'name', label: 'Nome' },
  { key: 'region', label: 'Região', render: (v) => regionName(v) },
  { key: 'state', label: 'Estado' },
  { key: 'category', label: 'Categoria' },
  { key: 'mestrados', label: 'Mestrados' },
  { key: 'doutorados', label: 'Doutorados' },
  { key: 'totalProgs', label: 'Total Programas' },
  { key: 'qsRanking', label: 'QS Ranking' },
  { key: 'theRanking', label: 'THE Ranking' },
  { key: 'sigaaStatus', label: 'SIGAA' },
  { key: 'website', label: 'Site', render: (v) => v ? <a href={v} target="_blank" rel="noopener noreferrer" className="web-link">Acessar</a> : '-' },
  { key: 'graduatePageUrl', label: 'Pós-Graduação', render: (v) => v ? <a href={v} target="_blank" rel="noopener noreferrer" className="web-link">Acessar</a> : '-' },
];

export default function UniversityComparePage() {
  const { data, loading, error } = usePrograms();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const allUnis = useMemo(() => {
    if (!data) return [];
    const list = [];
    for (const r of data) for (const s of r.states) for (const u of s.universities) {
      list.push({
        ...u,
        region: r.name,
        state: s.name,
        mestrados: (u.programs || []).filter(p => p.level === 'Mestrado' || p.level === 'Mestrado Profissional').length,
        doutorados: (u.programs || []).filter(p => p.level === 'Doutorado' || p.level === 'Doutorado Profissional').length,
        totalProgs: (u.programs || []).length,
        sigaaStatus: u.sigaaStatus === 'Working' ? '✓' : u.sigaaStatus === 'Not Found' ? '✗' : '-',
      });
    }
    return list;
  }, [data]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allUnis.filter(u =>
      (u.acronym || '').toLowerCase().includes(q) ||
      (u.name || '').toLowerCase().includes(q)
    ).slice(0, 10);
  }, [search, allUnis]);

  const selectedUnis = useMemo(() =>
    selected.map(id => allUnis.find(u => u.acronym === id)).filter(Boolean),
    [selected, allUnis]
  );

  function addUni(acronym) {
    if (selected.includes(acronym) || selected.length >= MAX_COMPARE) return;
    setSelected([...selected, acronym]);
    setSearch('');
  }

  function removeUni(acronym) {
    setSelected(selected.filter(s => s !== acronym));
  }

  if (loading) return <div className="center-msg">Carregando...</div>;
  if (error) return <div className="center-msg">Erro ao carregar dados: {error}</div>;

  return (
    <div className="compare-page">
      <div className="breadcrumb">
        <Link to="/">Início</Link>
        <span> / </span>
        <span>Comparar Universidades</span>
      </div>

      <h2 className="page-title">Comparar Universidades</h2>
      <p className="page-subtitle">
        Selecione até {MAX_COMPARE} universidades para comparar lado a lado
      </p>

      <div className="compare-search-wrap">
        <div className="compare-search-input-wrap">
          <input
            type="text"
            className="compare-search-input"
            placeholder="Buscar universidade por nome ou sigla..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            disabled={selected.length >= MAX_COMPARE}
          />
          {search && searchResults.length > 0 && (
            <div className="compare-search-dropdown">
              {searchResults.map(u => (
                <button
                  key={u.acronym}
                  className={`compare-search-item ${selected.includes(u.acronym) ? 'compare-search-item-disabled' : ''}`}
                  onClick={() => addUni(u.acronym)}
                  disabled={selected.includes(u.acronym)}
                >
                  <strong>{u.acronym}</strong> — {u.name}
                  <span className="compare-search-meta">{regionName(u.region)} · {u.state} · {u.totalProgs} programas</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="compare-selected-tags">
          {selectedUnis.map(u => (
            <span key={u.acronym} className="compare-tag">
              {u.acronym || u.name}
              <button className="compare-tag-remove" onClick={() => removeUni(u.acronym)}>✕</button>
            </span>
          ))}
        </div>
      </div>

      {selectedUnis.length >= 2 ? (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th className="compare-label-col">Atributo</th>
                {selectedUnis.map(u => (
                  <th key={u.acronym} className="compare-uni-col">
                    <Link to={`/universidade/${encodeURIComponent(u.region)}/${encodeURIComponent(u.acronym)}`} className="compare-uni-link">
                      {u.acronym || u.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(field => (
                <tr key={field.key}>
                  <td className="compare-label-col">{field.label}</td>
                  {selectedUnis.map(u => {
                    let value = u[field.key];
                    if (field.render) value = field.render(value);
                    return (
                      <td key={u.acronym} className="compare-value-col">
                        {value ?? '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : selectedUnis.length === 1 ? (
        <div className="center-msg" style={{ marginTop: '2rem' }}>
          <p>Adicione pelo menos mais uma universidade para comparar.</p>
        </div>
      ) : (
        <div className="center-msg" style={{ marginTop: '2rem' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</p>
          <p>Busque e selecione universidades acima para começar a comparação.</p>
        </div>
      )}
    </div>
  );
}
