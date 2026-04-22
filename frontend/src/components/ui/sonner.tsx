import { Toaster as SonnerToaster } from "sonner"
import { useTheme } from "@/context/useTheme"

export function Toaster() {
  const { theme } = useTheme()
  return (
    <SonnerToaster
      theme={theme === "dark" ? "dark" : "light"}
      position="bottom-right"
      closeButton
      richColors={false}
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            "group bg-background text-foreground border border-border shadow-lg rounded-md text-sm",
          title: "font-medium",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
          error: "border-destructive/40",
          success: "border-success/40",
          warning: "border-warning/40",
          info: "border-info/40",
        },
      }}
    />
  )
}
