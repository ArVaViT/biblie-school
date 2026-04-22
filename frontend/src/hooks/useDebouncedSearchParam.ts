import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"

interface Options {
  key?: string
  maxLength?: number
  delayMs?: number
}

/**
 * Two-way-bound debounced ``?<key>=`` URL param.
 *
 * - typing → debounce → URL (replace, so back-button doesn't spam history)
 * - URL changed externally (back/forward, link click, programmatic nav) → input resets
 *
 * The external-sync ref is what saves back-button behaviour: without it, a
 * pending local value would race the new URL and silently restore itself.
 */
export function useDebouncedSearchParam(options: Options = {}) {
  const { key = "q", maxLength = 100, delayMs = 300 } = options
  const [params, setParams] = useSearchParams()
  const urlValue = (params.get(key) ?? "").slice(0, maxLength)
  const [input, setInput] = useState(urlValue)
  const lastSyncedRef = useRef(urlValue)

  useEffect(() => {
    if (urlValue !== lastSyncedRef.current) {
      lastSyncedRef.current = urlValue
      setInput(urlValue)
    }
  }, [urlValue])

  useEffect(() => {
    if (input === urlValue) return
    const timer = setTimeout(() => {
      const trimmed = input.slice(0, maxLength)
      lastSyncedRef.current = trimmed
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (trimmed) next.set(key, trimmed)
          else next.delete(key)
          return next
        },
        { replace: true },
      )
    }, delayMs)
    return () => clearTimeout(timer)
  }, [input, urlValue, setParams, key, maxLength, delayMs])

  return { input, setInput, value: urlValue, maxLength }
}
