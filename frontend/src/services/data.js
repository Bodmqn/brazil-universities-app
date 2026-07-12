// Static data loading — replaces all api.get* calls

let universities = null
let programs = null
let calls = null
let summary = null

let loadPromise = null

function isBrowser() {
  return typeof window !== 'undefined'
}

const STATUS_GITHUB_URL = 'https://raw.githubusercontent.com/Bodmqn/brazil-universities-app/main/frontend/src/data/program-status.json'
const CALLS_GITHUB_URL = 'https://raw.githubusercontent.com/Bodmqn/brazil-universities-app/main/frontend/src/data/calls.json'

export function loadData() {
  if (universities) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = Promise.all([
    import('../data/universities.json').then(m => { universities = m.default || m }),
    import('../data/programs.json').then(m => { programs = m.default || m }),
    import('../data/_summary.json').then(m => { summary = m.default || m }),
    // Try to load updated calls from GitHub, fall back to empty
    fetch(`${CALLS_GITHUB_URL}?t=${Date.now()}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { calls = d })
      .catch(() => { calls = [] }),
  ])

  return loadPromise
}

export function refreshStatus() {
  return fetch(`${STATUS_GITHUB_URL}?t=${Date.now()}`)
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data || !data.programs) return
      const sm = data.programs
      for (const p of programs) {
        const si = sm[p.url]
        if (si) {
          p.scan_status = si.status || p.scan_status
          p.scan_confidence = si.confidence ?? p.scan_confidence
          p.scan_keywords = si.keywords_found || p.scan_keywords
          p.scan_dates_found = si.dates_found || p.scan_dates_found
          p.scan_title = si.title || p.scan_title
        }
      }
    })
    .catch(() => {})
}

export function refreshCalls() {
  return fetch(`${CALLS_GITHUB_URL}?t=${Date.now()}`)
    .then(r => r.ok ? r.json() : [])
    .then(d => { calls = d })
    .catch(() => {})
}

// ── Getters ────────────────────────────────────────────────────────

export function getSummary() {
  return summary || { total_universities: 0, total_programs: 0, by_region: {}, by_category: {}, by_scan_status: {} }
}

export function getUniversities() {
  return universities || []
}

export function getUniversity(id) {
  return (universities || []).find(u => u.id === Number(id)) || null
}

export function getPrograms() {
  return programs || []
}

export function getProgram(id) {
  return (programs || []).find(p => p.id === Number(id)) || null
}

export function getProgramsForUniversity(uniId) {
  return (programs || []).filter(p => p.university_id === Number(uniId))
}

export function getCalls() {
  return calls || []
}

export function getCallsForUniversity(uniId) {
  return (calls || []).filter(c => c.university_id === Number(uniId))
}

// ── Filtering + Pagination ─────────────────────────────────────────

export function filterUniversities(filters = {}) {
  let result = [...(universities || [])]

  if (filters.category) {
    result = result.filter(u => u.category === filters.category)
  }
  if (filters.region) {
    result = result.filter(u => u.region === filters.region)
  }
  if (filters.state) {
    result = result.filter(u => u.state.toUpperCase() === filters.state.toUpperCase())
  }
  if (filters.has_calls) {
    const uniWithCalls = new Set((calls || []).filter(c => c.status === 'open').map(c => c.university_id))
    result = result.filter(u => uniWithCalls.has(u.id))
  }
  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.acronym.toLowerCase().includes(q) ||
      u.city?.toLowerCase().includes(q)
    )
  }

  // Sort
  const sortBy = filters.sort_by || 'name'
  const sortOrder = filters.sort_order || 'asc'
  result.sort((a, b) => {
    const av = (a[sortBy] || '').toString().toLowerCase()
    const bv = (b[sortBy] || '').toString().toLowerCase()
    return sortOrder === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv)
  })

  return paginate(result, filters.page, filters.per_page)
}

export function filterPrograms(filters = {}) {
  let result = [...(programs || [])]

  if (filters.level) {
    result = result.filter(p => p.level === filters.level)
  }
  if (filters.scan_status) {
    result = result.filter(p => p.scan_status === filters.scan_status)
  }
  if (filters.university_id) {
    result = result.filter(p => p.university_id === Number(filters.university_id))
  }
  if (filters.region) {
    result = result.filter(p => {
      const uni = getUniversity(p.university_id)
      return uni && uni.region === filters.region
    })
  }
  if (filters.state) {
    result = result.filter(p => {
      const uni = getUniversity(p.university_id)
      return uni && uni.state.toUpperCase() === filters.state.toUpperCase()
    })
  }
  if (filters.city) {
    const q = filters.city.toLowerCase()
    result = result.filter(p => p.city?.toLowerCase().includes(q))
  }
  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(p => {
      const uni = getUniversity(p.university_id)
      return (
        p.name.toLowerCase().includes(q) ||
        (uni && uni.name.toLowerCase().includes(q)) ||
        (uni && uni.acronym.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q))
      )
    })
  }

  const sortBy = filters.sort_by || 'name'
  const sortOrder = filters.sort_order || 'asc'
  result.sort((a, b) => {
    let av = (a[sortBy] ?? '').toString().toLowerCase()
    let bv = (b[sortBy] ?? '').toString().toLowerCase()
    if (sortBy === 'scan_confidence') {
      av = a[sortBy] ?? 0
      bv = b[sortBy] ?? 0
      return sortOrder === 'desc' ? bv - av : av - bv
    }
    return sortOrder === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv)
  })

  return paginate(result, filters.page, filters.per_page)
}

export function filterCalls(filters = {}) {
  let result = [...(calls || [])]

  if (filters.status) {
    result = result.filter(c => c.status === filters.status)
  }
  if (filters.call_type) {
    result = result.filter(c => c.call_type === filters.call_type)
  }
  if (filters.call_year) {
    result = result.filter(c => c.call_year === Number(filters.call_year))
  }
  if (filters.call_semester) {
    result = result.filter(c => c.call_semester === Number(filters.call_semester))
  }
  if (filters.university_id) {
    result = result.filter(c => c.university_id === Number(filters.university_id))
  }
  if (filters.region) {
    result = result.filter(c => {
      const uni = getUniversity(c.university_id)
      return uni && uni.region === filters.region
    })
  }
  if (filters.state) {
    result = result.filter(c => {
      const uni = getUniversity(c.university_id)
      return uni && uni.state.toUpperCase() === filters.state.toUpperCase()
    })
  }

  result.sort((a, b) => {
    if (a.call_year !== b.call_year) return b.call_year - a.call_year
    return (b.call_semester || 0) - (a.call_semester || 0)
  })

  return paginate(result, filters.page, filters.per_page)
}

function paginate(arr, page = 1, perPage = 50) {
  page = Math.max(1, Number(page) || 1)
  perPage = Math.min(200, Math.max(1, Number(perPage) || 50))
  const total = arr.length
  const totalPages = Math.ceil(total / perPage) || 1
  const offset = (page - 1) * perPage
  return {
    total,
    page,
    per_page: perPage,
    total_pages: totalPages,
    data: arr.slice(offset, offset + perPage),
  }
}

export const REGIONS = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']
export const CATEGORIES = ['Federal', 'State', 'Municipal']
export const STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR',
  'PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]
export const PROGRAM_LEVELS = ['Mestrado']
export const SCAN_STATUSES = ['likely_open', 'possible', 'error', 'unknown']
