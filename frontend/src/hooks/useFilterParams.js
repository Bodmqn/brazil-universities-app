import { useSearchParams } from 'react-router-dom'

export default function useFilterParams(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams()

  const params = {}
  for (const [key, def] of Object.entries(defaults)) {
    const val = searchParams.get(key)
    if (def === 'page') {
      params[key] = parseInt(val || '1')
    } else {
      params[key] = val || def
    }
  }

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    next.set('page', '1')
    setSearchParams(next)
  }

  return { params, setParam, searchParams, setSearchParams }
}
