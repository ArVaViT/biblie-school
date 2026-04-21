import DOMPurify from "dompurify"
import { rewriteHtmlImageSources } from "./images"

/**
 * YouTube embed URLs we allow iframes to point at. Any other iframe is
 * removed outright — no arbitrary iframing of third-party origins.
 */
const YT_EMBED_PREFIXES = [
  "https://www.youtube.com/embed/",
  "https://www.youtube-nocookie.com/embed/",
] as const

let hookRegistered = false
if (!hookRegistered) {
  DOMPurify.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName === "iframe") {
      const src = (node as HTMLIFrameElement).getAttribute("src") || ""
      if (YT_EMBED_PREFIXES.some((p) => src.startsWith(p))) {
        return
      }
      node.parentNode?.removeChild(node)
    }
  })

  // Strip any href/src whose scheme is dangerous. DOMPurify already blocks
  // javascript:, but we also block data: (outside of images handled via the
  // proxy below), vbscript: and file: just in case.
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    const name = data.attrName
    const value = (data.attrValue || "").trim().toLowerCase()
    if (name === "href" || name === "src" || name === "xlink:href") {
      if (
        value.startsWith("javascript:") ||
        value.startsWith("vbscript:") ||
        value.startsWith("file:") ||
        (value.startsWith("data:") && !value.startsWith("data:image/"))
      ) {
        data.keepAttr = false
      }
    }
    // Block inline event handlers outright.
    if (name.startsWith("on")) {
      data.keepAttr = false
    }
  })
  hookRegistered = true
}

const SANITIZE_CONFIG = {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: [
    "allow", "allowfullscreen", "frameborder", "src", "loading",
    "referrerpolicy", "data-callout", "data-youtube-embed",
    "alt", "width", "height",
  ],
  // Explicitly whitelist safe URI schemes; anything else gets stripped.
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ["style", "form", "input", "button"],
  FORBID_ATTR: ["style", "onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
} satisfies Parameters<typeof DOMPurify.sanitize>[1]

export function sanitizeHtml(html: string): string {
  const cleaned = DOMPurify.sanitize(html, SANITIZE_CONFIG) as unknown as string
  return rewriteHtmlImageSources(cleaned)
}
