"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import { notFound, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useToast } from "@/components/ui/use-toast"

// Import our custom components
import { AppHeader } from "./components/AppHeader"
import { ChatPanel } from "./components/ChatPanel"
import { PreviewPanel } from "./components/PreviewPanel"
import { AppSkeleton } from "./components/AppSkeleton"
import { MessageInput } from "./components/MessageInput"

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
  template_id: string
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

  // Fetch template data
  const {
    data: templateData,
    isLoading: isLoadingTemplate,
  } = useQuery({
    queryKey: ["template", app?.template_id],
    queryFn: async () => {
      if (!app?.template_id) return null

      const { data, error } = await supabase
        .from("templates")
        .select("user_prompt")
        .eq("id", app.template_id)
        .single()

      if (error) {
        console.error("Error fetching template:", error)
        return null
      }

      return data
    },
    enabled: !!app?.template_id,
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

  // Update messages when chat data and template data changes
  useEffect(() => {
    if (chatData) {
      // Find the first user message index to replace
      const firstUserMessageIndex = chatData.findIndex((msg: any) => msg.role === "user")
      
      const formattedMessages = chatData.map((msg: any, index: number) => {
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
        
        // Replace first user message content with template user_prompt if available
        const userPrompt = templateData?.user_prompt
        if (index === firstUserMessageIndex && msg.role === "user" && userPrompt) {
          content = userPrompt
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
  }, [chatData, templateData?.user_prompt])

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
    return <AppSkeleton />
  }

  if (appError || !app) {
    return notFound()
  }

  return (
    <div className="h-screen flex flex-col bg-white relative">
      {/* Header row - auto height */}
      <AppHeader 
        app={app}
        isDeploying={isDeploying || deployMutation.isPending}
        isFullscreen={isFullscreen}
        handleDeploy={handleDeploy}
        setIsFullscreen={setIsFullscreen}
      />

      {/* Main Content - flex-1 takes all remaining space */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Panel - with relative positioning to contain the input */}
        <div
          className={`border-r bg-white relative ${isFullscreen ? 'hidden' : 'block'}`}
          style={{ width: isFullscreen ? '0' : '30%', height: 'calc(100vh - 64px)' }}
        >
          <ChatPanel 
            isFullscreen={isFullscreen}
            isLoadingChat={isLoadingChat}
            messages={messages}
            message={message}
            setMessage={setMessage}
            handleSendMessage={handleSendMessage}
            showFileUpload={showFileUpload}
            setShowFileUpload={setShowFileUpload}
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
            sendMessageMutation={sendMessageMutation}
            messagesEndRef={messagesEndRef}
          />
        </div>

        {/* Divider - No longer resizable */}
        {!isFullscreen && (
          <div className="w-1 bg-gray-200 flex-shrink-0" />
        )}

        {/* Preview Panel */}
        <PreviewPanel 
          app={app}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isFullscreen={isFullscreen}
          messages={messages}
          isDeploying={isDeploying}
          handleDeploy={handleDeploy}
        />
      </div>

      {/* Message input fixed to viewport with proper margins for footer and sidebar */}
      {!isFullscreen && (
        <div 
          className="fixed bg-white dark:bg-slate-900 shadow-sm z-30 rounded-lg border border-gray-100 dark:border-gray-800" 
          style={{ 
            bottom: '100px', /* Reduced space to match UI in screenshot */
            left: 'calc(70px + 16px)', /* Accounts for collapsed sidebar width + margin */
            width: 'calc(30% - 40px)', /* Account for margins on both sides */
            maxWidth: 'calc(30% - 40px)',
            boxSizing: 'border-box',
            transition: 'all 0.3s ease',
          }}
        >
          <MessageInput
            message={message}
            setMessage={setMessage}
            handleSendMessage={handleSendMessage}
            showFileUpload={showFileUpload}
            setShowFileUpload={setShowFileUpload}
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
            sendMessageMutation={sendMessageMutation}
          />
        </div>
      )}
    </div>
  )
}

export default AppPage
