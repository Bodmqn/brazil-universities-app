const COLORS = {
  Federal: 'bg-blue-100 text-blue-800',
  State: 'bg-orange-100 text-orange-800',
  Municipal: 'bg-teal-100 text-teal-800',
}

export default function Badge({ children }) {
  const label = children || 'Uncategorized'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COLORS[label] || 'bg-gray-100 text-gray-500'}`}>
      {label}
    </span>
  )
}
