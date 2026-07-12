import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { loadData, getUniversity, getProgramsForUniversity, getCallsForUniversity } from '../services/data'
import Field from '../components/Field'
import StatusBadge from '../components/StatusBadge'

export default function UniversityDetail() {
  const { id } = useParams()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadData().then(() => setReady(true))
  }, [])

  if (!ready) return <div className="text-center py-12 text-gray-400">Loading...</div>

  const uni = getUniversity(id)
  if (!uni) return <div className="text-center py-12 text-gray-400">University not found</div>

  const progs = getProgramsForUniversity(id)
  const calls = getCallsForUniversity(id)
  const openCalls = calls.filter(c => c.status === 'open')
  const openPrograms = progs.filter(p => p.scan_status === 'likely_open')

  return (
    <div>
      <Link to="/universities" className="text-sm text-green-700 hover:underline mb-4 inline-block">&larr; Back to universities</Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{uni.name}</h1>
            <p className="text-gray-500 mt-1">
              {uni.acronym} &middot; {uni.category} &middot; {uni.city}, {uni.state} &middot; {uni.region}
            </p>
          </div>
          {openPrograms.length > 0 && (
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              {openPrograms.length} open program{openPrograms.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Field label="Official Website" value={uni.website} href={uni.website} />
            <Field label="QS World Ranking" value={uni.qs_ranking || 'Not ranked'} />
            <Field label="THE World Ranking" value={uni.the_ranking || 'Not ranked'} />
          </div>
          <div>
            <Field label="Graduate Programs Page" value={uni.graduate_page_url} href={uni.graduate_page_url} />
            <Field label="Master's Programmes" value={uni.masters_count} />
            <Field label="PhD Programmes" value={uni.phd_count} />
          </div>
          <div>
            <Field label="English-taught Programmes" value={uni.english_programmes || 'None found'} />
            <Field label="International Office Email" value={uni.int_office_email} href={uni.int_office_email ? `mailto:${uni.int_office_email}` : null} />
            <Field label="International Office Phone" value={uni.int_office_phone} />
            <Field label="International Office Website" value={uni.int_office_url} href={uni.int_office_url} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Graduate Programs
          <span className="text-gray-400 text-sm ml-2">({progs.length} total)</span>
        </h2>

        {progs.length === 0 ? (
          <p className="text-gray-400 text-sm">No program data available for this university.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Program</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Level</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">City</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Start</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {progs.map(prog => (
                  <tr key={prog.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2">
                      <Link to={`/programs/${prog.id}`} className="font-medium text-gray-900 hover:text-green-700 text-sm">{prog.name}</Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{prog.level}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{prog.city}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{prog.start_date || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{prog.duration_months ? `${prog.duration_months}m` : '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={prog.scan_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Application Calls
          <span className="text-gray-400 text-sm ml-2">({calls.length} total)</span>
        </h2>

        {calls.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            No calls have been detected yet. The scanner will check this university on its next run.
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map(call => (
              <div key={call.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:bg-gray-50">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${call.status === 'open' ? 'bg-green-100 text-green-800' : call.status === 'upcoming' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
                      {call.status}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{call.call_type}</span>
                    <span className="text-sm text-gray-500">{call.call_year}/{call.call_semester || '?'}</span>
                  </div>
                  {call.description && <p className="text-sm text-gray-600">{call.description}</p>}
                  {call.application_deadline && <p className="text-xs text-gray-400 mt-1">Deadline: {call.application_deadline}</p>}
                </div>
                <div className="text-right text-xs text-gray-400">
                  {call.call_url && (
                    <a href={call.call_url} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline block">View call &rarr;</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
