import { FormEvent, useState, useEffect } from "react"
import { Send, RefreshCw, Paperclip, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileUpload } from "@/components/file-upload"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"

interface MessageInputProps {
  message: string
  setMessage: (message: string) => void
  handleSendMessage: (e: FormEvent) => void
  showFileUpload: boolean
  setShowFileUpload: (value: boolean) => void
  uploadedFiles: any[]
  setUploadedFiles: (files: any[]) => void
  sendMessageMutation: {
    isPending: boolean
  }
  app: {
    id: string
    name: string
    created_by: string
    [key: string]: any
  } | null | undefined
  userId: string
}

export const MessageInput = ({
  message,
  setMessage,
  handleSendMessage,
  showFileUpload,
  setShowFileUpload,
  uploadedFiles,
  setUploadedFiles,
  sendMessageMutation,
  app,
  userId,
}: MessageInputProps) => {
  const { toast } = useToast()
  const supabase = createClient()
  const [userPermission, setUserPermission] = useState<string | null>(null)
  const [isPermissionLoading, setIsPermissionLoading] = useState(true)
  const [showPermissionDialog, setShowPermissionDialog] = useState(false)
  
  // Check user permission for this app
  useEffect(() => {
    const fetchUserPermission = async () => {
      if (!app?.id || !userId) {
        setIsPermissionLoading(false)
        return
      }
      
      try {
        // Check if user is the app creator (automatic admin)
        if (app.created_by === userId) {
          setUserPermission('admin')
          setIsPermissionLoading(false)
          return
        }
        
        // Otherwise check permissions table
        const { data, error } = await supabase
          .from('app_permissions')
          .select('permission_level')
          .eq('app_id', app.id)
          .eq('user_id', userId)
          .single()
        
        if (error) {
          console.error('Error fetching user permissions:', error)
          // No explicit permission record found
          setUserPermission('viewer') // Default to viewer
        } else if (data) {
          setUserPermission(data.permission_level)
        } else {
          setUserPermission('viewer') // Default to viewer
        }
      } catch (error) {
        console.error('Permission check failed:', error)
        setUserPermission('viewer') // Default to viewer on error
      } finally {
        setIsPermissionLoading(false)
      }
    }
    
    fetchUserPermission()
  }, [app?.id, userId, supabase])
  
  // Wrapper for handleSendMessage that checks permissions first
  const handleSubmitWithPermissionCheck = (e: FormEvent) => {
    e.preventDefault()
    
    // Don't process if loading
    if (isPermissionLoading) {
      return
    }
    
    // Check if user has permission to edit (admin or editor)
    if (userPermission === 'admin' || userPermission === 'editor') {
      // User has permission, proceed with normal send
      handleSendMessage(e)
    } else {
      // User doesn't have permission, show dialog
      setShowPermissionDialog(true)
    }
  }
  
  return (
    <div className="p-4 space-y-3 bg-white/95 backdrop-blur-sm">
      {showFileUpload && <FileUpload onFilesChange={setUploadedFiles} />}

      {/* Permission denied dialog */}
      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Permission Required
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>
            <p className="mb-4">You do not have permission to send messages or make changes to this app.</p>
            <p>Please contact the app administrator to request editor or admin access.</p>
          </DialogDescription>
        </DialogContent>
      </Dialog>

      <form onSubmit={handleSubmitWithPermissionCheck} className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            placeholder="Describe what you want to build or change..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[44px] max-h-32 resize-none pr-12 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmitWithPermissionCheck(e)
              }
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1 h-8 w-8 p-0"
            onClick={() => setShowFileUpload(!showFileUpload)}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={!message.trim() || sendMessageMutation.isPending || isPermissionLoading}
          className="h-[44px] px-4"
        >
          {sendMessageMutation.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : isPermissionLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  )
}
