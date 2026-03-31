import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Undo2,
  Redo2,
  ImageIcon,
  Youtube,
  Info,
  BookOpen,
  Lightbulb,
  AlertTriangle,
  ChevronDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Callout, type CalloutVariant } from "./CalloutExtension";
import { YoutubeEmbed } from "./YoutubeExtension";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
}

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded p-1.5 transition-colors",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      {children}
    </button>
  );
}

const CALLOUT_VARIANTS: {
  value: CalloutVariant;
  label: string;
  icon: typeof Info;
  color: string;
}[] = [
  { value: "info", label: "Information", icon: Info, color: "text-blue-500" },
  { value: "verse", label: "Bible Verse", icon: BookOpen, color: "text-amber-600" },
  { value: "takeaway", label: "Key Takeaway", icon: Lightbulb, color: "text-emerald-500" },
  { value: "warning", label: "Warning", icon: AlertTriangle, color: "text-red-500" },
];

export default function RichTextEditor({
  content,
  onChange,
  placeholder = "Start writing…",
  editable = true,
}: RichTextEditorProps) {
  const [showCalloutMenu, setShowCalloutMenu] = useState(false);
  const calloutMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (calloutMenuRef.current && !calloutMenuRef.current.contains(e.target as Node)) {
        setShowCalloutMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline cursor-pointer" },
      }),
      Placeholder.configure({ placeholder }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-lg max-w-full h-auto my-4",
        },
      }),
      Callout,
      YoutubeEmbed,
    ],
    content,
    editable,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base max-w-none min-h-[200px] px-4 py-3 focus:outline-none",
      },
    },
  });

  const lastExternalContent = useRef(content);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (content === lastExternalContent.current) return;
    lastExternalContent.current = content;
    const currentHTML = editor.getHTML();
    if (currentHTML !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Введите URL", previousUrl ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Введите URL изображения");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const addYoutube = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Вставьте ссылку на YouTube видео");
    if (!url) return;
    editor.chain().focus().setYoutubeVideo({ src: url }).run();
  }, [editor]);

  const insertCallout = useCallback(
    (variant: CalloutVariant) => {
      if (!editor) return;
      editor.chain().focus().setCallout({ variant }).run();
      setShowCalloutMenu(false);
    },
    [editor]
  );

  if (!editor) return null;

  const iconSize = 18;

  return (
    <div className="rounded-md border border-input bg-background">
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-2 py-1.5">
          {/* Text formatting */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Жирный"
          >
            <Bold size={iconSize} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Курсив"
          >
            <Italic size={iconSize} />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Headings */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Заголовок 2"
          >
            <Heading2 size={iconSize} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="Заголовок 3"
          >
            <Heading3 size={iconSize} />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Lists */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Маркированный список"
          >
            <List size={iconSize} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Нумерованный список"
          >
            <ListOrdered size={iconSize} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="Цитата"
          >
            <Quote size={iconSize} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Разделитель"
          >
            <Minus size={iconSize} />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Callout dropdown */}
          <div className="relative" ref={calloutMenuRef}>
            <button
              type="button"
              onClick={() => setShowCalloutMenu(!showCalloutMenu)}
              title="Выделенный блок"
              className={cn(
                "flex items-center gap-0.5 rounded p-1.5 transition-colors",
                editor.isActive("callout")
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Info size={iconSize} />
              <ChevronDown size={12} />
            </button>
            {showCalloutMenu && (
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
                {editor.isActive("callout") && (
                  <>
                    <div className="my-1 border-t" />
                    <button
                      type="button"
                      onClick={() => {
                        editor.chain().focus().unsetCallout().run();
                        setShowCalloutMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors text-left"
                    >
                      Убрать блок
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Media */}
          <ToolbarButton onClick={addImage} title="Вставить изображение">
            <ImageIcon size={iconSize} />
          </ToolbarButton>

          <ToolbarButton onClick={addYoutube} title="Вставить YouTube видео">
            <Youtube size={iconSize} />
          </ToolbarButton>

          <ToolbarButton
            onClick={setLink}
            active={editor.isActive("link")}
            title="Ссылка"
          >
            <Link2 size={iconSize} />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Undo/Redo */}
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Отменить"
          >
            <Undo2 size={iconSize} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Повторить"
          >
            <Redo2 size={iconSize} />
          </ToolbarButton>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
