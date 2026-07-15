import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { regionName } from '../utils/regionName';
import { usePrograms } from '../hooks/usePrograms';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function normalizeUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

function parseStartDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

function daysUntil(date) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function flattenPrograms(data, statusMap) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const programs = [];
  for (const region of data || []) {
    for (const state of region.states || []) {
      for (const uni of state.universities || []) {
        for (let idx = 0; idx < (uni.programs || []).length; idx++) {
          const prog = uni.programs[idx];
          const date = parseStartDate(prog.startDate);
          if (!date || date.getFullYear() < currentYear) continue;
          const progUrl = normalizeUrl(prog.url);
          const s = statusMap?.[progUrl] || null;
          programs.push({
            region: region.name,
            state: state.name,
            university: uni.name,
            acronym: uni.acronym,
            program: prog.program,
            level: prog.level,
            city: prog.city,
            duration: prog.duration,
            startDate: prog.startDate,
            startDateObj: date,
            url: prog.url,
            programIdx: idx,
            openStatus: s?.status || null,
            uniKey: uni.acronym || uni.name,
          });
        }
      }
    }
  }
  return programs;
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

export default function CalendarPage() {
  const { data, statusMap, loading, error } = usePrograms();
  const [regionFilter, setRegionFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [openOnly, setOpenOnly] = useState(false);

  const allPrograms = useMemo(() => flattenPrograms(data, statusMap), [data, statusMap]);

  const filtered = useMemo(() => {
    let result = allPrograms;
    if (regionFilter !== 'all') {
      result = result.filter(p => p.region === regionFilter);
    }
    if (levelFilter !== 'all') {
      result = result.filter(p => p.level === levelFilter);
    }
    if (openOnly) {
      result = result.filter(p => p.openStatus === 'likely_open');
    }
    result.sort((a, b) => a.startDateObj.getTime() - b.startDateObj.getTime());
    return result;
  }, [allPrograms, regionFilter, levelFilter, openOnly]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const prog of filtered) {
      const key = `${prog.startDateObj.getFullYear()}-${prog.startDateObj.getMonth()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          year: prog.startDateObj.getFullYear(),
          month: prog.startDateObj.getMonth(),
          programs: [],
        });
      }
      groups.get(key).programs.push(prog);
    }
    return [...groups.values()];
  }, [filtered]);

  if (loading) return <div className="center-msg">Carregando...</div>;
  if (error) return <div className="center-msg">Erro ao carregar dados: {error}</div>;

  const regions = [...new Set(allPrograms.map(p => p.region))];
  const levels = [...new Set(allPrograms.map(p => p.level))];

  return (
    <div className="calendar-page">
      <div className="breadcrumb">
        <Link to="/">In&#237;cio</Link>
        <span> / </span>
        <span>Calend&#225;rio de Prazos</span>
      </div>

      <h2 className="page-title">Calend&#225;rio de Prazos</h2>
      <p className="page-subtitle">
        {filtered.length} programas com datas de in&#237;cio
        {regionFilter !== 'all' && <> em {regionFilter}</>}
      </p>

      <div className="cal-filters">
        <div className="cal-filter-group">
          <label>Regi&#227;o:</label>
          <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}>
            <option value="all">Todas</option>
            {regions.map(r => (
              <option key={r} value={r}>{regionName(r)}</option>
            ))}
          </select>
        </div>
        <div className="cal-filter-group">
          <label>N&#237;vel:</label>
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
            <option value="all">Todos</option>
            {levels.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div className="cal-filter-group cal-filter-check">
          <label>
            <input
              type="checkbox"
              checked={openOnly}
              onChange={e => setOpenOnly(e.target.checked)}
            />
            Apenas com edital aberto
          </label>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="center-msg">
          <p>Nenhum programa com data de in&#237;cio encontrada.</p>
        </div>
      ) : (
        <div className="cal-timeline">
          {grouped.map(group => (
            <div key={`${group.year}-${group.month}`} className="cal-month-group">
              <h3 className="cal-month-title">
                {MONTH_NAMES[group.month]} {group.year}
              </h3>
              <div className="cal-month-programs">
                {group.programs.map((prog, idx) => {
                  const days = daysUntil(prog.startDateObj);
                  const isPast = days < 0;
                  const isSoon = days >= 0 && days <= 30;
                  return (
                    <div key={idx} className={`cal-program-row ${isPast ? 'cal-past' : ''} ${isSoon ? 'cal-soon' : ''}`}>
                      <div className="cal-date-col">
                        <span className="cal-day">{prog.startDateObj.getDate()}</span>
                        {!isPast && days <= 90 && (
                          <span className={`cal-countdown ${isSoon ? 'cal-countdown-urgent' : ''}`}>
                            {days === 0 ? 'Hoje!' : `${days}d`}
                          </span>
                        )}
                      </div>
                      <div className="cal-program-info">
                        <div className="cal-program-top">
                          <Link
                            to={`/programa/${encodeURIComponent(prog.region)}/${encodeURIComponent(prog.uniKey)}/${prog.programIdx}`}
                            className="prog-link"
                          >
                            {prog.program}
                          </Link>
                          <span className="badge">{prog.level}</span>
                        </div>
                        <div className="cal-program-meta">
                          <span className="cal-uni">
                            <Link
                              to={`/universidade/${encodeURIComponent(prog.region)}/${encodeURIComponent(prog.uniKey)}`}
                              className="web-link"
                            >
                              <strong translate="no">{prog.acronym}</strong>
                            </Link>
                            {' · '}{prog.city}
                          </span>
                          <span>{prog.duration} meses</span>
                          {statusBadge(prog.openStatus)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
