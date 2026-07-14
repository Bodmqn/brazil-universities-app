import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import Papa from 'papaparse';

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = resolve(__dirname, '../../Brazilian University Sigaa Data/sigaa_final_results.csv');
const programsPath = resolve(__dirname, '../src/assets/data/programs.json');

const csvRaw = readFileSync(csvPath, 'utf-8');
const parsed = Papa.parse(csvRaw, {
  header: true,
  skipEmptyLines: true,
  trim: true,
});

console.log(`SIGAA CSV: ${parsed.data.length} rows, fields: ${parsed.meta.fields.join(', ')}`);

const sigaaMap = new Map();
for (const row of parsed.data) {
  const acronym = (row['Acronym'] || '').trim();
  if (!acronym) continue;
  sigaaMap.set(acronym.toLowerCase(), {
    sigaaUrl: row['SigaaUrl'] || null,
    sigaaStatus: row['Status'] || null,
    sigaaConfirmed: row['IsSigaaPageConfirmed'] === 'Yes' ? true
      : row['IsSigaaPageConfirmed'] === 'No' ? false
      : null,
    sigaaNotes: row['Notes'] || null,
  });
}

const programs = JSON.parse(readFileSync(programsPath, 'utf-8'));

let matched = 0;
let unmatched = [];

for (const region of programs) {
  for (const state of region.states) {
    for (const uni of state.universities) {
      const key = (uni.acronym || '').toLowerCase();
      const data = sigaaMap.get(key);
      if (data) {
        uni.sigaaUrl = data.sigaaUrl;
        uni.sigaaStatus = data.sigaaStatus;
        uni.sigaaConfirmed = data.sigaaConfirmed;
        uni.sigaaNotes = data.sigaaNotes;
        matched++;
        sigaaMap.delete(key);
      } else {
        uni.sigaaUrl = null;
        uni.sigaaStatus = null;
        uni.sigaaConfirmed = null;
        uni.sigaaNotes = null;
        unmatched.push(`${uni.acronym || uni.name}`);
      }
    }
  }
}

writeFileSync(programsPath, JSON.stringify(programs, null, 2), 'utf-8');

console.log(`Matched ${matched} universities with SIGAA data`);
console.log(`Unmatched CSV entries: ${[...sigaaMap.keys()].join(', ') || 'none'}`);
console.log(`Programs without SIGAA match: ${unmatched.length}`);
console.log(`Output: ${programsPath}`);
