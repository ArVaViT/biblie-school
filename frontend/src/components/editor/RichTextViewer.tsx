import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

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
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
    />
  );
}
