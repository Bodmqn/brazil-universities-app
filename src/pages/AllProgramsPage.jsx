import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
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

const COLUMNS = [
  { key: 'region', label: 'Região' },
  { key: 'state', label: 'Estado' },
  { key: 'university', label: 'Universidade' },
  { key: 'acronym', label: 'Sigla' },
  { key: 'level', label: 'Nível' },
  { key: 'program', label: 'Nome do Programa' },
  { key: 'city', label: 'Cidade' },
  { key: 'campus', label: 'Campus' },
  { key: 'startDate', label: 'Início' },
  { key: 'duration', label: 'Duração (meses)' },
  { key: 'languageRequirement', label: 'Requisito de Idioma' },
  { key: 'openCalls', label: 'Editais Abertos' },
  { key: 'url', label: 'Site' },
];

function flattenData(data, statusMap) {
  const rows = [];
  for (const region of data || []) {
    for (const state of region.states || []) {
      for (const uni of state.universities || []) {
        for (const prog of uni.programs || []) {
          const s = getStatus(prog.url, statusMap);
          rows.push({
            region: region.name,
            state: state.name,
            university: uni.name,
            acronym: uni.acronym,
            level: prog.level,
            program: prog.program,
            city: prog.city,
            campus: prog.campus,
            startDate: prog.startDate,
            duration: prog.duration,
            languageRequirement: prog.languageRequirement,
            openCalls: s?.status || null,
            openCallsRaw: s,
            url: prog.url,
            regionSlug: region.name.toLowerCase(),
            uniKey: uni.acronym || uni.name,
          });
        }
      }
    }
  }
  return rows;
}

export default function AllProgramsPage() {
  const { data, statusMap, loading, error } = usePrograms();
  const [sortKey, setSortKey] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  const rows = useMemo(() => flattenData(data, statusMap), [data, statusMap]);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      let aVal = a[sortKey] ?? '';
      let bVal = b[sortKey] ?? '';
      if (sortKey === 'duration') {
        aVal = parseInt(aVal) || 0;
        bVal = parseInt(bVal) || 0;
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [rows, sortKey, sortAsc]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortAsc(a => !a);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  if (loading) return <div className="center-msg">Carregando...</div>;
  if (error) return <div className="center-msg">Erro ao carregar dados: {error}</div>;

  return (
    <div className="all-programs-page">
      <div className="breadcrumb">
        <Link to="/">Início</Link>
        <span> / </span>
        <span>Tabela Completa</span>
      </div>

      <h2 className="page-title">Tabela Completa de Programas</h2>
      <p className="page-subtitle">{rows.length} programas de pós-graduação listados</p>

      <div className="programs-table-wrap all-programs-wrap">
        <table className="programs-table all-programs-table">
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={`sortable-th ${sortKey === col.key ? (sortAsc ? 'sorted-asc' : 'sorted-desc') : ''}`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="sort-arrow">{sortAsc ? ' ▲' : ' ▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr key={idx}>
                <td>{regionName(row.region)}</td>
                <td>{row.state}</td>
                <td>
                  <Link
                    to={`/universidade/${encodeURIComponent(row.regionSlug)}/${encodeURIComponent(row.uniKey)}`}
                    className="web-link"
                  >
                    {row.university}
                  </Link>
                </td>
                <td><span className="badge" translate="no">{row.acronym}</span></td>
                <td><span className="badge">{row.level}</span></td>
                <td className="prog-name">{row.program}</td>
                <td>{row.city}</td>
                <td>{row.campus}</td>
                <td>{row.startDate}</td>
                <td>{row.duration} meses</td>
                <td className="lang-cell">{row.languageRequirement}</td>
                <td>{statusBadge(row.openCalls)}</td>
                <td>
                  {row.url && (
                    <a href={normalizeUrl(row.url)}
                      target="_blank" rel="noopener noreferrer" className="web-link">
                      Site
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
