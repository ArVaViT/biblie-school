import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground/30 mb-4">404</h1>
      <h2 className="text-xl font-semibold mb-2">Page not found</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/dashboard">
        <Button>
          <Home className="h-4 w-4 mr-2" />
          Go to Dashboard
        </Button>
      </Link>
    </div>
  )
}
