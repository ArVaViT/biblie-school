import type { Editor } from "@tiptap/react";
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
  Minus,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { CalloutDropdown } from "./CalloutDropdown";

const TOOLBAR_ICON_SIZE = 18;

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
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px bg-border" />;
}

interface EditorToolbarProps {
  editor: Editor;
  uploading: boolean;
  onAddImage: () => void;
  onAddYoutube: () => void;
  onAddAudio: () => void;
  onSetLink: () => void;
}

/**
 * Full formatting toolbar for the RichTextEditor. Receives the active
 * editor instance plus media callbacks that open modal prompts —
 * keeping media flows out of this component lets it focus on direct
 * editor commands.
 */
export function EditorToolbar({
  editor,
  uploading,
  onAddImage,
  onAddYoutube,
  onAddAudio,
  onSetLink,
}: EditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-2 py-1.5">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold"
      >
        <Bold size={TOOLBAR_ICON_SIZE} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic"
      >
        <Italic size={TOOLBAR_ICON_SIZE} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        <Heading2 size={TOOLBAR_ICON_SIZE} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        <Heading3 size={TOOLBAR_ICON_SIZE} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Bullet List"
      >
        <List size={TOOLBAR_ICON_SIZE} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Numbered List"
      >
        <ListOrdered size={TOOLBAR_ICON_SIZE} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Blockquote"
      >
        <Quote size={TOOLBAR_ICON_SIZE} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        <Minus size={TOOLBAR_ICON_SIZE} />
      </ToolbarButton>

      <ToolbarDivider />

      <CalloutDropdown editor={editor} iconSize={TOOLBAR_ICON_SIZE} />

      <ToolbarDivider />

      <ToolbarButton onClick={onAddImage} disabled={uploading} title="Insert Image">
        {uploading ? (
          <span className="inline-block h-[18px] w-[18px] animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <ImageIcon size={TOOLBAR_ICON_SIZE} />
        )}
      </ToolbarButton>

      <ToolbarButton onClick={onAddYoutube} title="Insert YouTube Video">
        <Youtube size={TOOLBAR_ICON_SIZE} />
      </ToolbarButton>

      <ToolbarButton onClick={onAddAudio} title="Insert Audio">
        <Headphones size={TOOLBAR_ICON_SIZE} />
      </ToolbarButton>

      <ToolbarButton
        onClick={onSetLink}
        active={editor.isActive("link")}
        title="Link"
      >
        <Link2 size={TOOLBAR_ICON_SIZE} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo2 size={TOOLBAR_ICON_SIZE} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo2 size={TOOLBAR_ICON_SIZE} />
      </ToolbarButton>
    </div>
  );
}
