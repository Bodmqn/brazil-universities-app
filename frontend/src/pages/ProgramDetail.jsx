import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { loadData, getProgram, getUniversity } from '../services/data'
import Field from '../components/Field'
import { StatusBadgeWithDot } from '../components/StatusBadge'

export default function ProgramDetail() {
  const { id } = useParams()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadData().then(() => setReady(true))
  }, [id])

  function MetaTag() {
    return <span className="ml-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-medium align-middle">scraped</span>
  }

  if (!ready) return <div className="text-center py-12 text-gray-400">Loading...</div>

  const prog = getProgram(id)
  if (!prog) return <div className="text-center py-12 text-gray-400">Program not found</div>

  const uni = getUniversity(prog.university_id)

  const hasMeta = prog.meta_application_deadline || prog.meta_campus || prog.meta_duration || prog.meta_start_date || prog.meta_language || prog.meta_master_required

  function displayValue(src, meta) {
    if (src) return src
    if (meta) return { value: meta, meta: true }
    return null
  }

  function renderField(label, srcValue, metaValue, opts = {}) {
    const dv = displayValue(srcValue, metaValue)
    if (!dv && !opts.always) return null
    const val = dv?.meta ? dv.value : dv
    if (!val && !opts.always) return null
    return (
      <div>
        <span className="text-gray-500 text-sm">{label}: </span>
        <span className="text-gray-900 text-sm">
          {dv?.meta ? <>{val}<MetaTag /></> : val}
        </span>
      </div>
    )
  }

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
          <StatusBadgeWithDot status={prog.scan_status} />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Field label="Program URL" value={prog.url} href={prog.url} />
            <Field label="City" value={prog.city} />
            <Field label="Campus" value={prog.campus || (prog.meta_campus || null)} />
          </div>
          <div>
            <Field label="Start Date" value={prog.start_date || (prog.meta_start_date || null)} />
            <Field label="Duration" value={prog.duration_months ? `${prog.duration_months} months` : (prog.meta_duration || null)} />
            <Field label="Master's Required for PhD" value={
              prog.master_required === 'SIM' ? 'Yes'
              : prog.meta_master_required ? (prog.meta_master_required.toLowerCase().startsWith('s') ? 'Yes' : 'No')
              : prog.master_required === '' ? 'Unknown'
              : 'No'
            } />
          </div>
          <div>
            <Field label="Language Requirement" value={prog.language_requirement || (prog.meta_language || null)} />
            <Field label="Application Deadline" value={prog.meta_application_deadline || null} />
          </div>
        </div>

        {hasMeta && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-yellow-600 mb-2">Values marked <MetaTag /> were extracted from the program page by the scanner.</p>
          </div>
        )}

        {prog.edital_url && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <a href={prog.edital_url} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {prog.edital_title ? `Download Edital: ${prog.edital_title}` : 'Download Selection Notice (Edital)'}
            </a>
          </div>
        )}
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
            {hasMeta && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className="text-gray-500 font-medium">Extracted Metadata:</span>
                <div className="mt-2 space-y-1">
                  {renderField('Application Deadline', null, prog.meta_application_deadline)}
                  {renderField('Start Date', prog.start_date, prog.meta_start_date)}
                  {renderField('Duration', prog.duration_months ? `${prog.duration_months} months` : null, prog.meta_duration)}
                  {renderField('Campus', prog.campus, prog.meta_campus)}
                  {renderField('Language', prog.language_requirement, prog.meta_language)}
                  {renderField('Master Required', prog.master_required, prog.meta_master_required)}
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
