"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, AlertCircle, Shield } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
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
  onDeleteApp?: () => void
  onUpdateAuthSetting?: (requiresAuth: boolean) => void
}

export function AppSettingsDialog({
  isOpen,
  onClose,
  appId,
  appName,
  requiresAuthentication,
  onDeleteApp,
  onUpdateAuthSetting,
}: AppSettingsDialogProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [authEnabled, setAuthEnabled] = useState(requiresAuthentication)
  const router = useRouter()
  const { toast } = useToast()

  const handleAuthToggle = (checked: boolean) => {
    setAuthEnabled(checked)
    // In the future, onUpdateAuthSetting will handle the actual API call
    if (onUpdateAuthSetting) {
      onUpdateAuthSetting(checked)
    } else {
      // Placeholder for future implementation
      toast.info(`Authentication requirement ${checked ? 'enabled' : 'disabled'}. API implementation pending.`)
    }
  }

  const handleDeleteRequest = () => {
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = () => {
    // In the future, onDeleteApp will handle the actual API call
    if (onDeleteApp) {
      onDeleteApp()
    } else {
      // Placeholder for future implementation
      toast.info("App deletion functionality will be implemented soon")
      setDeleteConfirmOpen(false)
      onClose()
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
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete {appName}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
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
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              className="bg-red-600 hover:bg-red-700" 
              onClick={handleDeleteConfirm}
            >
              Delete App
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
