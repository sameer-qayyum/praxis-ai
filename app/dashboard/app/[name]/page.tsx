"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import { notFound, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Send, RefreshCw, ExternalLink, Code2, Eye, Maximize2, Minimize2, Paperclip, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// Resizable functionality removed
import { ThinkingSection } from "@/components/thinking-section"
import { FileUpload } from "@/components/file-upload"
import ReactMarkdown from "react-markdown"

interface AppData {
  id: string
  chat_id: string
  v0_project_id: string
  vercel_project_id: string
  preview_url: string
  vercel_deployment_id: string
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
  name: string
  status: string
  google_sheet: string
  app_url: string
}

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

const AppPage = () => {
  const params = useParams()
  const { name } = params
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [activeTab, setActiveTab] = useState("preview")
  const [isDeploying, setIsDeploying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const { toast } = useToast()
  // Fixed layout - no longer using resizable

  // Fetch app data
  const {
    data: app,
    isLoading: isLoadingApp,
    error: appError,
  } = useQuery({
    queryKey: ["app", name],
    queryFn: async () => {
      const { data, error } = await supabase.from("apps").select("*").eq("id", name).single()

      if (error) {
        throw new Error(error.message)
      }

      return data as AppData
    },
  })

  // Fetch chat messages
  const {
    data: chatData,
    isLoading: isLoadingChat,
    refetch: refetchChat,
  } = useQuery({
    queryKey: ["chat", app?.chat_id],
    queryFn: async () => {
      if (!app?.chat_id) return null

      const response = await fetch(`/api/v0/messages?chatId=${app.chat_id}`, {
        method: "GET",
      })

      if (!response.ok) {
        throw new Error("Failed to fetch chat messages")
      }

      const data = await response.json()
      return data.messages || []
    },
    enabled: !!app?.chat_id,
  })

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (newMessage: string) => {
      if (!app?.chat_id) return null

      const response = await fetch("/api/v0/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId: app.chat_id,
          message: newMessage,
          isFollowUp: true,
          files: uploadedFiles,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to send message")
      }

      return await response.json()
    },
    onSuccess: () => {
      refetchChat()
      setMessage("")
      setUploadedFiles([])
      setShowFileUpload(false)
    },
    onError: (error: unknown) => {
      toast.error(`Failed to send message: ${error instanceof Error ? error.message : "Unknown error"}`)
    },
  })

  // Deploy/redeploy mutation
  const deployMutation = useMutation({
    mutationFn: async () => {
      if (!app) return null

      setIsDeploying(true)
      const response = await fetch("/api/v0/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId: app.chat_id,
          name: app.name || `App-${app.id}`,
          projectId: app.v0_project_id,
          vercelProjectId: app.vercel_project_id || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to deploy app")
      }

      return await response.json()
    },
    onSuccess: (data: any) => {
      toast.success(`Your app has been deployed to ${data.url}`)
      setIsDeploying(false)
    },
    onError: (error: unknown) => {
      toast.error(`Failed to deploy app: ${error instanceof Error ? error.message : "Unknown error"}`)
      setIsDeploying(false)
    },
  })

  // Update messages when chat data changes
  useEffect(() => {
    if (chatData) {
      const formattedMessages = chatData.map((msg: any) => {
        let content = msg.content
        let thinking = null

        // Extract thinking content from <Thinking></Thinking> tags
        if (msg.role === "assistant" && content) {
          const thinkingMatch = content.match(/<Thinking>([\s\S]*?)<\/Thinking>/i)
          if (thinkingMatch) {
            thinking = thinkingMatch[1].trim()
            // Remove the thinking tags from the main content
            content = content.replace(/<Thinking>[\s\S]*?<\/Thinking>/i, "").trim()
          }
        }

        return {
          id: msg.id,
          role: msg.role,
          content: content,
          timestamp: msg.created_at,
          thinking: thinking,
          files: msg.files || [],
        }
      })
      setMessages(formattedMessages)
    }
  }, [chatData])

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate(message)
    }
  }

  const handleDeploy = () => {
    if (!isDeploying && !deployMutation.isPending) {
      deployMutation.mutate()
    }
  }

  if (isLoadingApp) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (appError || !app) {
    return notFound()
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">{app.name || `App ${app.id}`}</h1>
              <Badge variant={app.app_url ? "default" : "secondary"} className="text-xs">
                {app.app_url ? "Deployed" : "Not Deployed"}
              </Badge>
              {app.google_sheet && (
                <Badge variant="outline" className="text-xs">
                  Google Sheet
                </Badge>
              )}
            </div>
          </div>
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
          <Button onClick={handleDeploy} disabled={isDeploying || deployMutation.isPending} size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${isDeploying ? "animate-spin" : ""}`} />
            {app.app_url ? "Redeploy" : "Deploy"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div
          className="border-r bg-white flex flex-col h-full"
          style={{
            width: isFullscreen ? 0 : '30%'
          }}
        >
          {!isFullscreen && (
            <>
              <div className="p-4 border-b flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  <h2 className="font-medium text-gray-900">Chat with Praxis</h2>
                </div>
              </div>

              <ScrollArea className="flex-1 px-4 h-full overflow-auto">
                <div className="space-y-3 py-3">
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
              </ScrollArea>

              <div className="border-t p-4 space-y-3 flex-shrink-0">
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
            </>
          )}
        </div>

        {/* Divider - No longer resizable */}
        {!isFullscreen && (
          <div className="w-1 bg-gray-200 flex-shrink-0" />
        )}

        {/* Preview Panel - Takes remaining space */}
        <div className="flex flex-col bg-gray-50" style={{ width: isFullscreen ? '100%' : '70%' }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
            <div className="border-b bg-white px-4 py-3 flex-shrink-0">
              <TabsList className="grid w-[200px] grid-cols-2">
                <TabsTrigger value="preview" className="text-xs">
                  <Eye className="mr-1 h-3 w-3" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="code" className="text-xs">
                  <Code2 className="mr-1 h-3 w-3" />
                  Code
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="preview" className="flex-1 m-0 overflow-hidden">
              {app.preview_url ? (
                <iframe
                  src={app.preview_url}
                  title="App Preview"
                  className="w-full h-full border-0 bg-white"
                  style={{ minHeight: "100%" }}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
                      <Eye className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No preview available</h3>
                    <p className="text-sm text-gray-500 mb-4 max-w-sm">Deploy your app to see a live preview here</p>
                    <Button onClick={handleDeploy} disabled={isDeploying}>
                      <RefreshCw className={`mr-2 h-4 w-4 ${isDeploying ? "animate-spin" : ""}`} />
                      Deploy App
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="code" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4">
                  {messages.length > 0 ? (
                    <div className="space-y-6">
                      {messages.map((msg) =>
                        msg.files && msg.files.length > 0 ? (
                          <div key={`${msg.id}-files`} className="space-y-4">
                            {msg.files.map((file, index) => (
                              <Card key={`${msg.id}-file-${index}`} className="overflow-hidden">
                                <CardHeader className="py-2 px-3 bg-gray-50 border-b">
                                  <CardTitle className="text-sm font-mono">
                                    {file.meta?.file || file.name || `File ${index + 1}`}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                  <pre className="p-4 overflow-auto text-xs bg-gray-900 text-gray-100">
                                    <code>{file.source || file.content || ""}</code>
                                  </pre>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : null,
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <Code2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No code files available</p>
                        <p className="text-gray-400 text-sm mt-1">Generated code will appear here</p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

export default AppPage
