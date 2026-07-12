import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, REGIONS, CATEGORIES } from '../services/api'

function StatCard({ title, value, color, link }) {
  return (
    <Link to={link} className={`bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow ${color}`}>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{title}</div>
    </Link>
  );
}

function Bar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-28 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium text-gray-700 w-12 text-right">{count}</span>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [progStats, setProgStats] = useState(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
    api.getProgramStats().then(setProgStats).catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    );
  }

  const total = stats.total_universities;
  const totalProgs = progStats?.total_programs || 0;

  const regionColors = {
    Norte: 'bg-blue-500', Nordeste: 'bg-yellow-500', 'Centro-Oeste': 'bg-red-500',
    Sudeste: 'bg-green-500', Sul: 'bg-purple-500',
  };
  const catColors = { Federal: 'bg-blue-500', State: 'bg-orange-500', Municipal: 'bg-teal-500' };
  const statusColors = { likely_open: 'bg-green-500', possible: 'bg-yellow-500', error: 'bg-red-500', unknown: 'bg-gray-400' };
  const statusLabels = { likely_open: 'Open', possible: 'Possible', error: 'Error', unknown: 'Unknown' };

  const openPrograms = progStats?.by_scan_status?.likely_open || 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Universities" value={total} link="/universities" color="bg-white" />
        <StatCard title="Total Programs" value={totalProgs} link="/programs" color="bg-white" />
        <StatCard title="Open Calls" value={stats.total_open_calls || 0} link="/calls?status=open" color="border-l-4 border-l-green-500" />
        <StatCard title="Open Programs" value={openPrograms} link="/programs?scan_status=likely_open" color="border-l-4 border-l-green-500" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Universities by Region</h2>
          <div className="space-y-3">
            {REGIONS.map(r => (
              <Bar key={r} label={r} count={stats.by_region?.[r] || 0} total={total} color={regionColors[r]} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Universities by Category</h2>
          <div className="space-y-3">
            {CATEGORIES.map(c => (
              <Bar key={c} label={c} count={stats.by_category?.[c] || 0} total={total} color={catColors[c]} />
            ))}
          </div>
        </div>
      </div>

      {progStats && (
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Programs by Region</h2>
            <div className="space-y-3">
              {REGIONS.map(r => (
                <Bar key={r} label={r} count={progStats.by_region?.[r] || 0} total={totalProgs} color={regionColors[r]} />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Programs by Scan Status</h2>
            <div className="space-y-3">
              {Object.entries(statusColors).map(([key, color]) => (
                <Bar key={key} label={statusLabels[key]} count={progStats.by_scan_status?.[key] || 0} total={totalProgs} color={color} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top States by University Count</h2>
        <div className="space-y-2">
          {Object.entries(stats.by_state || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([state, count]) => (
              <Bar key={state} label={state} count={count} total={total} color="bg-indigo-400" />
            ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <p className="text-green-800 font-medium">
            The scanner checks each university's website and SIGAA portal for open calls.
            <Link to="/calls" className="underline ml-1">View all calls →</Link>
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <p className="text-blue-800 font-medium">
            Each program URL is scanned for open applications. {openPrograms} programs currently open.
            <Link to="/programs?scan_status=likely_open" className="underline ml-1">Browse open programs →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
