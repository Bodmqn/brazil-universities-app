import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { regionName } from '../utils/regionName';
import { usePrograms } from '../hooks/usePrograms';
import languagesData from '../data/languages.json';

const LANG_ALIASES = {};
for (const lang of languagesData.languages) {
  for (const alias of lang.aliases) {
    LANG_ALIASES[alias.toLowerCase()] = lang.name;
  }
}

const QUALIFICATIONS = [
  { id: 'bachelor', label: 'Tenho diploma de gradua\u00e7\u00e3o', labelEn: "I have a Bachelor's degree" },
  { id: 'master', label: 'Tenho diploma de mestrado', labelEn: "I have a Master's degree" },
  { id: 'research', label: 'Tenho experi\u00eancia de pesquisa', labelEn: 'I have research experience' },
  { id: 'publications', label: 'Tenho publica\u00e7\u00f5es acad\u00eamicas', labelEn: 'I have academic publications' },
];

const LANGUAGES = [
  { id: 'Portugu\u00eas', label: 'Portugu\u00eas' },
  { id: 'Ingl\u00eas', label: 'Ingl\u00eas' },
  { id: 'Espanhol', label: 'Espanhol' },
  { id: 'Franc\u00eas', label: 'Franc\u00eas' },
  { id: 'Alem\u00e3o', label: 'Alem\u00e3o' },
  { id: 'Italiano', label: 'Italiano' },
  { id: 'Mandarim', label: 'Mandarim' },
];

function normalizeUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

function parseLanguages(langReq) {
  if (!langReq) return [];
  const text = langReq.toLowerCase();
  const found = new Set();
  for (const lang of languagesData.languages) {
    for (const alias of lang.aliases) {
      if (text.includes(alias)) {
        found.add(lang.name);
        break;
      }
    }
  }
  return [...found];
}

function flattenPrograms(data, statusMap) {
  const programs = [];
  for (const region of data || []) {
    for (const state of region.states || []) {
      for (const uni of state.universities || []) {
        for (let idx = 0; idx < (uni.programs || []).length; idx++) {
          const prog = uni.programs[idx];
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
            languageRequirement: prog.languageRequirement,
            url: prog.url,
            programIdx: idx,
            openStatus: s?.status || null,
            uniKey: uni.acronym || uni.name,
            requiredLanguages: parseLanguages(prog.languageRequirement),
          });
        }
      }
    }
  }
  return programs;
}

function statusBadge(status) {
  if (!status || status === 'unknown') return null;
  const labels = { likely_open: 'Edital Aberto', possible: 'Poss\u00edvel Edital', error: 'Erro' };
  const colors = { likely_open: 'status-open', possible: 'status-maybe', error: 'status-error' };
  return (
    <span className={`status-badge ${colors[status] || ''}`}>
      {labels[status] || status}
    </span>
  );
}

