import { BookOpen } from "lucide-react"
import { Link } from "react-router-dom"
import { useTheme } from "@/context/ThemeContext"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"

interface AuthLayoutProps {
  children: React.ReactNode
  heading: string
  subheading?: string
}

export default function AuthLayout({ children, heading, subheading }: AuthLayoutProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen flex">
      {/* Decorative panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-blue-700 dark:from-primary/80 dark:via-blue-800 dark:to-slate-900">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 -left-10 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-32 right-10 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
          <div className="absolute top-1/2 left-1/3 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-10 text-white">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <BookOpen className="h-7 w-7" />
            <span className="text-xl font-bold tracking-tight">Bible School</span>
          </Link>

          <div className="space-y-6">
            <blockquote className="text-2xl font-light leading-relaxed opacity-95">
              "Study to shew thyself approved unto God, a workman that needeth not to be ashamed."
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/20" />
              <span className="text-sm font-medium opacity-70">2 Timothy 2:15</span>
              <div className="h-px flex-1 bg-white/20" />
            </div>
          </div>

          <p className="text-xs opacity-50">&copy; {new Date().getFullYear()} Bible School</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-bold tracking-tight">Bible School</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={toggleTheme} className="h-8 w-8 p-0">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        {/* Desktop theme toggle */}
        <div className="hidden lg:flex justify-end p-4">
          <Button variant="ghost" size="sm" onClick={toggleTheme} className="h-8 w-8 p-0">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-[420px] space-y-8">
            <div className="space-y-2 text-center lg:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{heading}</h1>
              {subheading && (
                <p className="text-muted-foreground text-sm">{subheading}</p>
              )}
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
