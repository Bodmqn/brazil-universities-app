import { useState, useEffect, useMemo } from 'react';
import { regionMap, stateMap, uniNameMap, levelMap, termDict, langReqMap, generalTerms } from '../utils/translations-data';

let cached = null;
let cachedStatus = null;
let cachedDiscovered = null;

function translateProgramName(ptName) {
  if (!ptName) return ptName;
  let en = ptName;

  const allTerms = [...Object.entries(termDict), ...Object.entries(generalTerms)];
  allTerms.sort((a, b) => b[0].length - a[0].length);

  for (const [pt, enVal] of allTerms) {
    const escaped = pt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'gi');
    if (re.test(en)) {
      en = en.replace(re, enVal);
    }
  }
  en = en
    .replace(/\s+/g, ' ')
    .replace(/ ,/g, ',')
    .replace(/ \//g, '/')
    .replace(/\/ /g, '/')
    .trim();
  if (en === ptName) return ptName;
  return en;
}

const WORD_LANG_MAP = {
  'português': 'Portuguese',
  'portugués': 'Portuguese',
  'ingles': 'English',
  'inglês': 'English',
  'espanhol': 'Spanish',
  'francês': 'French',
  'frances': 'French',
  'alemão': 'German',
  'alemao': 'German',
  'italiano': 'Italian',
  'japonês': 'Japanese',
  'mandarim': 'Mandarin',
  'básico': 'Basic',
  'basico': 'Basic',
  'intermediário': 'Intermediate',
  'intermediario': 'Intermediate',
  'avançado': 'Advanced',
  'avancado': 'Advanced',
  'fluente': 'Fluent',
  'nativo': 'Native',
  'leitura': 'Reading',
  'escrita': 'Writing',
  'conversação': 'Conversation',
  'compreensão': 'Comprehension',
  'proficiência': 'Proficiency',
  'certificado': 'Certificate',
  'nível': 'Level',
  'nivel': 'Level',
  'mínimo': 'Minimum',
  'minimo': 'Minimum',
  'obrigatório': 'Mandatory',
  'obrigatorio': 'Mandatory',
  'desejável': 'Desirable',
  'desejavel': 'Desirable',
  'domínio': 'Mastery',
  'domino': 'Mastery',
};

function translateLanguageReq(pt) {
  if (!pt) return pt;
  let en = pt;

  const sorted = Object.entries(langReqMap).sort((a, b) => b[0].length - a[0].length);
  for (const [ptKey, enVal] of sorted) {
    const escaped = ptKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'gi');
    if (re.test(en)) {
      en = en.replace(re, enVal);
    }
  }

  const wordSorted = Object.entries(WORD_LANG_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [ptWord, enWord] of wordSorted) {
    const re = new RegExp(`\\b${ptWord}\\b`, 'gi');
    if (re.test(en)) {
      en = en.replace(re, enWord);
    }
  }

  en = en.replace(/\s+/g, ' ').trim();
  return en;
}

function translateData(data, lang) {
  if (lang === 'pt' || !data) return data;

  function walk(d) {
    if (Array.isArray(d)) return d.map(walk);
    if (d && typeof d === 'object') {
      const copy = {};
      for (const [key, val] of Object.entries(d)) {
        if (key === 'name' && regionMap[val]) {
          copy[key] = regionMap[val] || val;
        } else if (key === 'name' && stateMap[val]) {
          copy[key] = stateMap[val] || val;
        } else if (key === 'name' && uniNameMap[val]) {
          copy[key] = uniNameMap[val] || val;
        } else if (key === 'level' && levelMap[val]) {
          copy[key] = levelMap[val] || val;
        } else if (key === 'program') {
          copy[key] = translateProgramName(val);
        } else if (key === 'languageRequirement') {
          copy[key] = translateLanguageReq(String(val));
        } else if (key === 'masterRequired') {
          const v = String(val).toLowerCase();
          if (v === 'sim') copy[key] = 'Yes';
          else if (v === 'não' || v === 'nao') copy[key] = 'No';
          else copy[key] = val;
        } else {
          copy[key] = walk(val);
        }
      }
      return copy;
    }
    return d;
  }

  return walk(data);
}

export function useProgramsData() {
  const [data, setData] = useState(cached);
  const [statusMap, setStatusMap] = useState(cachedStatus);
  const [discovered, setDiscovered] = useState(cachedDiscovered);
  const [loading, setLoading] = useState(!cached || !cachedStatus);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      import('../assets/data/programs.json'),
      import('../assets/data/program-status.json').catch(() => ({ default: { programs: {} } }))
    ])
      .then(([progsMod, statusMod]) => {
        cached = progsMod.default || progsMod;
        const statusFile = statusMod.default || statusMod;
        cachedStatus = statusFile.programs || {};
        cachedDiscovered = statusFile.discovered || null;
        setData(cached);
        setStatusMap(cachedStatus);
        setDiscovered(cachedDiscovered);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { data, statusMap, discovered, loading, error };
}

export function usePrograms(lang = 'pt') {
  const { data, statusMap, discovered, loading, error } = useProgramsData();
  const translatedData = useMemo(() => translateData(data, lang), [data, lang]);
  return { data: translatedData, statusMap, discovered, loading, error };
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


