import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { filterUniversities, loadData, getCalls, REGIONS, CATEGORIES, STATES } from '../services/data'

function Badge({ children, color }) {
  const colors = {
    Federal: 'bg-blue-100 text-blue-800',
    State: 'bg-orange-100 text-orange-800',
    Municipal: 'bg-teal-100 text-teal-800',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[children] || colors.Federal}`}>
      {children}
    </span>
  )
}

export default function UniversityList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const params = {
    category: searchParams.get('category') || '',
    region: searchParams.get('region') || '',
    state: searchParams.get('state') || '',
    search: searchParams.get('search') || '',
    has_calls: searchParams.get('has_calls') || '',
    page: parseInt(searchParams.get('page') || '1'),
    per_page: 50,
  }

  useEffect(() => {
    loadData().then(() => {
      const cleaned = {}
      Object.entries(params).forEach(([k, v]) => { if (v) cleaned[k] = v })
      setData(filterUniversities(cleaned))
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

  const calls = getCalls()
  const openCallCounts = {}
  for (const c of calls) {
    if (c.status === 'open') {
      openCallCounts[c.university_id] = (openCallCounts[c.university_id] || 0) + 1
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Universities
          {data && <span className="text-gray-400 text-lg ml-2">({data.total})</span>}
        </h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <input type="text" placeholder="Search name, acronym, city..." value={params.search}
            onChange={e => setParam('search', e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <select value={params.region} onChange={e => setParam('region', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Regions</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={params.category} onChange={e => setParam('category', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
        <div className="text-center py-12 text-gray-400">No universities found</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">University</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Acronym</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">State</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">City</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Region</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Calls</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">QS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.data.map(uni => (
                  <tr key={uni.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/universities/${uni.id}`} className="font-medium text-gray-900 hover:text-green-700">{uni.name}</Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-600">{uni.acronym}</td>
                    <td className="px-4 py-3"><Badge>{uni.category}</Badge></td>
                    <td className="px-4 py-3 text-sm">{uni.state}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{uni.city}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{uni.region}</td>
                    <td className="px-4 py-3 text-center">
                      {openCallCounts[uni.id] > 0 ? (
                        <span className="inline-flex items-center gap-1 text-green-700 font-medium text-sm">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          {openCallCounts[uni.id]}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{uni.qs_ranking || '-'}</td>
                  </tr>
                ))}
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
