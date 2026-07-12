import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadData, filterCalls, getUniversity, getCalls, REGIONS, STATES } from '../services/data'
import useFilterParams from '../hooks/useFilterParams'
import Pagination from '../components/Pagination'

const statusColors = {
  open: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-600',
  upcoming: 'bg-yellow-100 text-yellow-800',
}

export default function CallsPage() {
  const { params, setParam, searchParams, setSearchParams } = useFilterParams({
    status: 'open', call_year: '', region: '', state: '', call_type: '', page: 'page',
  })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData().then(() => {
      const cleaned = {}
      Object.entries(params).forEach(([k, v]) => { if (v) cleaned[k] = v })
      setData(filterCalls(cleaned))
      setLoading(false)
    })
  }, [searchParams])

  const allYears = [...new Set(getCalls().map(c => c.call_year || new Date().getFullYear()))].sort().reverse()
  const yearOptions = allYears.length > 0 ? allYears : [new Date().getFullYear(), new Date().getFullYear() + 1]
  const hasFilters = params.status !== 'open' || params.call_year || params.call_type || params.region || params.state
  const clearFilters = () => setSearchParams({})

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Application Calls
          {data && <span className="text-gray-400 text-lg ml-2">({data.total})</span>}
        </h1>
      </div>

      {data && data.total === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center mb-6">
          <p className="text-yellow-800 font-medium mb-2">No calls recorded yet</p>
          <p className="text-yellow-700 text-sm">The scanner hasn't run yet or hasn't found any open calls. Runs daily via GitHub Actions.</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <select value={params.status} onChange={e => setParam('status', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="upcoming">Upcoming</option>
          </select>
          <select value={params.call_year} onChange={e => setParam('call_year', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Years</option>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={params.call_type} onChange={e => setParam('call_type', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Types</option>
            <option value="sisu">SISU</option>
            <option value="vestibular">Vestibular</option>
            <option value="graduate">Graduate</option>
            <option value="international">International</option>
          </select>
          <select value={params.region} onChange={e => setParam('region', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Regions</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={params.state} onChange={e => setParam('state', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All States</option>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="px-3 py-2 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded-lg hover:bg-red-50">
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : data?.data?.length === 0 && !(data.total === 0) ? (
        <div className="text-center py-12 text-gray-400">No calls found matching filters.</div>
      ) : data?.data?.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">University</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Year/Sem</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Region</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">State</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Deadline</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.data.map((call, i) => {
                  const uni = getUniversity(call.university_id)
                  return (
                    <tr key={call.id || i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        {uni ? (
                          <Link to={`/universities/${uni.id}`} className="font-medium text-gray-900 hover:text-green-700">{uni.acronym}</Link>
                        ) : (
                          <span className="text-gray-400">#{call.university_id}</span>
                        )}
                        <div className="text-xs text-gray-400">{uni?.name || ''}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">{call.call_year}/{call.call_semester || '?'}</td>
                      <td className="px-4 py-3"><span className="text-sm font-medium text-gray-700">{call.call_type}</span></td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[call.status] || ''}`}>{call.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{uni?.region || ''}</td>
                      <td className="px-4 py-3 text-sm">{uni?.state || ''}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{call.application_deadline || '-'}</td>
                      <td className="px-4 py-3">
                        {call.call_url ? (
                          <a href={call.call_url} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline text-sm">Link &rarr;</a>
                        ) : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination data={data} setParam={setParam} />
        </div>
      ) : null}
    </div>
  )
}
