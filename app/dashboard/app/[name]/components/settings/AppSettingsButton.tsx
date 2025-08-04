"use client"

import { useState } from "react"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AppSettingsDialog } from "./AppSettingsDialog"

interface AppSettingsButtonProps {
  appId: string
  appName: string
  requiresAuthentication: boolean
}

export function AppSettingsButton({ appId, appName, requiresAuthentication }: AppSettingsButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const openDialog = () => {
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              onClick={openDialog}
              aria-label="App Settings"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>App Settings</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AppSettingsDialog
        isOpen={isDialogOpen}
        onClose={closeDialog}
        appId={appId}
        appName={appName}
        requiresAuthentication={requiresAuthentication}
      />
    </>
  )
}
