const ID_PATTERNS = [
  /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
]

function parseYouTubeId(url: string): string | null {
  for (const p of ID_PATTERNS) {
    const m = url.match(p)
    if (m && m[1]) return m[1]
  }
  return null
}

export function toYouTubeEmbedUrl(url: string): string | null {
  const id = parseYouTubeId(url)
  return id ? `https://www.youtube.com/embed/${id}` : null
}
