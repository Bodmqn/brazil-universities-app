import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadData, filterPrograms, getUniversity, REGIONS, STATES, PROGRAM_LEVELS, SCAN_STATUSES } from '../services/data'
import useFilterParams from '../hooks/useFilterParams'
import StatusBadge from '../components/StatusBadge'
import Pagination from '../components/Pagination'

export default function ProgramList() {
  const { params, setParam, searchParams, setSearchParams } = useFilterParams({
    level: '', scan_status: '', region: '', state: '', search: '',
    university_id: '', sort_by: 'name', sort_order: 'asc', page: 'page',
  })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [localSearch, setLocalSearch] = useState(params.search)
  const debounceRef = useRef(null)

  useEffect(() => {
    loadData().then(() => {
      const cleaned = {}
      Object.entries(params).forEach(([k, v]) => { if (v) cleaned[k] = v })
      setData(filterPrograms(cleaned))
      setLoading(false)
    })
  }, [searchParams])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setParam('search', localSearch)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [localSearch])

  const clearFilters = () => setSearchParams({})

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
          <input type="text" placeholder="Search program name, university..." value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <select value={params.level} onChange={e => setParam('level', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Levels</option>
            {PROGRAM_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={params.scan_status} onChange={e => setParam('scan_status', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Status</option>
            {SCAN_STATUSES.map(s => <option key={s} value={s}>{s === 'likely_open' ? 'Open' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select value={params.region} onChange={e => setParam('region', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Regions</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={params.state} onChange={e => setParam('state', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All States</option>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(params.search || params.level || params.scan_status || params.region || params.state) && (
            <button onClick={clearFilters} className="px-3 py-2 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded-lg hover:bg-red-50">
              Clear
            </button>
          )}
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
                        <StatusBadge status={prog.scan_status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination data={data} setParam={setParam} />
        </div>
      )}
    </div>
  )
}
