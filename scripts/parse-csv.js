import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import Papa from 'papaparse';

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = resolve(__dirname, '../src/assets/data/programs.csv');
const outPath = resolve(__dirname, '../src/assets/data/programs.json');

const raw = readFileSync(csvPath, 'latin1');
const lines = raw
  .replace(/\r\n/g, '\n')
  .replace(/\u2013/g, '-')
  .replace(/\u2019/g, "'")
  .replace(/\u00a0/g, ' ')
  .split('\n');

const headerRow = lines.findIndex(l => l.includes('Regiao') || l.includes('Região'));
if (headerRow === -1) { console.error('Could not find header row'); process.exit(1); }

const headerLine = lines[headerRow];
const dataLines = lines.slice(headerRow + 1).filter(l => l.trim());

const csvContent = [headerLine, ...dataLines].join('\n');

const result = Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true,
  delimiter: ',',
  transform: v => (v || '').trim().replace(/\s+/g, ' ')
});

console.log('Headers:', result.meta.fields);
console.log('Row count:', result.data.length);
console.log('Sample row:', JSON.stringify(result.data[0]).slice(0, 600));

const headerField = Object.keys(result.data[0] || {});
const siglaField = headerField.find(k => /sigla/i.test(k));
const programField = headerField.find(k => /program/i.test(k) || /curso/i.test(k));
const regionField = headerField.find(k => /regiao|região/i.test(k));
const stateField = headerField.find(k => /estado/i.test(k));
const uniField = headerField.find(k => /universidade/i.test(k));
const websiteField = headerField.find(k => /website/i.test(k));
const cityField = headerField.find(k => /cidade/i.test(k));
const campusField = headerField.find(k => /campus/i.test(k));
const startField = headerField.find(k => /inicio|início/i.test(k));
const durationField = headerField.find(k => /dura/i.test(k));
const langField = headerField.find(k => /idioma/i.test(k));
const levelField = headerField.find(k => /nivel|nível/i.test(k));
const masterField = headerField.find(k => /doutorado.*mestre|mestre.*requisito/i.test(k));

console.log({ siglaField, programField, regionField, stateField, uniField, websiteField, cityField, campusField, startField, durationField, langField, levelField, masterField });

const qualified = result.data.filter(r => r[siglaField] && r[programField]);

let lastRegion = '', lastState = '', lastUni = '';
for (const row of qualified) {
  if (row[regionField]) lastRegion = row[regionField];
  else row[regionField] = lastRegion;

  if (row[stateField]) lastState = row[stateField];
  else row[stateField] = lastState;

  if (row[uniField]) lastUni = row[uniField];
  else row[uniField] = lastUni;
}

const rows = qualified;

const regionsMap = new Map();

for (const row of rows) {
  const region = row[regionField] || 'Unknown';
  const state = row[stateField] || 'Unknown';
  const uniName = (row[uniField] || '').trim().replace(/\s+/g, ' ');
  const acronym = row[siglaField] || '';
  const level = row[levelField] || '';
  const program = row[programField] || '';
  const url = row[websiteField] || '';
  const city = row[cityField] || '';
  const campus = (row[campusField] || '').replace(/\n/g, ' ');
  const startDate = row[startField] || '';
  const duration = row[durationField] || '';
  const languageReq = (row[langField] || '').replace(/\n/g, ' ');
  const masterReq = row[masterField] || '';

  if (!regionsMap.has(region)) regionsMap.set(region, new Map());
  const states = regionsMap.get(region);

  if (!states.has(state)) states.set(state, new Map());
  const universities = states.get(state);

  const uniKey = acronym || uniName;
  if (!universities.has(uniKey)) {
    universities.set(uniKey, { name: uniName, acronym, programs: [] });
  }
  const uni = universities.get(uniKey);
  uni.name = uniName || uni.name;

  uni.programs.push({
    level,
    program,
    masterRequired: masterReq,
    url,
    city,
    campus,
    startDate,
    duration,
    languageRequirement: languageReq
  });
}

const output = [];
for (const [regionName, states] of regionsMap) {
  const stateList = [];
  for (const [stateName, universities] of states) {
    const uniList = [];
    for (const [, uni] of universities) {
      uniList.push({
        name: uni.name,
        acronym: uni.acronym,
        programs: uni.programs
      });
    }
    stateList.push({ name: stateName, universities: uniList });
  }
  output.push({ name: regionName, states: stateList });
}

writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
console.log(`Parsed ${rows.length} programs into ${output.length} regions.`);
console.log('Regions:', output.map(r => `${r.name}: ${r.states.reduce((s, st) => s + st.universities.length, 0)} universities`));
console.log(`Output: ${outPath}`);
