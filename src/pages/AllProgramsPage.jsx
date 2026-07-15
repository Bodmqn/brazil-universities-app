import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { regionName } from '../utils/regionName';
import { usePrograms } from '../hooks/usePrograms';

const PAGE_SIZE = 50;
const MAX_COMPARE = 4;

const COLUMNS = [
  { key: 'compare', label: '☐', fixed: true },
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
  compare: 36, region: 100, state: 110, university: 230, acronym: 75,
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
            id: `${uni.acronym || uni.name}-${prog.level}-${progIdx}`,
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
            sigaaStatus: uni.sigaaStatus || null,
            sigaaUrl: uni.sigaaUrl || null,
            qsRanking: uni.qsRanking || null,
            theRanking: uni.theRanking || null,
            category: uni.category || null,
          });
        }
      }
    }
  }
  return rows;
}

function renderCell(colKey, row) {
  switch (colKey) {
    case 'compare':
      return null;
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

export default function AllProgramsPage() {
  const { data, statusMap, loading, error } = usePrograms();
  const [sortKey, setSortKey] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [visibleCols, setVisibleCols] = useState(() => ['languageRequirement', 'url']);
  const [showColPicker, setShowColPicker] = useState(false);
  const [query, setQuery] = useState('');
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
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

  const compareRows = useMemo(() => {
    return rows.filter(r => compareList.includes(r.id));
  }, [rows, compareList]);

  function handleSort(key) {
    if (key === 'compare') return;
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

  function toggleCompare(id) {
    setCompareList(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }

  function removeCompare(id) {
    setCompareList(prev => prev.filter(i => i !== id));
    if (compareList.length <= 1) setShowCompare(false);
  }

  function goToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (loading) return <div className="center-msg">Carregando...</div>;
  if (error) return <div className="center-msg">Erro ao carregar dados: {error}</div>;

  return (
    <div className="all-programs-page">
      <div className="breadcrumb">
        <Link to="/">In&#237;cio</Link>
        <span> / </span>
        <span>Tabela Completa</span>
      </div>

      <h2 className="page-title">Tabela Completa de Programas</h2>
      <p className="page-subtitle">
        {sorted.length} programas de pós-graduação listados
        {query && <> &middot; <strong>{filtered.length}</strong> correspondentes</>}
      </p>

      {compareList.length > 0 && (
        <div className="compare-tray">
          <span className="compare-tray-info">
            <strong>{compareList.length}/{MAX_COMPARE}</strong> programas selecionados
          </span>
          <button
            className="compare-btn"
            disabled={compareList.length < 2}
            onClick={() => setShowCompare(v => !v)}
          >
            {showCompare ? 'Fechar' : `Comparar (${compareList.length})`}
          </button>
          <button className="compare-clear" onClick={() => { setCompareList([]); setShowCompare(false); }}>
            Limpar
          </button>
        </div>
      )}

      {showCompare && compareRows.length >= 2 && (
        <div className="compare-section">
          <h3 className="compare-title">Comparação de Programas</h3>
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th className="compare-label-col">Campo</th>
                  {compareRows.map(row => (
                    <th key={row.id} className="compare-prog-col">
                      <div className="compare-prog-header">
                        <span translate="no">{row.acronym}</span>
                        <button className="compare-remove" onClick={() => removeCompare(row.id)}>✕</button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'university', label: 'Universidade' },
                  { key: 'level', label: 'Nível' },
                  { key: 'program', label: 'Programa' },
                  { key: 'city', label: 'Cidade' },
                  { key: 'startDate', label: 'Início' },
                  { key: 'duration', label: 'Duração' },
                  { key: 'languageRequirement', label: 'Idioma' },
                  { key: 'category', label: 'Tipo' },
                  { key: 'qsRanking', label: 'QS Ranking' },
                  { key: 'openCalls', label: 'Edital' },
                  { key: 'sigaaStatus', label: 'SIGAA' },
                ].map(field => (
                  <tr key={field.key}>
                    <td className="compare-label-col">{field.label}</td>
                    {compareRows.map(row => {
                      let val = row[field.key];
                      if (field.key === 'duration' && val) val = `${val} meses`;
                      if (field.key === 'openCalls') return <td key={row.id}>{statusBadge(val)}</td>;
                      if (field.key === 'sigaaStatus') {
                        return (
                          <td key={row.id}>
                            {val ? (
                              <span className={`sigaa-badge sigaa-${val === 'Working' ? 'working' : 'not-found'}`}>
                                {val === 'Working' ? '✓' : '✗'}
                              </span>
                            ) : '-'}
                          </td>
                        );
                      }
                      return <td key={row.id}>{val || '-'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              {COLUMNS.filter(c => c.key !== 'compare').map(col => {
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
                    className={`ap-th ${sortKey === col.key ? (sortAsc ? 'sorted-asc' : 'sorted-desc') : ''} ${col.key === 'compare' ? 'ap-th-compare' : ''}`}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.key === 'compare' ? '☐' : col.label}
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
          <table className="ap-table">
            <colgroup>
              {displayCols.map(col => (
                <col key={col.key} style={{ width: COL_WIDTHS[col.key] }} />
              ))}
            </colgroup>
            <tbody>
              {currentRows.map((row, idx) => (
                <tr key={startIdx + idx} className={compareList.includes(row.id) ? 'compare-selected' : ''}>
                  {displayCols.map(col => (
                    <td key={col.key} data-col={col.key} className={col.key === 'compare' ? 'ap-td-compare' : ''}>
                      {col.key === 'compare' ? (
                        <input
                          type="checkbox"
                          className="compare-checkbox"
                          checked={compareList.includes(row.id)}
                          disabled={!compareList.includes(row.id) && compareList.length >= MAX_COMPARE}
                          onChange={() => toggleCompare(row.id)}
                        />
                      ) : (
                        renderCell(col.key, row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
