import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { loadData, getProgram, getUniversity } from '../services/data'

const statusConfig = {
  likely_open: { label: 'Open', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  possible: { label: 'Possible', color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  error: { label: 'Error', color: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  unknown: { label: 'Unknown', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
}

function Field({ label, value, href }) {
  if (!value && value !== 0) return null
  return (
    <div className="py-2">
      <span className="text-sm text-gray-500 block">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline font-medium break-all">{value}</a>
      ) : (
        <span className="text-gray-900 font-medium">{value}</span>
      )}
    </div>
  )
}

export default function ProgramDetail() {
  const { id } = useParams()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadData().then(() => setReady(true))
  }, [id])

  if (!ready) return <div className="text-center py-12 text-gray-400">Loading...</div>

  const prog = getProgram(id)
  if (!prog) return <div className="text-center py-12 text-gray-400">Program not found</div>

  const uni = getUniversity(prog.university_id)
  const cfg = statusConfig[prog.scan_status] || statusConfig.unknown

  return (
    <div>
      <Link to="/programs" className="text-sm text-green-700 hover:underline mb-4 inline-block">&larr; Back to programs</Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{prog.name}</h1>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">{prog.level}</span>
            </div>
            {uni && (
              <p className="text-gray-500">
                <Link to={`/universities/${uni.id}`} className="text-green-700 hover:underline">{uni.name} ({uni.acronym})</Link>
                &nbsp;&middot; {uni.city}, {uni.state} &middot; {uni.region}
              </p>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-2 ${cfg.color}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`}></span>
            {cfg.label}
          </span>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Field label="Program URL" value={prog.url} href={prog.url} />
            <Field label="City" value={prog.city} />
            <Field label="Campus" value={prog.campus} />
          </div>
          <div>
            <Field label="Start Date" value={prog.start_date} />
            <Field label="Duration" value={prog.duration_months ? `${prog.duration_months} months` : null} />
            <Field label="Master's Required for PhD" value={prog.master_required === 'SIM' ? 'Yes' : 'No'} />
          </div>
          <div>
            <Field label="Language Requirement" value={prog.language_requirement} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Scan Details</h2>
        {prog.scan_keywords?.length > 0 ? (
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500">Confidence: </span>
              <span className="text-gray-900">{Math.round(prog.scan_confidence * 100)}%</span>
            </div>
            {prog.scan_title && (
              <div><span className="text-gray-500">Page title: </span><span className="text-gray-900">{prog.scan_title}</span></div>
            )}
            <div>
              <span className="text-gray-500">Keywords matched: </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {prog.scan_keywords.map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-700">{kw}</span>
                ))}
              </div>
            </div>
            {prog.scan_dates_found?.length > 0 && (
              <div>
                <span className="text-gray-500">Dates found: </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {prog.scan_dates_found.map((d, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-50 rounded text-xs text-blue-700">{d}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">This program has not been scanned yet. The scanner will check it on its next run.</p>
        )}
      </div>

      {uni && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">University</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="University" value={uni.name} />
            <Field label="Acronym" value={uni.acronym} />
            <Field label="Category" value={uni.category} />
            <Field label="Website" value={uni.website} href={uni.website} />
            <Field label="QS Ranking" value={uni.qs_ranking || 'Not ranked'} />
            <Field label="THE Ranking" value={uni.the_ranking || 'Not ranked'} />
          </div>
          <div className="mt-4">
            <Link to={`/universities/${uni.id}`} className="text-sm text-green-700 hover:underline">View university details &rarr;</Link>
          </div>
        </div>
      )}
    </div>
  )
}
