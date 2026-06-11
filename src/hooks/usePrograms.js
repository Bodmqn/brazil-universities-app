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

export function usePrograms() {
  return useProgramsData();
}

export function findPrograms(data, query) {
  if (!data || !query) return [];
  const q = query.toLowerCase();
  const results = [];
  for (const region of data) {
    for (const state of region.states) {
      for (const uni of state.universities) {
        for (const prog of uni.programs) {
          const match =
            uni.name.toLowerCase().includes(q) ||
            uni.acronym.toLowerCase().includes(q) ||
            prog.program.toLowerCase().includes(q) ||
            prog.city.toLowerCase().includes(q) ||
            prog.level.toLowerCase().includes(q);
          if (match) {
            results.push({ region: region.name, state: state.name, university: uni, program: prog });
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


