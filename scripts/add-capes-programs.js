#!/usr/bin/env node
/**
 * Extracts program data from CAPES 2024 CSV and merges into programs.json
 * for universities that currently have 0 programs.
 *
 * Usage:
 *   node scripts/add-capes-programs.js
 *   node scripts/add-capes-programs.js --dry-run
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import Papa from 'papaparse';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROGRAMS_PATH = resolve(__dirname, '../src/assets/data/programs.json');
const CAPES_PATH = resolve(__dirname, '../capes_2024.csv');

// Map CAPES level -> our level
function mapLevel(capesLevel) {
  const map = {
    'MESTRADO': 'Mestrado',
    'DOUTORADO': 'Doutorado',
    'MESTRADO PROFISSIONAL': 'Mestrado Profissional',
    'DOUTORADO PROFISSIONAL': 'Doutorado Profissional',
  };
  return map[capesLevel] || capesLevel;
}

// Split combined level entries
function splitCombined(capesLevel) {
  const parts = capesLevel.split('/');
  if (parts.length > 1) {
    return parts.map(p => mapLevel(p.trim()));
  }
  return [mapLevel(capesLevel)];
}

// Map acronym overrides for multi-campus entries
const ACRONYM_MAP = {
  'UFPB-JOÃO PESSOA': 'UFPB',
  'UFPB-AREIA': 'UFPB',
  'UFPB-RIO TINTO': 'UFPB',
  'UFPB-BANANEIRAS': 'UFPB',
  'UFS-ITABAIANA': 'UFS',
  'UFJF-G. VALADARES': 'UFJF',
  'UNILAB-MALÊS': 'UNILAB',
  'USP-RIBEIRÃO PRETO': 'USP',
  'USP-ESALQ': 'USP',
  'USP-SÃO CARLOS': 'USP',
  'USP-FOB': 'USP',
  'USP-CENA': 'USP',
  'USP-EEL': 'USP',
};

// Universities that need data (from the 50 empty list)
const TARGET_ACRONYMS = new Set([
  'ufra','ufopa','uepa','uerr','unitins','ufnt','unir','ufba','uva','unilab',
  'urca','uemasul','ufma','uepb','ufpb','ufape','uespi','ufdpar','ufrn','uern',
  'uneal','uncisal','ufal','ufs','ufcat','ufr','ufms','uem','uepg','unicentro',
  'uenp','unioeste','unespar','unila','uergs','unipampa','ufsc','udesc',
  'unimontes','unifei','ufjf','uezo','uenf','uff','unirio','ufrj','uerj',
  'ufabc','univesp','usp',
]);

function main() {
  console.log('=== Add CAPES Programs ===');
  if (DRY_RUN) console.log('  MODE: dry-run\n');

  // Load sources
  const rawCapes = readFileSync(CAPES_PATH, 'utf-8');
  const capes = Papa.parse(rawCapes, { header: true, skipEmptyLines: true, trim: true });
  console.log(`CAPES: ${capes.data.length} program rows loaded`);

  const programs = JSON.parse(readFileSync(PROGRAMS_PATH, 'utf-8'));

  // Build map: normalized CAPES acronym -> programs
  const capesMap = new Map(); // acronym lowercase -> [{...}]
  for (const row of capes.data) {
    let ac = (row['SG_ENTIDADE_ENSINO'] || '').trim();
    if (!ac) continue;
    ac = ACRONYM_MAP[ac] || ac;
    const key = ac.toLowerCase();
    if (!capesMap.has(key)) capesMap.set(key, []);
    capesMap.get(key).push(row);
  }

  let totalAdded = 0;
  let universitiesFilled = 0;

  for (const region of programs) {
    for (const state of region.states) {
      for (const uni of state.universities) {
        const acKey = (uni.acronym || '').toLowerCase();
        const progCount = (uni.programs || []).length;

        // Skip if university already has programs
        if (progCount > 0) continue;

        // Skip if not in target list
        if (!TARGET_ACRONYMS.has(acKey)) continue;

        const capesRows = capesMap.get(acKey);
        if (!capesRows || capesRows.length === 0) {
          console.log(`  ${uni.acronym}: no CAPES data`);
          continue;
        }

        // Build program entries from CAPES rows
        const seen = new Set(); // deduplicate by (program name + level)
        const newPrograms = [];

        for (const row of capesRows) {
          const progName = (row['NM_PROGRAMA_IES'] || '').trim();
          if (!progName) continue;

          const levels = splitCombined((row['NM_GRAU_PROGRAMA'] || '').trim());

          for (const level of levels) {
            const dedupKey = `${progName}|${level}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);

            const city = (row['NM_MUNICIPIO_PROGRAMA_IES'] || '').trim();
            const startYear = (row['AN_INICIO_CURSO'] || '').trim();
            const startDate = startYear ? `01/01/${startYear}` : null;

            newPrograms.push({
              level,
              program: progName,
              masterRequired: '',
              url: null,
              city,
              campus: null,
              startDate,
              duration: null,
              languageRequirement: null,
            });
          }
        }

        if (newPrograms.length > 0) {
          uni.programs = newPrograms;
          totalAdded += newPrograms.length;
          universitiesFilled++;
          console.log(`  ✓ ${uni.acronym}: +${newPrograms.length} programs (${state.name}, ${region.name})`);
        }
      }
    }
  }

  // Summary
  console.log(`\n--- Summary ---`);
  console.log(`  Universities filled: ${universitiesFilled}`);
  console.log(`  Programs added: ${totalAdded}`);

  // Count remaining zeros
  let stillZero = 0;
  const stillZeroList = [];
  for (const r of programs) for (const s of r.states) for (const u of s.universities) {
    if ((u.programs || []).length === 0) {
      stillZero++;
      stillZeroList.push(u.acronym);
    }
  }
  console.log(`  Still with 0 programs: ${stillZero}`);
  if (stillZeroList.length > 0) {
    console.log(`  Remaining: ${stillZeroList.join(', ')}`);
  }

  if (!DRY_RUN) {
    const bak = PROGRAMS_PATH + '.bak2';
    if (!existsSync(bak)) {
      copyFileSync(PROGRAMS_PATH, bak);
      console.log(`\n  Backup: ${bak}`);
    }
    writeFileSync(PROGRAMS_PATH, JSON.stringify(programs, null, 2), 'utf-8');
    console.log(`  Saved: ${PROGRAMS_PATH}`);
  } else {
    console.log(`\n  Dry-run complete. No files modified.`);
  }
}

main();
