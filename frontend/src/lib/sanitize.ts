import DOMPurify from "dompurify"

let hookRegistered = false
if (!hookRegistered) {
  DOMPurify.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName === "iframe") {
      const src = (node as HTMLIFrameElement).getAttribute("src") || ""
      if (
        src.startsWith("https://www.youtube.com/embed/") ||
        src.startsWith("https://www.youtube-nocookie.com/embed/")
      ) {
        return
      }
      node.parentNode?.removeChild(node)
    }
  })
  hookRegistered = true
}

const SANITIZE_CONFIG = {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: [
    "allow", "allowfullscreen", "frameborder", "src", "loading",
    "referrerpolicy", "style", "data-callout", "data-youtube-embed",
    "alt", "width", "height",
  ],
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG)
}
