const REGION_EN = {
  Norte: 'North',
  Nordeste: 'Northeast',
  'Centro-Oeste': 'Central-West',
  Sudeste: 'Southeast',
  Sul: 'South',
};

const prefersEnglish = () =>
  typeof navigator !== 'undefined' &&
  navigator.language?.startsWith('en');

export function regionName(ptName) {
  if (prefersEnglish() && REGION_EN[ptName]) {
    return REGION_EN[ptName];
  }
  return ptName;
}
