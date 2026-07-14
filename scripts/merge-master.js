import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const masterPath = resolve(__dirname, '../data/brazil_universities_master.json');
const programsPath = resolve(__dirname, '../src/assets/data/programs.json');

const master = JSON.parse(readFileSync(masterPath, 'utf-8'));
console.log(`Master JSON: ${master.length} universities`);

const masterMap = new Map();
for (const uni of master) {
  const key = (uni.acronym || '').toLowerCase();
  if (!key) continue;
  masterMap.set(key, {
    website: uni.website || null,
    category: uni.category || null,
    qsRanking: uni.qs_ranking || null,
    theRanking: uni.the_ranking || null,
    graduatePageUrl: uni.graduate_page_url || null,
    mastersCount: uni.masters_count ?? null,
    phdCount: uni.phd_count ?? null,
    englishProgrammes: uni.english_programmes || null,
    intOfficeEmail: uni.int_office_email || null,
    intOfficePhone: uni.int_office_phone || null,
    intOfficeUrl: uni.int_office_url || null,
  });
}

const programs = JSON.parse(readFileSync(programsPath, 'utf-8'));

let matched = 0;
const unmatchedMaster = [];

for (const region of programs) {
  for (const state of region.states) {
    for (const uni of state.universities) {
      const key = (uni.acronym || '').toLowerCase();
      const data = masterMap.get(key);
      if (data) {
        Object.assign(uni, data);
        matched++;
        masterMap.delete(key);
      } else {
        unmatchedMaster.push(`${uni.acronym || uni.name}`);
      }
    }
  }
}

unmatchedMaster.forEach(a => console.log(`  No match in programs: ${a}`));

writeFileSync(programsPath, JSON.stringify(programs, null, 2), 'utf-8');

console.log(`Matched ${matched} universities with master data`);
console.log(`Master entries not found in programs: ${[...masterMap.keys()].join(', ') || 'none'}`);
console.log(`Output: ${programsPath}`);
