import { Node, mergeAttributes } from "@tiptap/core"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    audioEmbed: {
      setAudio: (options: { src: string }) => ReturnType
    }
  }
}

/**
 * Inline audio player. Only ``http(s)`` sources are accepted — the same
 * scheme whitelist the HTML sanitizer enforces on read, so authored content
 * and rendered output stay in sync.
 */
export const AudioEmbed = Node.create({
  name: "audioEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: "audio",
        getAttrs: (el) => {
          const node = el as HTMLAudioElement
          const src =
            node.getAttribute("src") ||
            node.querySelector("source")?.getAttribute("src") ||
            ""
          if (!/^https?:\/\//i.test(src)) return false
          return { src }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "audio",
      mergeAttributes(HTMLAttributes, {
        controls: "",
        preload: "metadata",
        class: "w-full my-4",
      }),
    ]
  },

  addCommands() {
    return {
      setAudio:
        (options) =>
        ({ commands }) => {
          if (!/^https?:\/\//i.test(options.src)) return false
          return commands.insertContent({
            type: this.name,
            attrs: { src: options.src },
          })
        },
    }
  },
})
