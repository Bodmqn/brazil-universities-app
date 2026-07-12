import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, REGIONS, STATES } from '../services/api'

export default function CallsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const params = {
    status: searchParams.get('status') || 'open',
    call_year: searchParams.get('call_year') || '2027',
    region: searchParams.get('region') || '',
    state: searchParams.get('state') || '',
    call_type: searchParams.get('call_type') || '',
    page: parseInt(searchParams.get('page') || '1'),
    per_page: 50,
  };

  useEffect(() => {
    setLoading(true);
    const cleaned = {};
    Object.entries(params).forEach(([k, v]) => { if (v) cleaned[k] = v; });
    api.getCalls(cleaned).then(d => {
      setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [searchParams]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set('page', '1');
    setSearchParams(next);
  };

  const statusColors = {
    open: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-600',
    upcoming: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Application Calls
          {data && <span className="text-gray-400 text-lg ml-2">({data.total})</span>}
        </h1>
      </div>

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
            {[2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
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
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : data?.data?.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No calls found matching the current filters.
          <div className="mt-2 text-sm">The scanner checks each university every 24 hours.</div>
        </div>
      ) : (
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
                {data.data.map(call => (
                  <tr key={call.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/universities/${call.university_id}`} className="font-medium text-gray-900 hover:text-green-700">
                        {call.university_acronym}
                      </Link>
                      <div className="text-xs text-gray-400">{call.university_name}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">
                      {call.call_year}/{call.call_semester || '?'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">{call.call_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[call.status] || ''}`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{call.university_region}</td>
                    <td className="px-4 py-3 text-sm">{call.university_state}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{call.application_deadline || '-'}</td>
                    <td className="px-4 py-3">
                      {call.call_url ? (
                        <a href={call.call_url} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline text-sm">
                          Link &rarr;
                        </a>
                      ) : '-'}
                    </td>
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
  );
}
