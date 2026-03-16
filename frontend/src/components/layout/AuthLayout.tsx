import { BookOpen } from "lucide-react"
import { Link } from "react-router-dom"
import { useTheme } from "@/context/useTheme"
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
      {/* Decorative panel — deep navy / indigo */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] relative overflow-hidden bg-[hsl(224,71%,14%)] dark:bg-[hsl(222,47%,6%)]">
        <div className="absolute inset-0">
          <div className="absolute top-20 -left-10 h-72 w-72 rounded-full bg-[hsl(40,60%,50%)]/5 blur-3xl" />
          <div className="absolute bottom-32 right-10 h-56 w-56 rounded-full bg-[hsl(40,60%,50%)]/4 blur-2xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-10 text-white/90">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <BookOpen className="h-6 w-6 text-[hsl(40,60%,65%)]" />
            <span className="font-serif text-xl font-bold tracking-tight">Bible School</span>
          </Link>

          <div className="space-y-8">
            <div className="w-12 h-px bg-[hsl(40,60%,50%)]/40" />
            <blockquote className="font-serif text-2xl font-normal italic leading-relaxed text-white/80">
              "Study to shew thyself approved unto God, a workman that needeth not to be ashamed."
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs font-sans uppercase tracking-widest text-[hsl(40,60%,65%)]/70">2 Timothy 2:15</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
          </div>

          <p className="text-xs font-sans text-white/30">&copy; {new Date().getFullYear()} Bible School Seminary</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-border/60 bg-background/90 backdrop-blur-sm">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
            <BookOpen className="h-5 w-5 text-accent" />
            <span className="font-serif font-bold tracking-tight">Bible School</span>
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
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">{heading}</h1>
              {subheading && (
                <p className="text-muted-foreground text-sm font-sans">{subheading}</p>
              )}
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
