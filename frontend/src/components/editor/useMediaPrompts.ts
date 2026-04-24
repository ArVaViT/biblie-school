import { useCallback } from "react";
import type { Editor } from "@tiptap/react";

import { usePrompt } from "@/components/ui/alert-dialog";
import { toast } from "@/lib/toast";
import type { useImageUpload } from "./useImageUpload";

/**
 * Bundles the "media insert" handlers that all rely on a URL prompt:
 * link, image (with upload + URL fallback), YouTube, audio.
 *
 * Pulling these out of the RichTextEditor component keeps the component
 * focused on rendering and lets the handlers be replaced or tested in
 * isolation if needed.
 */
export function useMediaPrompts(
  editor: Editor | null,
  imageUpload: ReturnType<typeof useImageUpload>,
) {
  const prompt = usePrompt();

  const setLink = useCallback(async () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = await prompt({
      title: "Add link",
      description:
        "Paste or type the URL you want to link to. Leave empty to remove an existing link.",
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
      const inserted = await imageUpload.uploadAndInsert(file, editor);
      if (inserted) return;
      // Upload failed: give the user an escape hatch so they can paste
      // an existing URL instead of silently losing their action.
      const url = await prompt({
        title: "Upload failed",
        description: "We couldn't upload the file. Paste an image URL instead, or cancel.",
        placeholder: "https://…",
        inputType: "url",
        confirmLabel: "Insert",
      });
      if (url) editor.chain().focus().setImage({ src: url }).run();
    };
    input.click();
  }, [editor, imageUpload, prompt]);

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

  return { setLink, addImage, addYoutube, addAudio };
}
