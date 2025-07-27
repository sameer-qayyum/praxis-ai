import { useRef, FormEvent } from "react"
import { Sparkles } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import ReactMarkdown from "react-markdown"
import { ThinkingSection } from "@/components/thinking-section"
import { MessageInput } from "./MessageInput"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  thinking?: string
  files?: Array<{
    name?: string
    meta?: {
      file?: string
      lang?: string
    }
    source?: string
    content?: string
  }>
}

interface ChatPanelProps {
  isFullscreen: boolean
  isLoadingChat: boolean
  messages: Message[]
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
  messagesEndRef: React.RefObject<HTMLDivElement> | React.MutableRefObject<HTMLDivElement | null>
}

export const ChatPanel = ({
  isFullscreen,
  isLoadingChat,
  messages,
  message,
  setMessage,
  handleSendMessage,
  showFileUpload,
  setShowFileUpload,
  uploadedFiles,
  setUploadedFiles,
  sendMessageMutation,
  messagesEndRef,
}: ChatPanelProps) => {
  if (isFullscreen) {
    return null
  }

  return (
    <div className="h-full grid grid-rows-[auto_1fr_auto]">
      {/* Header - fixed at the top */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600" />
          <h2 className="font-medium text-gray-900">Chat with Praxis</h2>
        </div>
      </div>

      {/* Scrollable messages area - takes remaining space */}
      <div className="overflow-auto px-4">
        <div className="space-y-3 py-3 pb-[80px]" /* Extra padding to prevent content hiding under input */>
          {isLoadingChat ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))
          ) : messages.length > 0 ? (
            messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                <div className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    {msg.role === "assistant" ? (
                      <>
                        <AvatarImage src="/placeholder.svg?height=32&width=32" alt="Praxis" />
                        <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">Praxis</AvatarFallback>
                      </>
                    ) : (
                      <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">U</AvatarFallback>
                    )}
                  </Avatar>

                  <div className={`flex-1 space-y-1 ${msg.role === "user" ? "text-right" : ""}`}>
                    <div
                      className={`inline-block max-w-[85%] rounded-lg py-2 px-0 text-sm ${
                        msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none px-2 !mx-0 !my-0 prose-p:my-1 prose-p:!mx-0 prose-headings:mt-2 prose-headings:mb-1 prose-headings:!mx-0 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-strong:font-semibold prose-code:text-slate-800 prose-code:bg-slate-100 dark:prose-code:text-slate-200 dark:prose-code:bg-slate-700 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-pre:bg-slate-100 prose-pre:text-slate-800 dark:prose-pre:bg-slate-700 dark:prose-pre:text-slate-200 prose-pre:p-2 prose-pre:rounded dark:prose-invert">
                          <ReactMarkdown>
                            {msg.content.includes("</CodeProject>") 
                              ? msg.content.split("</CodeProject>")[1].trim()
                              : msg.content
                            }
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap px-2">{msg.content}</div>
                      )}
                    </div>

                    {msg.thinking && (
                      <div className="max-w-[85%]">
                        <ThinkingSection content={msg.thinking} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-full text-center py-12">
              <div>
                <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-sm">Start a conversation with Praxis</p>
                <p className="text-gray-400 text-xs mt-1">Ask questions or request changes to your app</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message input moved to page level for better viewport attachment */}
    </div>
  )
}
