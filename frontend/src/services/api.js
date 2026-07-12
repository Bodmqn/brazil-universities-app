const API_BASE = '/api';

async function request(url, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const qs = query.toString();
  const fullUrl = `${API_BASE}${url}${qs ? '?' + qs : ''}`;
  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  getUniversities(params) {
    return request('/universities', params);
  },
  getUniversity(id) {
    return request(`/universities/${id}`);
  },
  getStats() {
    return request('/universities/stats/overview');
  },
  getCalls(params) {
    return request('/calls', params);
  },
  getCallsByYear() {
    return request('/calls/stats/by-year');
  },
  health() {
    return request('/health');
  }
};

export const REGIONS = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
export const CATEGORIES = ['Federal', 'State', 'Municipal'];
export const STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR',
  'PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];
