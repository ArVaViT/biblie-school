import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"

interface Options {
  key?: string
  maxLength?: number
  delayMs?: number
}

export function useDebouncedSearchParam(options: Options = {}) {
  const { key = "q", maxLength = 100, delayMs = 300 } = options
  const [params, setParams] = useSearchParams()
  const urlValue = (params.get(key) ?? "").slice(0, maxLength)
  const [input, setInput] = useState(urlValue)

  useEffect(() => {
    if (input === urlValue) return
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params)
      const trimmed = input.slice(0, maxLength)
      if (trimmed) next.set(key, trimmed)
      else next.delete(key)
      setParams(next, { replace: true })
    }, delayMs)
    return () => clearTimeout(timer)
  }, [input, urlValue, params, setParams, key, maxLength, delayMs])

  return { input, setInput, value: urlValue, maxLength }
}
