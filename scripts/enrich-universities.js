#!/usr/bin/env node
/**
 * Unified university enrichment pipeline.
 *
 * Merges data from the SIGAA CSV and master JSON into programs.json,
 * adds missing universities, and cleans up structural issues.
 *
 * Usage:
 *   node scripts/enrich-universities.js                  # run all steps
 *   node scripts/enrich-universities.js --dry-run        # preview only
 *   node scripts/enrich-universities.js --step sigaa     # run one step
 *   node scripts/enrich-universities.js --no-backup      # skip backup
 *   node scripts/enrich-universities.js --csv path.csv   # custom CSV
 *   node scripts/enrich-universities.js --master path.json # custom master
 *
 * Steps:
 *   add-missing  — add universities from CSV not yet in programs.json
 *   cleanup      — remove undefined regions/states, merge duplicate programs
 *   sigaa        — enrich with SIGAA portal data from CSV
 *   master       — enrich with master university metadata
 *   all          — run all steps in order (default)
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import Papa from 'papaparse';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

function flag(name) { return args.includes('--' + name); }
function option(name, fallback) {
  const i = args.indexOf('--' + name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const DRY_RUN   = flag('dry-run');
const NO_BACKUP = flag('no-backup');
const STEP      = option('step', 'all');
const CSV_PATH  = option('csv',
  resolve(dirname(fileURLToPath(import.meta.url)), '../../Brazilian University Sigaa Data/sigaa_final_results.csv'));
const MASTER_PATH = option('master',
  resolve(dirname(fileURLToPath(import.meta.url)), '../data/brazil_universities_master.json'));
const PROGRAMS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../src/assets/data/programs.json');

// ---------------------------------------------------------------------------
// Region / state normalization maps
// ---------------------------------------------------------------------------
const REGION_MAP = {
  norte: 'Norte',
  nordeste: 'Nordeste',
  'centro-oeste': 'Centro-Oeste',
  sudeste: 'Sudeste',
  sul: 'Sul',
};

const STATE_MAP = {
  'bahia': 'Bahía',
  'rio grande do norte': 'Rio Grande do Norte',
  'rio grande do sul': 'Rio Grande do Sul',
  'mato grosso do sul': 'Mato Grosso do Sul',
};

const MULTI_STATE = {
  'unilab': 'Ceará',
  'uffs': 'Rio Grande do Sul',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadCSV(path) {
  const raw = readFileSync(path, 'utf-8');
  return Papa.parse(raw, { header: true, skipEmptyLines: true, trim: true });
}

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function saveJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

function backup(path) {
  if (NO_BACKUP || DRY_RUN) return;
  const bak = path + '.bak';
  if (!existsSync(bak)) {
    copyFileSync(path, bak);
    console.log(`  Backup: ${bak}`);
  }
}

function findRegionIndex(programs, name) {
  for (let i = 0; i < programs.length; i++) {
    if (programs[i].name && programs[i].name.toLowerCase() === name.toLowerCase()) return i;
  }
  return -1;
}

function findOrCreateState(programs, regionIndex, stateName) {
  const region = programs[regionIndex];
  for (let i = 0; i < region.states.length; i++) {
    if (region.states[i].name && region.states[i].name.toLowerCase() === stateName.toLowerCase()) return i;
  }
  region.states.push({ name: stateName, universities: [] });
  return region.states.length - 1;
}

function collectAcronyms(programs) {
  const set = new Set();
  for (const r of programs)
    for (const s of r.states)
      for (const u of s.universities)
        set.add((u.acronym || '').toLowerCase());
  return set;
}

function totalUniversities(programs) {
  let n = 0;
  for (const r of programs) for (const s of r.states) n += s.universities.length;
  return n;
}

function totalPrograms(programs) {
  let n = 0;
  for (const r of programs) for (const s of r.states)
    for (const u of s.universities) n += (u.programs || []).length;
  return n;
}

function validate(programs) {
  const issues = [];
  for (let ri = 0; ri < programs.length; ri++) {
    if (!programs[ri].name) issues.push(`Undefined region at index ${ri}`);
    for (const s of programs[ri].states) {
      if (!s.name) issues.push(`Undefined state in region "${programs[ri].name}"`);
    }
  }
  // Check duplicate acronyms
  const seen = new Map();
  for (const r of programs) for (const s of r.states) for (const u of s.universities) {
    const ac = (u.acronym || '').toLowerCase();
    if (seen.has(ac)) {
      const prev = seen.get(ac);
      issues.push(`Duplicate acronym ${u.acronym}: "${prev.region}/${prev.state}" and "${r.name}/${s.name}"`);
    }
    seen.set(ac, { region: r.name, state: s.name });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// STEP: Add missing universities
// ---------------------------------------------------------------------------
function stepAddMissing(programs, csvParsed, masterMap) {
  const appAcronyms = collectAcronyms(programs);
  let added = 0;
  const addedList = [];

  for (const row of csvParsed.data) {
    const acronym = (row['Acronym'] || '').trim();
    if (!acronym) continue;
    const key = acronym.toLowerCase();
    if (appAcronyms.has(key)) continue;

    const csvRegion = (row['Region'] || '').trim();
    const regionName = REGION_MAP[csvRegion.toLowerCase()];
    if (!regionName) { console.log(`  Skip ${acronym}: unknown region "${csvRegion}"`); continue; }
    const regionIndex = findRegionIndex(programs, regionName);
    if (regionIndex === -1) { console.log(`  Skip ${acronym}: region "${regionName}" not in programs`); continue; }

    let csvState = (row['State'] || '').trim();
    if (MULTI_STATE[key]) csvState = MULTI_STATE[key];
    const stateName = STATE_MAP[csvState.toLowerCase()] || csvState;
    const stateIndex = findOrCreateState(programs, regionIndex, stateName);

    const md = masterMap.get(key);
    const uni = {
      name: row['Name'] || '',
      acronym,
      programs: [],
      sigaaUrl: row['SigaaUrl'] || null,
      sigaaStatus: row['Status'] || null,
      sigaaConfirmed: row['IsSigaaPageConfirmed'] === 'Yes' ? true
        : row['IsSigaaPageConfirmed'] === 'No' ? false : null,
      sigaaNotes: row['Notes'] || null,
      website: null, category: null, qsRanking: null, theRanking: null,
      graduatePageUrl: null, mastersCount: null, phdCount: null,
      englishProgrammes: null, intOfficeEmail: null, intOfficePhone: null,
      intOfficeUrl: null,
    };

    if (md) {
      uni.website = md.website || null;
      uni.category = md.category || null;
      uni.qsRanking = md.qs_ranking || null;
      uni.theRanking = md.the_ranking || null;
      uni.graduatePageUrl = md.graduate_page_url || null;
      uni.mastersCount = md.masters_count ?? null;
      uni.phdCount = md.phd_count ?? null;
      uni.englishProgrammes = md.english_programmes || null;
      uni.intOfficeEmail = md.int_office_email || null;
      uni.intOfficePhone = md.int_office_phone || null;
      uni.intOfficeUrl = md.int_office_url || null;
    }

    programs[regionIndex].states[stateIndex].universities.push(uni);
    appAcronyms.add(key);
    added++;
    addedList.push(`${acronym} → ${regionName}/${stateName}` + (md ? ' (master ✓)' : ''));
  }

  console.log(`\n  Added ${added} missing universities`);
  for (const line of addedList) console.log(`    ✓ ${line}`);
  return added;
}

// ---------------------------------------------------------------------------
// STEP: Clean up undefined regions/states
// ---------------------------------------------------------------------------
function stepCleanup(programs, csvParsed, masterMap) {
  let removedRegions = 0;
  let removedStates = 0;
  let promoted = 0;
  let placed = 0;
  let merged = 0;

  // Build index of universities in named regions
  const namedMap = new Map(); // acronym → { regionIndex, stateIndex, uniIndex, programCount }
  for (let ri = 0; ri < programs.length; ri++) {
    if (!programs[ri].name) continue;
    for (let si = 0; si < programs[ri].states.length; si++) {
      for (let ui = 0; ui < programs[ri].states[si].universities.length; ui++) {
        const ac = (programs[ri].states[si].universities[ui].acronym || '').toLowerCase();
        namedMap.set(ac, {
          regionIndex: ri, stateIndex: si, uniIndex: ui,
          programCount: (programs[ri].states[si].universities[ui].programs || []).length,
        });
      }
    }
  }

  // Process each undefined region
  for (const region of programs) {
    if (region.name) continue;

    for (const state of region.states) {
      for (const uni of state.universities) {
        const ac = (uni.acronym || '').toLowerCase();
        const named = namedMap.get(ac);
        const undefProgs = uni.programs || [];

        if (named) {
          // University exists in named region — MERGE programs
          const namedUni = programs[named.regionIndex].states[named.stateIndex].universities[named.uniIndex];
          const namedUrls = new Set((namedUni.programs || []).map(p => p.url).filter(Boolean));
          let addedCount = 0;
          for (const prog of undefProgs) {
            if (prog.url && !namedUrls.has(prog.url)) {
              namedUni.programs.push(prog);
              namedUrls.add(prog.url);
              addedCount++;
            }
          }
          if (addedCount > 0) {
            merged++;
            console.log(`    Merged ${addedCount} programs into ${ac} (${namedUni.programs.length} total)`);
          }

          // Also promote metadata if undefined version has more data
          if (undefProgs.length > named.programCount) {
            // Update university-level fields from undefined copy if they're richer
            for (const field of ['website', 'category', 'graduatePageUrl']) {
              if (uni[field] && !namedUni[field]) namedUni[field] = uni[field];
            }
            promoted++;
          }
        } else {
          // University only in undefined region — place it
          const csvRow = csvParsed.data.find(r => (r['Acronym'] || '').trim().toLowerCase() === ac);
          if (csvRow) {
            const csvRegion = (csvRow['Region'] || '').trim();
            const regionName = REGION_MAP[csvRegion.toLowerCase()];
            if (regionName) {
              const ri = findRegionIndex(programs, regionName);
              if (ri !== -1) {
                let csvState = (csvRow['State'] || '').trim();
                if (MULTI_STATE[ac]) csvState = MULTI_STATE[ac];
                const stateName = STATE_MAP[csvState.toLowerCase()] || csvState;
                const si = findOrCreateState(programs, ri, stateName);
                programs[ri].states[si].universities.push(uni);
                placed++;
                console.log(`    Placed ${ac} → ${regionName}/${stateName} (${undefProgs.length} progs)`);
              }
            }
          } else {
            console.log(`    ⚠ ${ac} could not be placed (no CSV data)`);
          }
        }
      }
    }
  }

  // Remove undefined regions
  for (let ri = programs.length - 1; ri >= 0; ri--) {
    if (!programs[ri].name) {
      const count = programs[ri].states.reduce((s, st) => s + st.universities.length, 0);
      programs.splice(ri, 1);
      removedRegions++;
    }
  }

  // Remove undefined states within named regions
  for (const region of programs) {
    if (!region.name) continue;
    for (let si = region.states.length - 1; si >= 0; si--) {
      if (!region.states[si].name) {
        removedStates += region.states[si].universities.length;
        region.states.splice(si, 1);
      }
    }
  }

  console.log(`\n  Cleanup: ${promoted} promoted, ${merged} merged, ${placed} placed`);
  console.log(`  Removed: ${removedRegions} undefined regions, ${removedStates} undefined state entries`);
}

// ---------------------------------------------------------------------------
// STEP: Merge SIGAA data
// ---------------------------------------------------------------------------
function stepSigaa(programs, csvParsed) {
  const sigaaMap = new Map();
  for (const row of csvParsed.data) {
    const ac = (row['Acronym'] || '').trim();
    if (!ac) continue;
    sigaaMap.set(ac.toLowerCase(), {
      sigaaUrl: row['SigaaUrl'] || null,
      sigaaStatus: row['Status'] || null,
      sigaaConfirmed: row['IsSigaaPageConfirmed'] === 'Yes' ? true
        : row['IsSigaaPageConfirmed'] === 'No' ? false : null,
      sigaaNotes: row['Notes'] || null,
    });
  }

  let matched = 0;
  let unmatched = 0;
  for (const r of programs) for (const s of r.states) for (const u of s.universities) {
    const data = sigaaMap.get((u.acronym || '').toLowerCase());
    if (data) {
      Object.assign(u, data);
      matched++;
    } else {
      unmatched++;
    }
  }

  console.log(`\n  SIGAA: ${matched} matched, ${unmatched} unmatched`);
}

// ---------------------------------------------------------------------------
// STEP: Merge master data
// ---------------------------------------------------------------------------
function stepMaster(programs, masterMap) {
  let matched = 0;
  let unmatched = 0;
  for (const r of programs) for (const s of r.states) for (const u of s.universities) {
    const data = masterMap.get((u.acronym || '').toLowerCase());
    if (data) {
      Object.assign(u, data);
      matched++;
    } else {
      unmatched++;
    }
  }

  console.log(`\n  Master: ${matched} matched, ${unmatched} unmatched`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log('=== Enrich Universities Pipeline ===');
  if (DRY_RUN) console.log('  MODE: dry-run (no files will be modified)\n');

  // Load sources
  console.log('Loading sources...');
  const csvParsed = loadCSV(CSV_PATH);
  const csvRows = csvParsed.data.filter(r => (r['Acronym'] || '').trim());
  console.log(`  CSV: ${csvRows.length} universities from ${CSV_PATH}`);

  const master = loadJSON(MASTER_PATH);
  const masterMap = new Map();
  for (const u of master) {
    const key = (u.acronym || '').toLowerCase();
    if (key) masterMap.set(key, u);
  }
  console.log(`  Master: ${master.length} universities from ${MASTER_PATH}`);

  const programs = loadJSON(PROGRAMS_PATH);
  console.log(`  Programs: ${totalUniversities(programs)} universities, ${totalPrograms(programs)} programs\n`);

  const beforeUnis = totalUniversities(programs);
  const beforeProgs = totalPrograms(programs);

  // Run steps
  const steps = STEP === 'all' ? ['add-missing', 'cleanup', 'sigaa', 'master'] : [STEP];

  for (const step of steps) {
    console.log(`--- Step: ${step} ---`);
    switch (step) {
      case 'add-missing': stepAddMissing(programs, csvParsed, masterMap); break;
      case 'cleanup':     stepCleanup(programs, csvParsed, masterMap); break;
      case 'sigaa':       stepSigaa(programs, csvParsed); break;
      case 'master':      stepMaster(programs, masterMap); break;
      default: console.log(`  Unknown step: ${step}`);
    }
  }

  // Validate
  console.log('\n--- Validation ---');
  const issues = validate(programs);
  if (issues.length) {
    console.log(`  ${issues.length} issues found:`);
    for (const issue of issues) console.log(`    ⚠ ${issue}`);
  } else {
    console.log('  ✓ No issues');
  }

  // Summary
  const afterUnis = totalUniversities(programs);
  const afterProgs = totalPrograms(programs);
  console.log('\n--- Summary ---');
  console.log(`  Universities: ${beforeUnis} → ${afterUnis} (${afterUnis - beforeUnis >= 0 ? '+' : ''}${afterUnis - beforeUnis})`);
  console.log(`  Programs:    ${beforeProgs} → ${afterProgs} (${afterProgs - beforeProgs >= 0 ? '+' : ''}${afterProgs - beforeProgs})`);
  console.log(`  Regions:     ${programs.filter(r => r.name).length}`);

  // Save
  if (DRY_RUN) {
    console.log('\n  Dry-run complete. No files modified.');
  } else {
    backup(PROGRAMS_PATH);
    saveJSON(PROGRAMS_PATH, programs);
    console.log(`\n  Saved: ${PROGRAMS_PATH}`);
  }
}

main();
