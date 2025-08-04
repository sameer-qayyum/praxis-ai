import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { RefreshCw, ExternalLink, Maximize2, Minimize2, Pencil, Check } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { AppPermissionsButton } from "./permissions/AppPermissionsButton"
import { AppSettingsButton } from "./settings/AppSettingsButton"

interface AppHeaderProps {
  app: {
    id: string
    name: string
    app_url: string
    google_sheet?: string
    requires_authentication?: boolean
  }
  isDeploying: boolean
  isFullscreen: boolean
  handleDeploy: () => void
  setIsFullscreen: (value: boolean) => void
  currentUserId: string
  sendMessageMutation?: any // Add sendMessageMutation to be passed to settings dialog
}

export const AppHeader = ({
  app,
  isDeploying,
  isFullscreen,
  handleDeploy,
  setIsFullscreen,
  currentUserId,
  sendMessageMutation,
}: AppHeaderProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [appName, setAppName] = useState(app.name || `App ${app.id}`)
  const [previousName, setPreviousName] = useState(app.name || `App ${app.id}`)
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  
  // Update app name mutation
  const updateAppNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const { data, error } = await supabase
        .from("apps")
        .update({ name: newName })
        .eq("id", app.id)
        .select()
      
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app", app.id] })
      toast.success("App name updated successfully")
      setIsEditing(false)
    },
    onError: (error) => {
      toast.error(`Error updating app name: ${error.message}`)
      setAppName(previousName) // Revert to previous name
      setIsEditing(false)
    }
  })
  
  const handleEditStart = () => {
    setPreviousName(appName)
    setIsEditing(true)
  }
  
  const handleSaveName = () => {
    if (appName.trim() === "") {
      setAppName(previousName)
      setIsEditing(false)
      return
    }
    
    if (appName !== previousName) {
      updateAppNameMutation.mutate(appName)
    } else {
      setIsEditing(false)
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName()
    } else if (e.key === "Escape") {
      setAppName(previousName)
      setIsEditing(false)
    }
  }
  return (
    <div className="border-b bg-white dark:bg-slate-900 px-6 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {isEditing ? (
          <div className="flex items-center">
            <Input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveName}
              autoFocus
              className="max-w-[200px] h-7 text-base font-semibold py-0 px-1"
              aria-label="Edit app name"
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 ml-1" 
              onClick={handleSaveName}
              disabled={updateAppNameMutation.isPending}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div 
            className="flex items-center group cursor-pointer" 
            onClick={handleEditStart}
            role="button"
            tabIndex={0}
            aria-label="Edit app name"
          >
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">{appName}</h1>
            <Pencil className="h-3.5 w-3.5 ml-1.5 opacity-0 group-hover:opacity-70 text-gray-600 dark:text-gray-400" />
          </div>
        )}
        <Badge variant={app.app_url ? "default" : "secondary"} className="text-xs">
          {app.app_url ? "Deployed" : "Not Deployed"}
        </Badge>
      </div>

      {/* Action buttons - all grouped on the right */}
      <div className="flex items-center gap-2">
        {app.app_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={app.app_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open App
            </a>
          </Button>
        )}

        <Button
          variant={isDeploying ? "secondary" : "default"}
          size="sm"
          onClick={handleDeploy}
          disabled={isDeploying}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isDeploying ? "animate-spin" : ""}`}
          />
          {isDeploying ? "Deploying..." : "Deploy"}
        </Button>
        
        {/* Permissions Button */}
        <AppPermissionsButton 
          appId={app.id}
          currentUserId={currentUserId}
        />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>

        <AppSettingsButton
          appId={app.id}
          appName={app.name || `App ${app.id}`}
          requiresAuthentication={!!app.requires_authentication}
          sendMessageMutation={sendMessageMutation}
        />
      </div>
    </div>
  )
}
