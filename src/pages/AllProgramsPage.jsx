import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { regionName } from '../utils/regionName';
import { usePrograms } from '../hooks/usePrograms';

const PAGE_SIZE = 50;

const COLUMNS = [
  { key: 'region', label: 'Região', fixed: true },
  { key: 'state', label: 'Estado', fixed: true },
  { key: 'university', label: 'Universidade', fixed: true },
  { key: 'acronym', label: 'Sigla' },
  { key: 'level', label: 'Nível' },
  { key: 'program', label: 'Nome do Programa', fixed: true },
  { key: 'city', label: 'Cidade' },
  { key: 'campus', label: 'Campus' },
  { key: 'startDate', label: 'Início' },
  { key: 'duration', label: 'Duração (meses)' },
  { key: 'languageRequirement', label: 'Requisito de Idioma' },
  { key: 'openCalls', label: 'Editais Abertos' },
  { key: 'url', label: 'Site' },
];

const COL_WIDTHS = {
  region: 100, state: 110, university: 230, acronym: 75,
  level: 85, program: 260, city: 110, campus: 170,
  startDate: 80, duration: 70, languageRequirement: 200,
  openCalls: 100, url: 55,
};

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

function flattenData(data, statusMap) {
  const rows = [];
  for (const region of data || []) {
    for (const state of region.states || []) {
      for (const uni of state.universities || []) {
        for (let progIdx = 0; progIdx < (uni.programs || []).length; progIdx++) {
          const prog = uni.programs[progIdx];
          const s = getStatus(prog.url, statusMap);
          rows.push({
            region: region.name,
            state: state.name,
            university: uni.name,
            acronym: uni.acronym,
            level: prog.level,
            program: prog.program,
            programIdx: progIdx,
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

function renderCell(colKey, row, statusMap) {
  switch (colKey) {
    case 'region':
      return regionName(row.region);
    case 'state':
      return row.state;
    case 'university':
      return (
        <Link
          to={`/universidade/${encodeURIComponent(row.regionSlug)}/${encodeURIComponent(row.uniKey)}`}
          className="web-link"
        >
          {row.university}
        </Link>
      );
    case 'acronym':
      return <span className="badge" translate="no">{row.acronym}</span>;
    case 'level':
      return <span className="badge">{row.level}</span>;
    case 'program':
      return (
        <Link
          to={`/programa/${encodeURIComponent(row.regionSlug)}/${encodeURIComponent(row.uniKey)}/${row.programIdx}`}
          className="ap-prog-name web-link"
        >
          {row.program}
        </Link>
      );
    case 'city':
      return row.city;
    case 'campus':
      return row.campus;
    case 'startDate':
      return row.startDate;
    case 'duration':
      return row.duration ? `${row.duration} meses` : '';
    case 'languageRequirement':
      return <span className="lang-cell">{row.languageRequirement}</span>;
    case 'openCalls':
      return statusBadge(row.openCalls);
    case 'url':
      return row.url ? (
        <a href={normalizeUrl(row.url)}
          target="_blank" rel="noopener noreferrer" className="web-link">
          Site
        </a>
      ) : null;
    default:
      return null;
  }
}

const COL_PICKER_LABELS = {
  region: 'Região', state: 'Estado', university: 'Universidade',
  acronym: 'Sigla', level: 'Nível', program: 'Nome do Programa',
  city: 'Cidade', campus: 'Campus', startDate: 'Início',
  duration: 'Duração', languageRequirement: 'Requisito de Idioma',
  openCalls: 'Editais Abertos', url: 'Site',
};

export default function AllProgramsPage() {
  const { data, statusMap, loading, error } = usePrograms();
  const [sortKey, setSortKey] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [visibleCols, setVisibleCols] = useState(() => ['languageRequirement', 'url']);
  const [showColPicker, setShowColPicker] = useState(false);
  const [query, setQuery] = useState('');
  const pickerRef = useRef(null);

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

  const filtered = useMemo(() => {
    if (!query) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(row =>
      String(row.region).toLowerCase().includes(q) ||
      String(row.state).toLowerCase().includes(q) ||
      String(row.university).toLowerCase().includes(q) ||
      String(row.acronym).toLowerCase().includes(q) ||
      String(row.level).toLowerCase().includes(q) ||
      String(row.program).toLowerCase().includes(q) ||
      String(row.city).toLowerCase().includes(q) ||
      String(row.campus).toLowerCase().includes(q) ||
      String(row.startDate).toLowerCase().includes(q) ||
      String(row.duration).toLowerCase().includes(q) ||
      String(row.languageRequirement).toLowerCase().includes(q)
    );
  }, [sorted, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const startIdx = (clampedPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, filtered.length);
  const currentRows = filtered.slice(startIdx, endIdx);

  useEffect(() => setPage(1), [sortKey, query]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    function handleClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowColPicker(false);
      }
    }
    if (showColPicker) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showColPicker]);

  const displayCols = useMemo(() => {
    const fixed = COLUMNS.filter(c => c.fixed).map(c => c.key);
    const merged = new Set([...fixed, ...visibleCols]);
    return COLUMNS.filter(c => merged.has(c.key));
  }, [visibleCols]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortAsc(a => !a);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function toggleCol(key) {
    const col = COLUMNS.find(c => c.key === key);
    if (col?.fixed) return;
    setVisibleCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  function goToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (loading) return <div className="center-msg">Carregando...</div>;
  if (error) return <div className="center-msg">Erro ao carregar dados: {error}</div>;

  const sortLabel = COLUMNS.find(c => c.key === sortKey)?.label || '';

  return (
    <div className="all-programs-page">
      <div className="breadcrumb">
        <Link to="/">Início</Link>
        <span> / </span>
        <span>Tabela Completa</span>
      </div>

      <h2 className="page-title">Tabela Completa de Programas</h2>
      <p className="page-subtitle">
        {sorted.length} programas de pós-graduação listados
        {query && <> &middot; <strong>{filtered.length}</strong> correspondentes</>}
      </p>

      <div className="ap-toolbar">
        <div className="ap-toolbar-left">
          <button className="ap-top-btn" onClick={goToTop}>⬆ Topo</button>
          <span className="ap-page-info">
            <strong>{startIdx + 1}–{endIdx}</strong> de {filtered.length}
          </span>
          <input
            className="ap-search-input"
            type="text"
            placeholder="Filtrar programas..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="ap-toolbar-center">
          <button
            className="ap-page-btn"
            disabled={clampedPage <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            ◀
          </button>
          <span className="ap-page-num">Página {clampedPage} de {totalPages}</span>
          <button
            className="ap-page-btn"
            disabled={clampedPage >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            ▶
          </button>
        </div>
        <div className="ap-toolbar-right" ref={pickerRef}>
          <button
            className="ap-col-picker-btn"
            onClick={() => setShowColPicker(s => !s)}
          >
            Colunas ▾
          </button>
          {showColPicker && (
            <div className="ap-col-picker-dropdown">
              {COLUMNS.map(col => {
                const isVisible = visibleCols.includes(col.key);
                return (
                  <div
                    key={col.key}
                    className={`ap-col-option ${col.fixed ? 'ap-col-fixed' : ''}`}
                    onClick={() => toggleCol(col.key)}
                  >
                    <span className={`ap-col-check ${isVisible ? 'ap-col-checked' : ''}`}>
                      {isVisible && '✓'}
                    </span>
                    {col.label}
                    {col.fixed && <span className="ap-col-fixed-tag">fixa</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="ap-table-container">
        <div className="ap-header-table">
          <table className="ap-table">
            <colgroup>
              {displayCols.map(col => (
                <col key={col.key} style={{ width: COL_WIDTHS[col.key] }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {displayCols.map(col => (
                  <th
                    key={col.key}
                    data-col={col.key}
                    className={`ap-th ${sortKey === col.key ? (sortAsc ? 'sorted-asc' : 'sorted-desc') : ''}`}
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
          </table>
        </div>
        <div className="ap-body-wrapper">
          <div className="ap-body-inner">
          <table className="ap-table">
            <colgroup>
              {displayCols.map(col => (
                <col key={col.key} style={{ width: COL_WIDTHS[col.key] }} />
              ))}
            </colgroup>
            <tbody>
              {currentRows.map((row, idx) => (
                <tr key={startIdx + idx}>
                  {displayCols.map(col => (
                    <td key={col.key} data-col={col.key}>
                      {renderCell(col.key, row, statusMap)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
