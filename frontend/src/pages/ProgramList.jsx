import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { loadData, filterPrograms, getUniversity, REGIONS, STATES, PROGRAM_LEVELS, SCAN_STATUSES } from '../services/data'

const statusColors = {
  likely_open: 'bg-green-100 text-green-800',
  possible: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  unknown: 'bg-gray-100 text-gray-500',
}
const statusLabels = {
  likely_open: 'Open', possible: 'Possible', error: 'Error', unknown: 'Unknown',
}

export default function ProgramList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const params = {
    level: searchParams.get('level') || '',
    scan_status: searchParams.get('scan_status') || '',
    region: searchParams.get('region') || '',
    state: searchParams.get('state') || '',
    search: searchParams.get('search') || '',
    university_id: searchParams.get('university_id') || '',
    sort_by: searchParams.get('sort_by') || 'name',
    sort_order: searchParams.get('sort_order') || 'asc',
    page: parseInt(searchParams.get('page') || '1'),
    per_page: 50,
  }

  useEffect(() => {
    loadData().then(() => {
      const cleaned = {}
      Object.entries(params).forEach(([k, v]) => { if (v) cleaned[k] = v })
      setData(filterPrograms(cleaned))
      setLoading(false)
    })
  }, [searchParams])

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    next.set('page', '1')
    setSearchParams(next)
  }

  const toggleSort = (col) => {
    const next = new URLSearchParams(searchParams)
    if (params.sort_by === col && params.sort_order === 'asc') {
      next.set('sort_order', 'desc')
    } else {
      next.set('sort_by', col)
      next.set('sort_order', 'asc')
    }
    next.set('page', '1')
    setSearchParams(next)
  }

  const sortIcon = (col) => {
    if (params.sort_by !== col) return ''
    return params.sort_order === 'asc' ? ' \u2191' : ' \u2193'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Programs
          {data && <span className="text-gray-400 text-lg ml-2">({data.total})</span>}
        </h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <input type="text" placeholder="Search program name, university..." value={params.search}
            onChange={e => setParam('search', e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <select value={params.level} onChange={e => setParam('level', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Levels</option>
            {PROGRAM_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={params.scan_status} onChange={e => setParam('scan_status', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Status</option>
            {SCAN_STATUSES.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
          </select>
          <select value={params.region} onChange={e => setParam('region', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Regions</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={params.state} onChange={e => setParam('state', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All States</option>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No programs found</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('name')}>
                    Program{sortIcon('name')}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Level</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">University</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">City</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Region</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">State</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.data.map(prog => {
                  const uni = getUniversity(prog.university_id)
                  return (
                    <tr key={prog.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/programs/${prog.id}`} className="font-medium text-gray-900 hover:text-green-700">{prog.name}</Link>
                      </td>
                      <td className="px-4 py-3"><span className="text-sm text-gray-600">{prog.level}</span></td>
                      <td className="px-4 py-3">
                        {uni && <Link to={`/universities/${uni.id}`} className="text-sm text-gray-600 hover:text-green-700">{uni.acronym}</Link>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{prog.city}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{uni?.region || ''}</td>
                      <td className="px-4 py-3 text-sm">{uni?.state || ''}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[prog.scan_status] || statusColors.unknown}`}>
                          {statusLabels[prog.scan_status] || 'Unknown'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {data && data.total_pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-sm text-gray-500">Page {data.page} of {data.total_pages}</span>
              <div className="flex gap-2">
                <button disabled={data.page <= 1} onClick={() => setParam('page', String(data.page - 1))}
                  className="px-3 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100">Previous</button>
                <button disabled={data.page >= data.total_pages} onClick={() => setParam('page', String(data.page + 1))}
                  className="px-3 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
