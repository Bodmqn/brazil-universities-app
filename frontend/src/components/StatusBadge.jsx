const COLORS = {
  likely_open: 'bg-green-100 text-green-800',
  possible: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  unknown: 'bg-gray-100 text-gray-500',
}

const LABELS = {
  likely_open: 'Open', possible: 'Possible', error: 'Error', unknown: 'Unknown',
}

export function getStatusBadge(status) {
  return { color: COLORS[status] || COLORS.unknown, label: LABELS[status] || 'Unknown' }
}

export default function StatusBadge({ status }) {
  const { color, label } = getStatusBadge(status)
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

export function StatusBadgeWithDot({ status }) {
  const config = {
    likely_open: { label: 'Open', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
    possible: { label: 'Possible', color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
    error: { label: 'Error', color: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
    unknown: { label: 'Unknown', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
  }
  const cfg = config[status] || config.unknown
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-2 ${cfg.color}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`}></span>
      {cfg.label}
    </span>
  )
}

export function ScoreBadge({ score }) {
  const pct = Math.round((score || 0) * 100)
  const color = pct >= 60 ? 'bg-green-100 text-green-800' : pct >= 20 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-500'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{pct}%</span>
}
