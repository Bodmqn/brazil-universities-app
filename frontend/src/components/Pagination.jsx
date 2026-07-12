export default function Pagination({ data, setParam }) {
  if (!data || data.total_pages <= 1) return null
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
      <span className="text-sm text-gray-500">Page {data.page} of {data.total_pages} ({data.total} results)</span>
      <div className="flex gap-2">
        <button disabled={data.page <= 1}
          onClick={() => setParam('page', String(data.page - 1))}
          className="px-3 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100"
        >
          Previous
        </button>
        <button disabled={data.page >= data.total_pages}
          onClick={() => setParam('page', String(data.page + 1))}
          className="px-3 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100"
        >
          Next
        </button>
      </div>
    </div>
  )
}
