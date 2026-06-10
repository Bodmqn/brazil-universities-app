import { regionMap, stateMap, uniNameMap, levelMap, termDict, langReqMap, generalTerms } from '../src/utils/translations-data.js';

console.log('Region:', 'Norte', '->', regionMap['Norte']);

console.log('State:', 'São Paulo', '->', stateMap['São Paulo']);
console.log('State:', 'Distrito Federal', '->', stateMap['Distrito Federal']);

console.log('Level:', 'Mestrado', '->', levelMap['Mestrado']);

const names = [
  'Programa de Pós-Graduação em Ciências Aplicadas à Hematologia',
  'Mestrado Profissional em Administração Pública',
  'Programa de Pós-Graduação em Educação (PPGED)',
  'Programa de Pós-Graduação em Direito Ambiental',
  'Programa de Pós-Graduação Interdisciplinar em Ciências Humanas/Mestrado em Ciências Humanas'
];

for (const name of names) {
  let en = name;
  const allTerms = [...Object.entries(termDict), ...Object.entries(generalTerms)];
  allTerms.sort((a, b) => b[0].length - a[0].length);
  for (const [pt, enVal] of allTerms) {
    const escaped = pt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'gi');
    if (re.test(en)) en = en.replace(re, enVal);
  }
  console.log('\nPT:', name);
  console.log('EN:', en);
}

const enData = JSON.stringify(uniNameMap, null, 2);
const unis = Object.keys(uniNameMap);
console.log('\nTotal university translations:', unis.length);
