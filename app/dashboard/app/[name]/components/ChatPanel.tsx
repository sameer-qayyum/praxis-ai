import { useRef, FormEvent, useState, useEffect } from "react"
import { Sparkles } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import ReactMarkdown from "react-markdown"
import { ThinkingSection } from "@/components/thinking-section"
import { TypewriterEffect } from "@/components/typewriter-effect"
import { replaceSystemPromptsWithUserPrompts, type Prompt } from "@/lib/prompts"


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
  const [prompts, setPrompts] = useState<Prompt[]>([])

  // Fetch prompts for content replacement
  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const response = await fetch('/api/prompts')
        const data = await response.json()
        if (data.success && data.prompts) {
          setPrompts(data.prompts)
        }
      } catch (error) {
        console.error('Failed to fetch prompts:', error)
      }
    }
    fetchPrompts()
  }, [])

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
              <div key={msg.id} className="space-y-2 space-x-2 full-width" >
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

                  <div className={`flex-1 space-y-2 ${msg.role === "user" ? "text-right" : ""}`}>
                    {/* Show thinking section before assistant message */}
                    {msg.thinking && msg.role === "assistant" && (
                      <div className="max-w-[90%]">
                        <ThinkingSection content={msg.thinking} />
                      </div>
                    )}

                    <div
                      className={`inline-block rounded-lg py-0 px-0 text-sm ${
                        msg.role === "user" ? "bg-gray-100 text-black-100 max-w-[80%]" : "bg-white-100 text-gray-900"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        msg.content === "BUILDING_PLACEHOLDER" ? (
                          <div className="px-2 py-3 text-blue-600">
                            <TypewriterEffect 
                              text="Generating your app..." 
                              speed={150}
                              className="text-sm font-medium"
                            />
                          </div>
                        ) : (
                          <div className="max-w-[100%] prose prose-sm px-2 !mx-0 !my-0 prose-p:my-1 prose-p:!mx-0 prose-headings:mt-2 prose-headings:mb-1 prose-headings:!mx-0 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-strong:font-semibold prose-code:text-slate-800 prose-code:bg-slate-100 dark:prose-code:text-slate-200 dark:prose-code:bg-slate-700 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-pre:bg-slate-100 prose-pre:text-slate-800 dark:prose-pre:bg-slate-700 dark:prose-pre:text-slate-200 prose-pre:p-2 prose-pre:rounded dark:prose-invert">
                            <ReactMarkdown>
                              {(() => {
                                let cleanContent = msg.content;
                                
                                // Remove <Thinking>...</Thinking> blocks (these should be in the thinking section)
                                cleanContent = cleanContent.replace(/<Thinking>[\s\S]*?<\/Thinking>/gi, '');
                                
                                // Remove <V0LaunchTasks>...</V0LaunchTasks> blocks
                                cleanContent = cleanContent.replace(/<V0LaunchTasks>[\s\S]*?<\/V0LaunchTasks>/gi, '');
                                
                                // Remove <CodeProject>...</CodeProject> blocks  
                                cleanContent = cleanContent.replace(/<CodeProject[\s\S]*?<\/CodeProject>/gi, '');
                                
                                // Handle legacy </CodeProject> split logic
                                if (cleanContent.includes("</CodeProject>")) {
                                  cleanContent = cleanContent.split("</CodeProject>")[1];
                                }
                                
                                // Replace system prompts with user-friendly descriptions
                                if (prompts.length > 0) {
                                  cleanContent = replaceSystemPromptsWithUserPrompts(cleanContent, prompts);
                                }
                                
                                return cleanContent.trim();
                              })()}
                            </ReactMarkdown>
                          </div>
                        )
                      ) : (
                        <div className="whitespace-pre-wrap px-2 full-width">{msg.content}</div>
                      )}
                    </div>
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
