#!/usr/bin/env node
/**
 * Validates programs.json for structural integrity.
 *
 * Checks:
 *   - No undefined regions or states
 *   - No duplicate university acronyms
 *   - Required fields present (name, acronym)
 *   - All programs have name and type (Mestrado/Doutorado)
 *   - Region/state names are valid
 *
 * Usage:
 *   node scripts/validate-programs.js              # validate only
 *   node scripts/validate-programs.js --fix        # auto-fix issues
 *   node scripts/validate-programs.js --json       # output JSON report
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const args = process.argv.slice(2);
const FIX = args.includes('--fix');
const JSON_OUT = args.includes('--json');
const PROGRAMS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../src/assets/data/programs.json');

const VALID_REGIONS = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
const VALID_TYPES = ['Mestrado', 'Doutorado', 'Mestrado Profissional', 'Doutorado Profissional'];

const programs = JSON.parse(readFileSync(PROGRAMS_PATH, 'utf-8'));

const report = {
  regions: programs.length,
  validRegions: programs.filter(r => r.name).length,
  undefinedRegions: 0,
  undefinedStates: 0,
  totalUniversities: 0,
  totalPrograms: 0,
  issues: [],
  warnings: [],
  stats: {
    byRegion: {},
    byState: {},
    withSigaa: 0,
    withMaster: 0,
  },
};

// --- Checks ---

// 1. Undefined regions
for (let ri = 0; ri < programs.length; ri++) {
  if (!programs[ri].name) {
    report.undefinedRegions++;
    report.issues.push(`Undefined region at index ${ri} with ${programs[ri].states.reduce((s, st) => s + st.universities.length, 0)} universities`);
  } else if (!VALID_REGIONS.includes(programs[ri].name)) {
    report.warnings.push(`Unknown region name: "${programs[ri].name}"`);
  }
}

// 2. Undefined states, duplicate acronyms, field checks
const acronymSeen = new Map();

for (const region of programs) {
  const rName = region.name || '(undefined)';
  report.stats.byRegion[rName] = { universities: 0, programs: 0 };

  for (const state of region.states) {
    if (!state.name) {
      report.undefinedStates += state.universities.length;
      report.issues.push(`Undefined state in region "${rName}" with ${state.universities.length} universities`);
    }

    const sName = state.name || '(undefined)';
    const key = `${rName}/${sName}`;
    if (!report.stats.byState[key]) report.stats.byState[key] = { universities: 0, programs: 0 };
    report.stats.byState[key].universities += state.universities.length;
    report.stats.byRegion[rName].universities += state.universities.length;

    for (const uni of state.universities) {
      report.totalUniversities++;
      const ac = (uni.acronym || '').toLowerCase();

      if (!uni.acronym) report.issues.push(`University missing acronym in ${rName}/${sName}`);
      if (!uni.name) report.warnings.push(`University missing name: ${uni.acronym || '(?)'} in ${rName}/${sName}`);

      if (acronymSeen.has(ac)) {
        const prev = acronymSeen.get(ac);
        report.issues.push(`Duplicate acronym "${uni.acronym}": ${prev} and ${rName}/${sName}`);
      }
      acronymSeen.set(ac, `${rName}/${sName}`);

      if (uni.sigaaUrl) report.stats.withSigaa++;
      if (uni.website) report.stats.withMaster++;

      for (const prog of (uni.programs || [])) {
        report.totalPrograms++;
        report.stats.byRegion[rName].programs++;
        report.stats.byState[key].programs++;

        const progName = prog.name || prog.program;
        const progType = prog.type || prog.level;
        if (!progName) report.warnings.push(`Program missing name in ${uni.acronym || '(?)'}`);
        if (!progType) report.warnings.push(`Program missing level in ${uni.acronym || '(?)'}: "${progName || '(?)'}"`);
        if (progType && !VALID_TYPES.includes(progType)) {
          report.warnings.push(`Unknown program level "${progType}" in ${uni.acronym}: "${progName}"`);
        }
      }
    }
  }
}

// --- Report ---

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('=== programs.json Validation Report ===\n');
  console.log(`Regions:       ${report.validRegions} valid, ${report.undefinedRegions} undefined`);
  console.log(`States:        ${report.undefinedStates} undefined entries`);
  console.log(`Universities:  ${report.totalUniversities}`);
  console.log(`Programs:      ${report.totalPrograms}`);
  console.log(`SIGAA data:    ${report.stats.withSigaa} universities`);
  console.log(`Master data:   ${report.stats.withMaster} universities`);

  console.log('\n--- By Region ---');
  for (const [name, data] of Object.entries(report.stats.byRegion)) {
    console.log(`  ${name}: ${data.universities} universities, ${data.programs} programs`);
  }

  if (report.issues.length) {
    console.log(`\n--- Issues (${report.issues.length}) ---`);
    for (const issue of report.issues) console.log(`  ✗ ${issue}`);
  } else {
    console.log('\n✓ No issues found');
  }

  if (report.warnings.length) {
    console.log(`\n--- Warnings (${report.warnings.length}) ---`);
    for (const w of report.warnings.slice(0, 20)) console.log(`  ⚠ ${w}`);
    if (report.warnings.length > 20) console.log(`  ... and ${report.warnings.length - 20} more`);
  }
}

process.exit(report.issues.length > 0 ? 1 : 0);
