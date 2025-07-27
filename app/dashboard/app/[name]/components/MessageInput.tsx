import { FormEvent } from "react"
import { Send, RefreshCw, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileUpload } from "@/components/file-upload"

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
}: MessageInputProps) => {
  return (
    <div className="p-4 space-y-3 bg-white/95 backdrop-blur-sm">
      {showFileUpload && <FileUpload onFilesChange={setUploadedFiles} />}

      <form onSubmit={handleSendMessage} className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            placeholder="Describe what you want to build or change..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[44px] max-h-32 resize-none pr-12 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage(e)
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
          disabled={!message.trim() || sendMessageMutation.isPending}
          className="h-[44px] px-4"
        >
          {sendMessageMutation.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  )
}
