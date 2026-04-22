import { Node, mergeAttributes } from "@tiptap/core"
import { toYouTubeEmbedUrl } from "@/lib/youtubeUrl"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    youtubeEmbed: {
      setYoutubeVideo: (options: { src: string }) => ReturnType
    }
  }
}

export const YoutubeEmbed = Node.create({
  name: "youtubeEmbed",
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
        tag: "div[data-youtube-embed]",
        getAttrs: (el) => {
          const iframe = (el as HTMLElement).querySelector("iframe")
          return { src: iframe?.getAttribute("src") || null }
        },
      },
      {
        tag: "iframe",
        getAttrs: (el) => {
          const src = (el as HTMLIFrameElement).getAttribute("src") || ""
          if (src.includes("youtube.com/embed/") || src.includes("youtube-nocookie.com/embed/")) {
            return { src }
          }
          return false
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      { "data-youtube-embed": "", class: "youtube-embed-wrapper" },
      [
        "iframe",
        mergeAttributes(HTMLAttributes, {
          width: "100%",
          height: "400",
          frameborder: "0",
          allowfullscreen: "true",
          allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
          loading: "lazy",
        }),
      ],
    ]
  },

  addCommands() {
    return {
      setYoutubeVideo:
        (options) =>
        ({ commands }) => {
          const embedUrl = toYouTubeEmbedUrl(options.src)
          if (!embedUrl) return false
          return commands.insertContent({
            type: this.name,
            attrs: { src: embedUrl },
          })
        },
    }
  },
})