export default function WizardPage() {
  const { data, statusMap, loading, error } = usePrograms();
  const [showResults, setShowResults] = useState(false);

  const [targetLevel, setTargetLevel] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  const [userLanguages, setUserLanguages] = useState([]);
  const [regionFilter, setRegionFilter] = useState('all');
  const [maxDuration, setMaxDuration] = useState(60);
  const [openOnly, setOpenOnly] = useState(false);

  const allPrograms = useMemo(() => flattenPrograms(data, statusMap), [data, statusMap]);
  const regions = useMemo(() => [...new Set(allPrograms.map(p => p.region))], [allPrograms]);

  function toggleArray(arr, setArr, val) {
    setArr(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }

  const results = useMemo(() => {
    if (!showResults) return [];

    return allPrograms.filter(prog => {
      if (targetLevel.length > 0 && !targetLevel.includes(prog.level)) return false;

      if (qualifications.includes('bachelor')) {
        // Bachelor's qualifies for Masters
        // Master's qualifies for both
        // No bachelor = can't apply
      } else {
        if (!qualifications.includes('master')) {
          // If user has neither bachelor nor master, still show but mark as partial
        }
      }

      if (prog.level === 'Doutorado' && !qualifications.includes('master') && !qualifications.includes('bachelor')) {
        return false;
      }

      if (regionFilter !== 'all' && prog.region !== regionFilter) return false;

      const duration = parseInt(prog.duration) || 0;
      if (duration > 0 && duration > maxDuration) return false;

      if (openOnly && prog.openStatus !== 'likely_open') return false;

      if (userLanguages.length > 0) {
        const hasAllRequired = prog.requiredLanguages.every(rl => userLanguages.includes(rl));
        if (!hasAllRequired && prog.requiredLanguages.length > 0) return false;
      }

      return true;
    });
  }, [allPrograms, targetLevel, qualifications, userLanguages, regionFilter, maxDuration, openOnly, showResults]);

  const enrichedResults = useMemo(() => {
    return results.map(prog => {
      const hasMaster = qualifications.includes('master');
      const hasBachelor = qualifications.includes('bachelor');
      const missingLangs = prog.requiredLanguages.filter(rl => !userLanguages.includes(rl));

      let compatibility = 'full';
      let notes = [];

      if (prog.level === 'Doutorado' && !hasMaster && hasBachelor) {
        compatibility = 'partial';
        notes.push('Pode ser necess\u00e1rio mestrado pr\u00e9vio');
      }
      if (missingLangs.length > 0) {
        compatibility = 'partial';
        notes.push(`Idiomas faltantes: ${missingLangs.join(', ')}`);
      }
      if (prog.level === 'Doutorado' && !hasMaster && !hasBachelor) {
        compatibility = 'low';
        notes.push('Doutorado geralmente requer mestrado');
      }

      return { ...prog, compatibility, notes };
    });
  }, [results, qualifications, userLanguages]);

  function handleSearch() {
    setShowResults(true);
  }

  if (loading) return <div className="center-msg">Carregando...</div>;
  if (error) return <div className="center-msg">Erro ao carregar dados: {error}</div>;

  return (
    <div className="wizard-page">
      <div className="breadcrumb">
        <Link to="/">In&#237;cio</Link>
        <span> / </span>
        <span>Filtro de Programas</span>
      </div>

      <h2 className="page-title">Encontre o Programa Ideal</h2>
      <p className="page-subtitle">
        Selecione o que voc\u00ea procura e o que j\u00e1 possui para encontrar programas compat\u00edveis
      </p>

      <div className="wizard-form">
        <div className="wizard-section">
          <h3 className="wizard-section-title">O que voc\u00ea procura?</h3>
          <div className="wizard-checkboxes">
            {['Mestrado', 'Doutorado'].map(level => (
              <label key={level} className="wizard-checkbox">
                <input
                  type="checkbox"
                  checked={targetLevel.includes(level)}
                  onChange={() => toggleArray(targetLevel, setTargetLevel, level)}
                />
                <span className="wizard-check-label">{level}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="wizard-section">
          <h3 className="wizard-section-title">Sua forma\u00e7\u00e3o</h3>
          <div className="wizard-checkboxes">
            {QUALIFICATIONS.map(q => (
              <label key={q.id} className="wizard-checkbox">
                <input
                  type="checkbox"
                  checked={qualifications.includes(q.id)}
                  onChange={() => toggleArray(qualifications, setQualifications, q.id)}
                />
                <span className="wizard-check-label">{q.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="wizard-section">
          <h3 className="wizard-section-title">Idiomas que voc\u00ea fala</h3>
          <div className="wizard-checkboxes">
            {LANGUAGES.map(lang => (
              <label key={lang.id} className="wizard-checkbox">
                <input
                  type="checkbox"
                  checked={userLanguages.includes(lang.id)}
                  onChange={() => toggleArray(userLanguages, setUserLanguages, lang.id)}
                />
                <span className="wizard-check-label">{lang.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="wizard-section">
          <h3 className="wizard-section-title">Prefer\u00eancias</h3>
          <div className="wizard-prefs">
            <div className="wizard-pref-row">
              <label>Regi&#227;o:</label>
              <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}>
                <option value="all">Todas</option>
                {regions.map(r => (
                  <option key={r} value={r}>{regionName(r)}</option>
                ))}
              </select>
            </div>
            <div className="wizard-pref-row">
              <label>Dura\u00e7\u00e3o m\u00e1xima: <strong>{maxDuration} meses</strong></label>
              <input
                type="range"
                min="12"
                max="72"
                step="6"
                value={maxDuration}
                onChange={e => setMaxDuration(Number(e.target.value))}
                className="wizard-slider"
              />
            </div>
            <div className="wizard-pref-row">
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
        </div>

        <button className="wizard-submit" onClick={handleSearch}>
          Encontrar Programas ({allPrograms.length} total)
        </button>
      </div>

      {showResults && (
        <div className="wizard-results">
          <h3 className="page-title" style={{ fontSize: '1.3rem' }}>
            {enrichedResults.length} Programas Compat&#237;veis
          </h3>

          {enrichedResults.length === 0 ? (
            <div className="center-msg">
              <p>Nenhum programa encontrado com esses crit\u00e9rios.</p>
              <p className="hint">Tente ampliar seus filtros.</p>
            </div>
          ) : (
            <div className="wizard-results-list">
              {enrichedResults.map((prog, idx) => (
                <div key={idx} className={`wizard-result-card compat-${prog.compatibility}`}>
                  <div className="wizard-result-top">
                    <div className="wizard-result-info">
                      <div className="wizard-result-title">
                        <Link
                          to={`/programa/${encodeURIComponent(prog.region)}/${encodeURIComponent(prog.uniKey)}/${prog.programIdx}`}
                          className="prog-link"
                        >
                          {prog.program}
                        </Link>
                      </div>
                      <div className="wizard-result-meta">
                        <Link
                          to={`/universidade/${encodeURIComponent(prog.region)}/${encodeURIComponent(prog.uniKey)}`}
                          className="web-link"
                        >
                          <strong translate="no">{prog.acronym}</strong> \u2014 {prog.university}
                        </Link>
                        <span>{regionName(prog.region)} \u00b7 {prog.state} \u00b7 {prog.city}</span>
                      </div>
                    </div>
                    <div className="wizard-result-badges">
                      <span className={`compat-badge compat-${prog.compatibility}`}>
                        {prog.compatibility === 'full' ? '\u2713 Completo' :
                         prog.compatibility === 'partial' ? '\u26A0 Parcial' : '\u26A0 Baixa'}
                      </span>
                      <span className="badge">{prog.level}</span>
                      {statusBadge(prog.openStatus)}
                    </div>
                  </div>
                  <div className="wizard-result-details">
                    <span>In&#237;cio: {prog.startDate}</span>
                    <span>{prog.duration} meses</span>
                    <span>Idioma: {prog.languageRequirement}</span>
                  </div>
                  {prog.notes.length > 0 && (
                    <div className="wizard-result-notes">
                      {prog.notes.map((note, i) => (
                        <span key={i} className="wizard-note">{note}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
