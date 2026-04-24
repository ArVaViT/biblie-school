import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Info,
  BookOpen,
  Lightbulb,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { CalloutVariant } from "./CalloutExtension";

interface CalloutChoice {
  value: CalloutVariant;
  label: string;
  icon: typeof Info;
  color: string;
}

const CALLOUT_VARIANTS: CalloutChoice[] = [
  { value: "info", label: "Information", icon: Info, color: "text-info" },
  { value: "verse", label: "Bible Verse", icon: BookOpen, color: "text-accent" },
  { value: "takeaway", label: "Key Takeaway", icon: Lightbulb, color: "text-success" },
  { value: "warning", label: "Warning", icon: AlertTriangle, color: "text-warning" },
];

/**
 * Dropdown menu for inserting or removing a Callout block. Lives next
 * to the formatting toolbar but owns its own open/close state and
 * click-outside handling — the parent toolbar just renders it.
 */
export function CalloutDropdown({
  editor,
  iconSize,
}: {
  editor: Editor;
  iconSize: number;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const insertCallout = (variant: CalloutVariant) => {
    editor.chain().focus().setCallout({ variant }).run();
    setOpen(false);
  };

  const removeCallout = () => {
    editor.chain().focus().unsetCallout().run();
    setOpen(false);
  };

  const isActive = editor.isActive("callout");

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Callout Block"
        className={cn(
          "flex items-center gap-0.5 rounded p-1.5 transition-colors",
          isActive
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Info size={iconSize} />
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-md border bg-background py-1 shadow-lg">
          {CALLOUT_VARIANTS.map((v) => {
            const Icon = v.icon;
            return (
              <button
                key={v.value}
                type="button"
                onClick={() => insertCallout(v.value)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
              >
                <Icon size={16} className={v.color} />
                {v.label}
              </button>
            );
          })}
          {isActive && (
            <>
              <div className="my-1 border-t" />
              <button
                type="button"
                onClick={removeCallout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors text-left"
              >
                Remove Block
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
