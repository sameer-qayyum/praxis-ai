import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, ExternalLink, Maximize2, Minimize2 } from "lucide-react"

interface AppHeaderProps {
  app: {
    id: string
    name: string
    app_url: string
    google_sheet?: string
  }
  isDeploying: boolean
  isFullscreen: boolean
  handleDeploy: () => void
  setIsFullscreen: (value: boolean) => void
}

export const AppHeader = ({
  app,
  isDeploying,
  isFullscreen,
  handleDeploy,
  setIsFullscreen,
}: AppHeaderProps) => {
  return (
    <div className="border-b bg-white dark:bg-slate-900 px-6 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">{app.name || `App ${app.id}`}</h1>
        <Badge variant={app.app_url ? "default" : "secondary"} className="text-xs">
          {app.app_url ? "Deployed" : "Not Deployed"}
        </Badge>
        {app.google_sheet && (
          <Badge variant="outline" className="text-xs">
            Google Sheet
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {app.app_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={app.app_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open App
            </a>
          </Button>
        )}
        <Button onClick={handleDeploy} disabled={isDeploying} size="sm">
          <RefreshCw className={`mr-2 h-4 w-4 ${isDeploying ? "animate-spin" : ""}`} />
          {app.app_url ? "Redeploy" : "Deploy"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
