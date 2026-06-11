import { useState, useEffect, useCallback } from 'react';

const STATUS_URL = 'https://raw.githubusercontent.com/Bodmqn/brazil-universities-app/main/src/assets/data/program-status.json';

let cached = null;
let cachedStatus = null;
let cachedDiscovered = null;

export function useProgramsData() {
  const [data, setData] = useState(cached);
  const [statusMap, setStatusMap] = useState(cachedStatus);
  const [discovered, setDiscovered] = useState(cachedDiscovered);
  const [loading, setLoading] = useState(!cached || !cachedStatus);
  const [error, setError] = useState(null);

  const loadPrograms = useCallback(() => {
    return import('../assets/data/programs.json').then(mod => {
      cached = mod.default || mod;
      setData(cached);
      return cached;
    });
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${STATUS_URL}?t=${Date.now()}`);
      if (!res.ok) throw new Error('fetch failed');
      const statusFile = await res.json();
      cachedStatus = statusFile.programs || {};
      cachedDiscovered = statusFile.discovered || null;
      setStatusMap(cachedStatus);
      setDiscovered(cachedDiscovered);
    } catch {
      const fallback = await import('../assets/data/program-status.json').catch(() => ({ default: { programs: {} } }));
      const mod = fallback.default || fallback;
      cachedStatus = mod.programs || {};
      cachedDiscovered = mod.discovered || null;
      setStatusMap(cachedStatus);
      setDiscovered(cachedDiscovered);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadPrograms(), loadStatus()])
      .then(() => setLoading(false))
      .catch(err => { setError(err.message); setLoading(false); });
  }, [loadPrograms, loadStatus]);

  return { data, statusMap, discovered, loading, error, refreshStatus: loadStatus };
}

const enToPt = {
  'masters': 'mestrado',
  "master's": 'mestrado',
  'master': 'mestrado',
  'doctorate': 'doutorado',
  'phd': 'doutorado',
  'graduate': 'pós-graduação',
  'postgraduate': 'pós-graduação',
  'program': 'programa',
  'university': 'universidade',
  'federal': 'federal',
  'state': 'estadual',
  'science': 'ciência',
  'sciences': 'ciências',
  'engineering': 'engenharia',
  'mathematics': 'matemática',
  'physics': 'física',
  'chemistry': 'química',
  'biology': 'biologia',
  'history': 'história',
  'geography': 'geografia',
  'philosophy': 'filosofia',
  'literature': 'letras',
  'languages': 'letras',
  'linguistics': 'linguística',
  'education': 'educação',
  'teaching': 'ensino',
  'health': 'saúde',
  'medicine': 'medicina',
  'nursing': 'enfermagem',
  'dentistry': 'odontologia',
  'pharmacy': 'farmácia',
  'psychology': 'psicologia',
  'law': 'direito',
  'administration': 'administração',
  'economics': 'economia',
  'accounting': 'contabilidade',
  'social': 'social',
  'sociology': 'sociologia',
  'anthropology': 'antropologia',
  'arts': 'artes',
  'music': 'música',
  'architecture': 'arquitetura',
  'urbanism': 'urbanismo',
  'environmental': 'ambiental',
  'agricultural': 'agrícola',
  'veterinary': 'veterinária',
  'animal': 'animal',
  'food': 'alimentos',
  'nutrition': 'nutrição',
  'computer': 'computação',
  'technology': 'tecnologia',
  'management': 'gestão',
  'production': 'produção',
  'clinical': 'clínica',
  'tropical': 'tropical',
  'public': 'pública',
  'applied': 'aplicada',
  'forest': 'florestal',
  'north': 'norte',
  'northeast': 'nordeste',
  'south': 'sul',
  'southeast': 'sudeste',
  'central': 'centro',
};

function expandQuery(q) {
  const terms = q.toLowerCase().split(/\s+/);
  const expanded = [q.toLowerCase()];
  for (const term of terms) {
    if (enToPt[term]) {
      expanded.push(enToPt[term]);
    }
  }
  return expanded;
}

function matchesAny(text, queries) {
  const t = (text || '').toLowerCase();
  return queries.some(q => t.includes(q));
}

export function usePrograms() {
  return useProgramsData();
}

export function findPrograms(data, query) {
  if (!data || !query) return [];
  const queries = expandQuery(query);
  const results = [];
  for (const region of data) {
    for (const state of region.states) {
      for (const uni of state.universities) {
        for (let progIdx = 0; progIdx < uni.programs.length; progIdx++) {
          const prog = uni.programs[progIdx];
          const match =
            matchesAny(uni.name, queries) ||
            matchesAny(uni.acronym, queries) ||
            matchesAny(prog.program, queries) ||
            matchesAny(prog.city, queries) ||
            matchesAny(prog.level, queries);
          if (match) {
            results.push({ region: region.name, state: state.name, university: uni, program: prog, programIdx: progIdx });
          }
        }
      }
    }
  }
  return results;
}

export function getRegionByName(data, name) {
  if (!data) return null;
  return data.find(r => r.name.toLowerCase() === name.toLowerCase());
}


