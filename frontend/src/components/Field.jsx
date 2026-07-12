export default function Field({ label, value, href }) {
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
