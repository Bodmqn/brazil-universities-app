import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../services/api'

const progStatusColors = {
  likely_open: 'bg-green-100 text-green-800',
  possible: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  unknown: 'bg-gray-100 text-gray-500',
}
const progStatusLabels = {
  likely_open: 'Open', possible: 'Possible', error: 'Error', unknown: 'Unknown',
}

function Field({ label, value, href }) {
  if (!value && value !== 0) return null;
  return (
    <div className="py-2">
      <span className="text-sm text-gray-500 block">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline font-medium">
          {value}
        </a>
      ) : (
        <span className="text-gray-900 font-medium">{value}</span>
      )}
    </div>
  );
}

export default function UniversityDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [programs, setPrograms] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getUniversity(id),
      api.getPrograms({ university_id: id, per_page: 200 }),
    ]).then(([uniData, progData]) => {
      setData(uniData);
      setPrograms(progData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!data) return <div className="text-center py-12 text-gray-400">University not found</div>;

  const { university: uni, calls } = data;
  const openCalls = calls.filter(c => c.status === 'open');
  const statusColor = { open: 'bg-green-100 text-green-800', closed: 'bg-gray-100 text-gray-600', upcoming: 'bg-yellow-100 text-yellow-800' };
  const openPrograms = programs?.data?.filter(p => p.scan_status === 'likely_open') || [];

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
          {openCalls.length > 0 && (
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              {openCalls.length} open call{openCalls.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Field label="Official Website" value={uni.website} href={uni.website} />
            <Field label="Academic System" value={uni.academic_system_name} />
            <Field label="Academic Portal" value={uni.academic_system_url} href={uni.academic_system_url} />
          </div>
          <div>
            <Field label="QS World Ranking" value={uni.qs_ranking || 'Not ranked'} />
            <Field label="THE World Ranking" value={uni.the_ranking || 'Not ranked'} />
            <Field label="Graduate Programs Page" value={uni.graduate_page_url} href={uni.graduate_page_url} />
          </div>
          <div>
            <Field label="Master's Programmes" value={uni.masters_count} />
            <Field label="PhD Programmes" value={uni.phd_count} />
            <Field label="English-taught Programmes" value={uni.english_programmes || 'None found'} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Graduate Programs
          {programs && <span className="text-gray-400 text-sm ml-2">({programs.total} total)</span>}
        </h2>

        {!programs || programs.data.length === 0 ? (
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
                {programs.data.map(prog => (
                  <tr key={prog.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2">
                      <Link to={`/programs/${prog.id}`} className="font-medium text-gray-900 hover:text-green-700 text-sm">
                        {prog.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{prog.level}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{prog.city}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{prog.start_date || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{prog.duration_months ? `${prog.duration_months}m` : '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${progStatusColors[prog.scan_status] || progStatusColors.unknown}`}>
                        {progStatusLabels[prog.scan_status] || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {programs && programs.total > 0 && (
          <div className="mt-3">
            <Link to={`/programs?university_id=${id}`} className="text-sm text-green-700 hover:underline">
              View all {programs.total} programs &rarr;
            </Link>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">International Office</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Email" value={uni.int_office_email} href={`mailto:${uni.int_office_email}`} />
          <Field label="Phone" value={uni.int_office_phone} />
          <Field label="International Office Website" value={uni.int_office_url} href={uni.int_office_url} />
        </div>
        {!uni.int_office_email && !uni.int_office_phone && !uni.int_office_url && (
          <p className="text-gray-400 text-sm">No international office contact information available.</p>
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
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[call.status] || statusColor.closed}`}>
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
                    <a href={call.call_url} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline block">
                      View call &rarr;
                    </a>
                  )}
                  {call.detected_at && <span className="block mt-1">Detected: {new Date(call.detected_at).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
