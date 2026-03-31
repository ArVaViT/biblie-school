import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

DOMPurify.addHook("uponSanitizeElement", (node, data) => {
  if (data.tagName === "iframe") {
    const src = (node as HTMLIFrameElement).getAttribute("src") || "";
    if (
      src.startsWith("https://www.youtube.com/embed/") ||
      src.startsWith("https://www.youtube-nocookie.com/embed/")
    ) {
      return;
    }
    node.parentNode?.removeChild(node);
  }
});

const VIEWER_SANITIZE_CONFIG = {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: [
    "allow", "allowfullscreen", "frameborder", "src", "loading",
    "referrerpolicy", "style", "data-callout", "data-youtube-embed",
    "alt", "width", "height",
  ],
};

interface RichTextViewerProps {
  content: string;
  className?: string;
}

export default function RichTextViewer({
  content,
  className,
}: RichTextViewerProps) {
  return (
    <div
      className={cn(
        "prose prose-sm sm:prose-base max-w-none",
        className
      )}
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(content, VIEWER_SANITIZE_CONFIG),
      }}
    />
  );
}
