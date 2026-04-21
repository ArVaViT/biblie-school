import { describe, expect, it } from "vitest"
import { sanitizeHtml } from "../sanitize"

describe("sanitizeHtml", () => {
  it("passes through safe formatted content", () => {
    const input = "<p>Hello <strong>world</strong></p>"
    expect(sanitizeHtml(input)).toBe(input)
  })

  it("strips <script> tags entirely", () => {
    const output = sanitizeHtml("<p>ok</p><script>alert('x')</script>")
    expect(output).not.toContain("<script")
    expect(output).not.toContain("alert")
  })

  it("removes javascript: URLs from href", () => {
    const output = sanitizeHtml('<a href="javascript:alert(1)">click</a>')
    expect(output).not.toContain("javascript:")
  })

  it("removes data:text/html URLs from href", () => {
    const output = sanitizeHtml(
      '<a href="data:text/html,<script>x</script>">click</a>',
    )
    expect(output).not.toContain("data:text/html")
  })

  it("preserves data:image/png URLs", () => {
    const output = sanitizeHtml(
      '<img src="data:image/png;base64,iVBORw0KGgoAAAANS" alt="pixel">',
    )
    expect(output).toContain("data:image/png")
  })

  it("strips inline event handlers like onerror", () => {
    const output = sanitizeHtml('<img src="x" onerror="alert(1)">')
    expect(output).not.toContain("onerror")
    expect(output).not.toContain("alert")
  })

  it("strips inline onclick handlers", () => {
    const output = sanitizeHtml('<button onclick="alert(1)">hi</button>')
    // Forbidden tag — button — should also be dropped entirely.
    expect(output).not.toContain("<button")
    expect(output).not.toContain("onclick")
  })

  it("strips <style> tags", () => {
    const output = sanitizeHtml("<p>x</p><style>body{display:none}</style>")
    expect(output).not.toContain("<style")
  })

  it("keeps YouTube embed iframes", () => {
    const input = '<iframe src="https://www.youtube.com/embed/abc"></iframe>'
    const output = sanitizeHtml(input)
    expect(output).toContain("youtube.com/embed/abc")
  })

  it("keeps youtube-nocookie embed iframes", () => {
    const input =
      '<iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe>'
    const output = sanitizeHtml(input)
    expect(output).toContain("youtube-nocookie.com/embed/abc")
  })

  it("removes iframes pointing to non-YouTube origins", () => {
    const input = '<iframe src="https://evil.example.com/frame"></iframe>'
    const output = sanitizeHtml(input)
    expect(output).not.toContain("evil.example.com")
    expect(output).not.toContain("<iframe")
  })

  it("preserves safe anchor tags", () => {
    const output = sanitizeHtml('<a href="https://example.com">x</a>')
    expect(output).toContain('href="https://example.com"')
  })

  it("strips style attributes", () => {
    const output = sanitizeHtml(
      '<p style="background:url(javascript:alert(1))">x</p>',
    )
    expect(output).not.toContain("style=")
  })
})
