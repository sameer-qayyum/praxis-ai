"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, AlertCircle, Shield } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface AppSettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  appId: string
  appName: string
  requiresAuthentication: boolean
  sendMessageMutation?: any // Add the sendMessageMutation from parent
  onDeleteApp?: () => void
  onUpdateAuthSetting?: (requiresAuth: boolean) => void
}

export function AppSettingsDialog({
  isOpen,
  onClose,
  appId,
  appName,
  requiresAuthentication,
  sendMessageMutation,
  onDeleteApp,
  onUpdateAuthSetting,
}: AppSettingsDialogProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [authEnabled, setAuthEnabled] = useState(requiresAuthentication)
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const supabase = createClient()

  // Update app authentication setting mutation
  const updateAuthMutation = useMutation({
    mutationFn: async (requiresAuth: boolean) => {
      // 1. Update app's requires_authentication field in database
      const { data, error } = await supabase
        .from("apps")
        .update({ requires_authentication: requiresAuth })
        .eq("id", appId)
        .select()

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["app", appId] })
      toast.success(`Authentication requirement ${authEnabled ? 'enabled' : 'disabled'}.`)
    },
    onError: (error) => {
      // Revert UI state if the update fails
      setAuthEnabled(!authEnabled)
      toast.error(`Failed to update authentication setting: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })

  // We'll use the existing sendMessageMutation from props instead of creating our own

  const handleAuthToggle = async (checked: boolean) => {
    setAuthEnabled(checked)
    
    // Message to send when enabling authentication
    const authEnableMessage=`


        AUTHENTICATION REQUIREMENTS:

        This app requires users to be authenticated before accessing content. Implement authentication as follows:

        1. Authentication Check API:

        GET ${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/check

        Include credentials in the request:
        - fetch(..., { credentials: 'include' })
        - This ensures cookies are sent with the request

        2. API Response Format:

        Success Response (200 OK):
        {
          "authenticated": true,
          "authorized": true,
          "user": {
            "id": "user-uuid",
            "email": "user@example.com"
          },
          "permission": "admin" // or "editor", "viewer"
        }

        Unauthenticated Response (401 Unauthorized):
        {
          "authenticated": false,
          "redirectUrl": "${process.env.NEXT_PUBLIC_SITE_URL}/sign-in"
        }

        Unauthorized Response (403 Forbidden):
        {
          "authenticated": true,
          "authorized": false,
          "message": "You do not have permission to access this app"
        }

        3. Implementation Requirements:

        - Check authentication on initial app load
        - For unauthenticated users, redirect to the login URL from the response
        - For authenticated but unauthorized users, display an appropriate access denied message
        - Store user info in app state for displaying user-specific content
        - Permission level can be used to show/hide features based on user role

        4. Example Authentication Check Implementation:

        Example code:
        async function checkAuth() {
          try {
            const response = await fetch('${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/check', {
              credentials: 'include'
            });
            const data = await response.json();
            
            if (!data.authenticated) {
              // User not authenticated, redirect to login
              window.location.href = data.redirectUrl;
              return null;
            }
            
            if (!data.authorized) {
              // User authenticated but not authorized
              // Display access denied message to user
              displayAccessDeniedMessage(data.message);
              return null;
            }
            
            // User is authenticated and authorized
            return data.user;
          } catch (error) {
            console.error('Authentication check failed:', error);
            // Show error message
            return null;
          }
        }

        Call this function when the app loads and before accessing protected resources.`;
    
    // Message to send when disabling authentication
    const authDisableMessage = `


        AUTHENTICATION DISABLED:

        This app should be accessible to anyone without requiring authentication. Please update the app to:

        1. Remove any authentication checks at app initialization
        
        2. Remove any login/redirect flows related to authentication
        
        3. Make all content and functionality publicly available
        
        4. Remove any UI elements that show login status or user information
        
        5. If the app was previously requiring authentication, verify that all pages and routes
           are now accessible without login credentials

        Note: The app will still be accessible to authenticated users, but authentication
        should not be required or enforced in any way.`;
    
    // Update the database setting
    updateAuthMutation.mutate(checked)
    
    // Send a message through the API based on the new authentication setting
    if (sendMessageMutation) {
      // Wait for the update to complete before sending message
      setTimeout(() => {
        // Use the shared sendMessageMutation from props to send the auth instructions
        if (checked) {
          // Enabling authentication
          sendMessageMutation.mutate(authEnableMessage)
        } else if (!checked && requiresAuthentication) {
          // Disabling authentication that was previously enabled
          sendMessageMutation.mutate(authDisableMessage)
        }
      }, 500) // Small delay to ensure update completes first
    }
    
    // Notify any parent handlers if provided
    if (onUpdateAuthSetting) {
      onUpdateAuthSetting(checked)
    }
  }

  const handleDeleteRequest = () => {
    setDeleteConfirmOpen(true)
  }
  
  // Delete app mutation
  const deleteAppMutation = useMutation({
    mutationFn: async () => {
      // Delete the app from the database
      const { error } = await supabase
        .from("apps")
        .delete()
        .eq("id", appId)
      
      if (error) throw new Error(error.message)
      return { success: true }
    },
    onSuccess: () => {
      toast.success(`App "${appName}" has been deleted`)
      setDeleteConfirmOpen(false)
      onClose()
      // Navigate back to the apps list
      setTimeout(() => router.push("/dashboard/apps"), 500)
    },
    onError: (error) => {
      toast.error(`Failed to delete app: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setDeleteConfirmOpen(false)
    }
  })

  const handleDeleteConfirm = () => {
    // Use parent handler if provided
    if (onDeleteApp) {
      onDeleteApp()
      setDeleteConfirmOpen(false)
    } else {
      // Otherwise use our mutation
      deleteAppMutation.mutate()
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>App Settings</DialogTitle>
            <DialogDescription>
              Configure your application settings and manage your app
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-6">
            {/* Authentication Settings Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Authentication</h3>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center">
                      <Shield className="h-4 w-4 mr-2 text-blue-500" />
                      <Label htmlFor="auth-required" className="font-medium">
                        Require Authentication
                      </Label>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      When enabled, users must sign in before accessing your app
                    </p>
                  </div>
                  <Switch 
                    id="auth-required"
                    checked={authEnabled}
                    onCheckedChange={handleAuthToggle}
                    disabled={updateAuthMutation.isPending}
                  />
                </div>
              </div>
            </div>

            {/* Danger Zone Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Danger Zone</h3>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800">
                <div className="flex items-start space-x-4">
                  <div className="bg-red-100 dark:bg-red-800 rounded-full p-2 mt-1">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-300" />
                  </div>
                  <div className="space-y-3 flex-1">
                    <div>
                      <h4 className="font-medium text-red-900 dark:text-red-300">Delete this app</h4>
                      <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                        Permanently delete this application and all its data. This action cannot be undone.
                      </p>
                    </div>
                    <Button 
                      variant="destructive" 
                      onClick={handleDeleteRequest}
                      className="bg-red-600 hover:bg-red-700"
                      disabled={deleteAppMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleteAppMutation.isPending ? "Deleting..." : `Delete ${appName}`}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={updateAuthMutation.isPending || deleteAppMutation.isPending}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action will permanently delete the app "{appName}" and all associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleteAppMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              className="bg-red-600 hover:bg-red-700" 
              onClick={handleDeleteConfirm}
              disabled={deleteAppMutation.isPending}
            >
              {deleteAppMutation.isPending ? (
                <>
                  <span className="animate-pulse mr-2">●</span>
                  Deleting...
                </>
              ) : "Delete App"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
