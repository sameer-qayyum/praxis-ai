"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import { notFound, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/components/ui/use-toast"
import { FormSubmissionUrl } from "@/components/dashboard/FormSubmissionUrl";

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
  number_of_messages?: number
  last_synced?: string
  active_fields_text?: string
  fields_metadata_json?: string
  path_secret?: string
  requires_authentication?: boolean
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
  const queryClient = useQueryClient()
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [fullChatData, setFullChatData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("preview")
  const [isDeploying, setIsDeploying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string>("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const { toast } = useToast()
  // Fixed layout - no longer using resizable

  // Fetch app data
  const {
    data: app,
    isLoading: isLoadingApp,
    error: appError,
    refetch: refetchApp
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

  // Check if app needs generation
  const [isGenerating, setIsGenerating] = useState(false)
  // Track whether we've already attempted generation for this app ID
  const [hasAttemptedGeneration, setHasAttemptedGeneration] = useState(false)
  
  // Log app data on first load and trigger chat message fetch if we have a chat_id
  useEffect(() => {
    if (app?.id) {
      // If we already have a chat_id, explicitly trigger chat message fetch
      if (app.chat_id) {
        console.log('💬 App has existing chat_id, triggering message fetch:', app.chat_id);
        // The query is set to enabled: !!app?.chat_id, so it will auto-fetch
        // but we can explicitly trigger it to be sure
        refetchChat();
      }
    }
  }, [app?.id, app?.chat_id])

  const generateAppMutation = useMutation({
    mutationFn: async () => {
      
      // Double-check we have an app without chat_id
      if (!app?.id) {
        console.error('No app ID available - cannot generate');
        throw new Error('No app ID available for generation');
      }
      
      if (app.chat_id) {
        console.warn('App already has chat_id:', app.chat_id, '- skipping generation');
        return { success: true, message: 'App already has chat_id, no generation needed' };
      }
      try {
        // 3. Get the template's base prompt and API access requirements
        const { data: templateData, error: templateError } = await supabase
          .from('templates')
          .select('user_prompt, sheet_api_access, base_prompt')
          .eq('id', app.template_id)
          .single();
        const { data: sheetData, error: sheetError } = await supabase
          .from("google_sheets_connections") // Note: Fixed table name from google_sheet_connections to google_sheets_connections
          .select("*")
          .eq("id", app.google_sheet)
          .single()
        
        if (!sheetData || sheetError) {
          console.error('Failed to fetch sheet data:', { error: sheetError, sheetId: app.google_sheet });
          throw new Error(`Sheet data not found for ID: ${app.google_sheet}`);
        }
        
        if (templateError) {
          throw new Error(`Failed to fetch template: ${templateError.message}`)
        }

        // Create the base prompt using the template's user_prompt
        const basePrompt = templateData?.base_prompt || 'Create a web application based on the Google Sheet structure provided.'
        // Create a detailed metadata description for v0
        const fieldsMetadataJson = JSON.stringify(sheetData.columns_metadata, null, 2);
        
        // Create a complete prompt with the fields stored in the database
        // Start with the common parts of the prompt
        let promptBase = `${basePrompt}


        ACTIVE FIELDS (TO BE DISPLAYED IN THE UI):
${app.active_fields_text || ''}


        COMPLETE SHEET STRUCTURE (INCLUDING ALL FIELDS):

        This is the complete structure of the Google Sheet with all fields in their original order. For each field:

        - id: Unique identifier for the column

        - name: Column name as shown in the sheet

        - type: Data type (Text, Number, Date, etc.)

        - active: If true, this field should be used in the UI and API. If false, maintain the field in the sheet structure but don't display it.

        - options: For fields that have predefined options (like dropdowns)

        - description: Additional information about the field

        - originalIndex: The position of the column in the sheet (0-based)


        ${fieldsMetadataJson || ''}


        SHEET NAME: ${app.name || 'Sheet1'}`;
        
        // Add API instructions based on template requirements
        const apiAccess = templateData?.sheet_api_access || 'write_only';
        
        // Add write access instructions if needed
        if (apiAccess === 'write_only' || apiAccess === 'read_write') {
          promptBase += `


        SECURE FORM SUBMISSION API:

        To submit form data to the Google Sheet, use this secure endpoint:

        POST ${process.env.NEXT_PUBLIC_SITE_URL}/api/public/forms/${app.id}/${app.path_secret}/submit


        The path_secret will be automatically generated for your app. When this app is viewed by the public, the full URL including the secret path will be provided. Send form data as JSON in the request body, with field names matching the Google Sheet column names. Rate limits apply (100 submissions per hour per app).`;
        }
        
        // Add read access instructions if needed
        if (apiAccess === 'read_only' || apiAccess === 'read_write') {
          promptBase += `


        SECURE DATA RETRIEVAL API:

        To read data from the Google Sheet, use this secure endpoint:

        GET ${process.env.NEXT_PUBLIC_SITE_URL}/api/public/forms/${app.id}/${app.path_secret}/data


        This endpoint returns the sheet data with the following structure:
        
        {
          headers: string[],          // Array of column headers
          rows: Array<object>,        // Array of row objects with headers as keys
          totalRows: number,          // Total number of rows in sheet
          filteredRows?: number,     // Number of rows after filtering (if filtered)
          page: number,              // Current page number
          pageSize: number,          // Number of rows per page
          totalPages: number         // Total number of pages
        }
        
        Example: To sort data client-side, use: response.rows.sort((a, b) => {...})
        
        You can filter rows by adding query parameters that match column names, e.g. ?filter[name]=John&filter[status]=active
        
        Pagination is supported via ?page=2&pageSize=50 parameters (default page size is 50, max is 1000)
        
        Sorting is supported via ?sort=columnName:asc or ?sort=columnName:desc
        
        Rate limits apply (100 requests per hour per app).`;
        }
        
        // Add authentication instructions if required
        if (app.requires_authentication) {
          promptBase += `


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
        }
        
        // Add final instructions about column handling
        promptBase += `


        When interacting with the sheet, ensure all columns are maintained in their original order, even inactive ones (set inactive values to empty string or null when writing).`;
        
        // Get current user ID
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData.user?.id
        
        if (!userId) {
          throw new Error('User not authenticated')
        }
        
        // Call the generate API
        const generateResponse = await fetch('/api/v0/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: promptBase,
            name: app.name,
            userId: userId,
            templateId: app.template_id,
            appId: app.id  // Pass the existing app ID to update instead of creating a new record
          })
        })

        if (!generateResponse.ok) {
          const errorData = await generateResponse.json()
          throw new Error(errorData.error || 'Failed to generate app')
        }

        const generateData = await generateResponse.json()

        // Refetch app data to get updated record
        await refetchApp()
        return generateData
      } catch (error) {
        console.error('Generation API error:', error);
        // We don't set isGenerating=false here because it's handled in the onError callback
        throw error; // Re-throw to trigger onError
      }
    },
    // These callbacks are no longer needed since we're handling them in the useEffect
    // where we call the mutation - keeping for reference
    onError: (error: any) => {
      console.error('App generation error:', error);
      // Toast handling moved to the useEffect
      console.error("Error generating app:", error)
    }
  })

  // CRITICAL: This is the main effect that triggers app generation on first load
  // It runs once when the component mounts with app data
  useEffect(() => {
    // We need this check because the effect might run before app data is available
    if (!app) {
      console.log('🚫 App data not yet available, waiting...');
      return;
    }
    
    // Skip if we've already attempted generation or if we're already loading data
    if (hasAttemptedGeneration || isLoadingApp || generateAppMutation.isPending) {
      console.log('⏭️ Already attempted generation or operation in progress, skipping');
      return;
    }

    // Mark that we've attempted generation to prevent further attempts
    setHasAttemptedGeneration(true);
    
    // If we have an app without chat_id, generate it
    if (app.id && !app.chat_id) {
      
      // Set UI state
      setIsGenerating(true);
      
      // Show toast with unique ID so we can dismiss it later
      const toastId = toast.loading("Generating your app with V0...");
      
      // Call the mutation directly
      generateAppMutation.mutate(undefined, {
        onSuccess: (data) => {
          toast.dismiss(toastId);
          toast.success("App successfully generated!");
          
          // Force refetch to get the updated app with chat_id
          refetchApp().then(() => {
            // Once the app is refreshed, also fetch chat messages
            // Small timeout to ensure app data is updated first
            setTimeout(() => refetchChat(), 500);
          });
        },
        onError: (error) => {
          console.error('❌ Generation failed:', error);
          toast.dismiss(toastId);
          toast.error("Failed to generate app. Please try again.");
          setIsGenerating(false);
        }
      });
    } else {
      console.log('✅ App already has chat_id or not ready for generation');
    }
  }, [app?.id, app?.chat_id]); // Only depend on critical app properties
  
  // Fetch chat messages when we have a chat_id
  // When coming from the wizard flow with a freshly generated chat, this will run after generation
  // When coming to an existing app page, this will run on load
  const {
    data: chatData,
    isLoading: isLoadingChat,
    refetch: refetchChat,
  } = useQuery({
    queryKey: ["chat", app?.chat_id],
    queryFn: async () => {
      console.log('📬 Fetching chat messages for chat_id:', app?.chat_id);
      if (!app?.chat_id) {
        console.error('No chat_id available - this should not happen due to enabled property');
        return [];
      }

      // Use the getchat API route which uses v0.chats.getById
      const response = await fetch(`/api/v0/getchat?chatId=${app.chat_id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      })

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to fetch chat messages:", errorData);
        throw new Error(errorData.error || "Failed to fetch chat messages");
      }

      const data = await response.json();
      return data.messages || []
    },
    enabled: !!app?.chat_id, // Enabled whenever we have a chat_id
  })

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (newMessage: string) => {
      if (!app?.chat_id) return null

      const response = await fetch("/api/v0/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId: app.chat_id,
          message: newMessage,
          files: uploadedFiles,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to send message")
      }

      return await response.json()
    },
    onSuccess: (data) => {
      // Store the full chat data from the response
      if (data.fullChatData) {
        setFullChatData(data.fullChatData)
        
        // Update the React Query cache directly with the new data
        // This makes the data available throughout the component without refetching
        queryClient.setQueryData(["chat", app?.chat_id], data.fullChatData)
        
        // Update preview_url from demoUrl if it exists (either from root demo property or latestVersion.demoUrl)
        const demoUrl = data.fullChatData.demo || 
                     (data.fullChatData.latestVersion?.demoUrl) || 
                      null;
                      
        if (demoUrl && app) {
          // Update app data in the cache with the new preview_url
          const updatedApp = {
            ...app,
            preview_url: demoUrl
          };
          
          // Update the app data in the React Query cache
          queryClient.setQueryData(["app", name], updatedApp);
          
          console.log('Updated preview URL:', demoUrl);
        }
        
        console.log('Full chat data stored in cache:', data.fullChatData)
      }
      setTimeout(() => {
        // Refresh chat messages
        refetchChat().then(() => {
          console.log('✅ Chat messages refreshed after sending');
        }).catch(err => {
          console.error('❌ Failed to refresh messages:', err);
        });
        
        // Also invalidate and refetch versions to update the dropdown
        if (app?.id && app?.chat_id) {
          console.log('📁 Invalidating versions cache to get latest versions');
          queryClient.invalidateQueries({
            queryKey: ["app-versions", app.id, app.chat_id]
          }).then(() => {
            console.log('✅ Versions cache invalidated and refetched');
          }).catch(err => {
            console.error('❌ Failed to refresh versions:', err);
          });
        }
      }, 1000); // Small delay to ensure V0 has processed the response
      
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
      // Check if chatData has demoUrl and update preview_url if needed
      if (!Array.isArray(chatData)) {
        // Get demo URL from either the root demo property or from latestVersion.demoUrl
        const demoUrl = chatData.demo || 
                       (chatData.latestVersion?.demoUrl) || 
                        null;
                      
        if (demoUrl && app && app.preview_url !== demoUrl) {
          // Update app data in the cache with the new preview_url
          const updatedApp = {
            ...app,
            preview_url: demoUrl
          };
          
          // Update the app data in the React Query cache
          queryClient.setQueryData(["app", name], updatedApp);
        }
      }
      
      // Check if the chatData is the full response or just messages array
      const messageArray = Array.isArray(chatData) ? chatData : (chatData.messages || [])
      
      // Find the first user message index to replace
      const firstUserMessageIndex = messageArray.findIndex((msg: any) => msg.role === "user")
      
      const formattedMessages = messageArray.map((msg: any, index: number) => {
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
    <div className="h-[calc(100vh-56px)] flex flex-col bg-white dark:bg-slate-900 relative overflow-hidden">
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
          className={`border-r bg-white dark:bg-slate-900 relative ${isFullscreen ? 'hidden' : 'block'}`}
          style={{ width: isFullscreen ? '0' : '30%', height: '100%' }}
        >
          {/* Form Submission URL - only show when app is deployed */}
          {app?.status === "deployed" && app?.id && (
            <div className="px-4 pt-4">
              <FormSubmissionUrl appId={app.id} />
            </div>
          )}
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
          isGenerating={isGenerating || generateAppMutation.isPending}
          selectedVersion={selectedVersion}
          setSelectedVersion={setSelectedVersion}
        />
      </div>

      {/* Message input fixed to viewport with proper margins for footer and sidebar */}
      {!isFullscreen && (
        <div 
          className="fixed bg-white dark:bg-slate-900 shadow-sm z-30 rounded-lg border border-gray-100 dark:border-gray-800" 
          style={{ 
            bottom: '16px', /* Minimal space at bottom */
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
