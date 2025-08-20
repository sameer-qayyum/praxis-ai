"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { UserPermissionsDialog } from "./UserPermissionsDialog"
import { Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface AppPermissionsButtonProps {
  appId: string
  currentUserId: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm"
}

export function AppPermissionsButton({
  appId,
  currentUserId,
  variant = "outline",
  size = "sm",
}: AppPermissionsButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const supabase = createClient()

  // Fetch app permissions count
  const { data, isLoading } = useQuery({
    queryKey: ["app-permissions-count", appId],
    queryFn: async () => {
      console.log('🔢 [PERMISSIONS BUTTON] Fetching permissions count for app:', appId)
      
      const { count, error } = await supabase
        .from("app_permissions")
        .select("*", { count: "exact", head: true })
        .eq("app_id", appId)

      console.log('📊 [PERMISSIONS BUTTON] Count query result:', { 
        count, 
        error, 
        appId 
      })

      if (error) {
        console.error('❌ [PERMISSIONS BUTTON] Count query error:', error)
        throw new Error(error.message)
      }
      
      console.log('✅ [PERMISSIONS BUTTON] Final count:', count || 0)
      return count || 0
    },
  })

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant={variant}
              size={size}
              className="relative"
              onClick={() => setIsDialogOpen(true)}
            >
              <Users className="h-4 w-4 mr-1" />
              <span>Users</span>
              {!isLoading && typeof data === 'number' && data > 0 && (
                <Badge 
                  variant="secondary" 
                  className="ml-1 bg-primary text-primary-foreground h-5 min-w-5 px-1 rounded-full text-xs flex items-center justify-center"
                >
                  {data}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Manage who can access this app</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <UserPermissionsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        appId={appId}
        currentUserId={currentUserId}
      />
    </>
  )
}
