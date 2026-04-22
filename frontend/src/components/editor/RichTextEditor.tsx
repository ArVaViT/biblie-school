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
  Video as Youtube,
  Headphones,
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
import { AudioEmbed } from "./AudioExtension";
import { storageService } from "@/services/storage";
import { toast } from "@/hooks/use-toast";
import { usePrompt } from "@/components/ui/alert-dialog";

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
      aria-label={title}
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
  { value: "info", label: "Information", icon: Info, color: "text-info" },
  { value: "verse", label: "Bible Verse", icon: BookOpen, color: "text-accent" },
  { value: "takeaway", label: "Key Takeaway", icon: Lightbulb, color: "text-success" },
  { value: "warning", label: "Warning", icon: AlertTriangle, color: "text-warning" },
];

export default function RichTextEditor({
  content,
  onChange,
  placeholder = "Start writing…",
  editable = true,
}: RichTextEditorProps) {
  const [showCalloutMenu, setShowCalloutMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const calloutMenuRef = useRef<HTMLDivElement>(null);
  const prompt = usePrompt();

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
      AudioEmbed,
    ],
    content,
    editable,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose max-w-none min-h-[200px] px-4 py-3 focus:outline-none",
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved || !event.dataTransfer?.files?.length) return false;
        const file = event.dataTransfer.files[0] as File | undefined;
        if (!file || !file.type.startsWith("image/")) return false;
        event.preventDefault();
        setUploading(true);
        storageService
          .uploadContentImage(file)
          .then((url) => {
            const { schema } = view.state;
            const imageNode = schema.nodes.image;
            if (!imageNode) return;
            const node = imageNode.create({ src: url });
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (pos) {
              view.dispatch(view.state.tr.insert(pos.pos, node));
            }
          })
          .catch(() => toast({ title: "Image upload failed", variant: "destructive" }))
          .finally(() => setUploading(false));
        return true;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return false;
            setUploading(true);
            storageService
              .uploadContentImage(file)
              .then((url) => {
                const { schema } = view.state;
                const imageNode = schema.nodes.image;
                if (!imageNode) return;
                const node = imageNode.create({ src: url });
                view.dispatch(view.state.tr.replaceSelectionWith(node));
              })
              .catch(() => toast({ title: "Image upload failed", variant: "destructive" }))
              .finally(() => setUploading(false));
            return true;
          }
        }
        return false;
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

  const setLink = useCallback(async () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = await prompt({
      title: "Add link",
      description: "Paste or type the URL you want to link to. Leave empty to remove an existing link.",
      defaultValue: previousUrl ?? "https://",
      placeholder: "https://…",
      inputType: "url",
      confirmLabel: "Apply",
    });
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor, prompt]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const url = await storageService.uploadContentImage(file);
        editor.chain().focus().setImage({ src: url }).run();
      } catch {
        const url = await prompt({
          title: "Upload failed",
          description: "We couldn't upload the file. Paste an image URL instead, or cancel.",
          placeholder: "https://…",
          inputType: "url",
          confirmLabel: "Insert",
        });
        if (url) editor.chain().focus().setImage({ src: url }).run();
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }, [editor, prompt]);

  const addYoutube = useCallback(async () => {
    if (!editor) return;
    const url = await prompt({
      title: "Embed YouTube video",
      description: "Paste the full YouTube URL (https://www.youtube.com/watch?v=…).",
      placeholder: "https://www.youtube.com/watch?v=…",
      inputType: "url",
      confirmLabel: "Embed",
    });
    if (!url) return;
    editor.chain().focus().setYoutubeVideo({ src: url }).run();
  }, [editor, prompt]);

  const addAudio = useCallback(async () => {
    if (!editor) return;
    const url = await prompt({
      title: "Embed audio",
      description: "Paste a direct https:// URL to an audio file (mp3, m4a, ogg).",
      placeholder: "https://example.com/lesson.mp3",
      inputType: "url",
      confirmLabel: "Embed",
    });
    if (!url) return;
    const ok = editor.chain().focus().setAudio({ src: url }).run();
    if (!ok) toast({ title: "Audio URL must start with http(s)", variant: "destructive" });
  }, [editor, prompt]);

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
            title="Bold"
          >
            <Bold size={iconSize} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic"
          >
            <Italic size={iconSize} />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Headings */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 size={iconSize} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="Heading 3"
          >
            <Heading3 size={iconSize} />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Lists */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet List"
          >
            <List size={iconSize} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Numbered List"
          >
            <ListOrdered size={iconSize} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="Blockquote"
          >
            <Quote size={iconSize} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal Rule"
          >
            <Minus size={iconSize} />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Callout dropdown */}
          <div className="relative" ref={calloutMenuRef}>
            <button
              type="button"
              onClick={() => setShowCalloutMenu(!showCalloutMenu)}
              title="Callout Block"
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
                      Remove Block
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Media */}
          <ToolbarButton onClick={addImage} disabled={uploading} title="Insert Image">
            {uploading ? (
              <span className="inline-block h-[18px] w-[18px] animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <ImageIcon size={iconSize} />
            )}
          </ToolbarButton>

          <ToolbarButton onClick={addYoutube} title="Insert YouTube Video">
            <Youtube size={iconSize} />
          </ToolbarButton>

          <ToolbarButton onClick={addAudio} title="Insert Audio">
            <Headphones size={iconSize} />
          </ToolbarButton>

          <ToolbarButton
            onClick={setLink}
            active={editor.isActive("link")}
            title="Link"
          >
            <Link2 size={iconSize} />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Undo/Redo */}
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo2 size={iconSize} />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo2 size={iconSize} />
          </ToolbarButton>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
