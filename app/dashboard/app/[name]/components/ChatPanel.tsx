import { useRef, FormEvent, useState, useEffect } from "react"
import { Sparkles, MessageCircle, BookOpen, Edit3, Save, X, Plus, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
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

interface AppGuideData {
  title: string
  description: string
  features: string[]
  sheetSetup: {
    title: string
    instructions: string[]
  }
  examples: {
    title: string
    items: string[]
  }
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
  app?: {
    id: string
    name: string
    template_id?: string
  }
  onTabChange?: (tab: 'chat' | 'guide') => void
  isGenerating?: boolean
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
  app,
  onTabChange,
  isGenerating,
}: ChatPanelProps) => {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [activeTab, setActiveTab] = useState<'chat' | 'guide'>('chat')
  const { toast } = useToast()

  // Notify parent when tab changes
  const handleTabChange = (tab: 'chat' | 'guide') => {
    setActiveTab(tab)
    onTabChange?.(tab)
  }
  const [appGuideData, setAppGuideData] = useState<AppGuideData | null>(null)
  const [isLoadingGuide, setIsLoadingGuide] = useState(false)
  const [isEditingGuide, setIsEditingGuide] = useState(false)
  const [isSavingGuide, setIsSavingGuide] = useState(false)
  
  // Form state for guide editing
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    features: [''],
    sheetSetupTitle: '',
    sheetSetupInstructions: [''],
    examplesTitle: '',
    examplesItems: ['']
  })

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

  // Fetch app guide data with priority: apps.guide -> templates.guide -> CTA
  const fetchAppGuideData = async () => {
    if (!app) return

    setIsLoadingGuide(true)
    try {
      // Step 1: Always check app-specific guide first
      const appGuideResponse = await fetch(`/api/apps/${app.id}/guide`)
      if (appGuideResponse.ok) {
        const appGuideData = await appGuideResponse.json()
        if (appGuideData && appGuideData.title) {
          setAppGuideData(appGuideData)
          return
        }
      }

      // Step 2: If no app guide, check template guide (only for template-based apps)
      if (app.template_id) {
        const templateResponse = await fetch(`/api/templates/${app.template_id}/guide`)
        if (templateResponse.ok) {
          const templateData = await templateResponse.json()
          if (templateData && templateData.title) {
            setAppGuideData(templateData)
            return
          }
        }
      }

      // Step 3: If both are empty, set to null to show CTA
      setAppGuideData(null)
    } catch (error) {
      console.error('Failed to fetch app guide:', error)
      setAppGuideData(null)
    } finally {
      setIsLoadingGuide(false)
    }
  }

  // Save guide data from form
  const saveGuideData = async () => {
    if (!app || !formData.title.trim()) return

    setIsSavingGuide(true)
    try {
      // Convert form data to guide structure
      const guideData = {
        title: formData.title,
        description: formData.description,
        features: formData.features.filter(f => f.trim()),
        sheetSetup: {
          title: formData.sheetSetupTitle || 'Google Sheet Setup',
          instructions: formData.sheetSetupInstructions.filter(i => i.trim())
        },
        examples: {
          title: formData.examplesTitle || 'Examples',
          items: formData.examplesItems.filter(i => i.trim())
        }
      }

      const response = await fetch(`/api/apps/${app.id}/guide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guide: JSON.stringify(guideData)
        })
      })

      if (response.ok) {
        const savedGuide = await response.json()
        setAppGuideData(savedGuide)
        setIsEditingGuide(false)
        resetFormData()
        toast.success('Guide saved successfully!')
      } else {
        throw new Error('Failed to save guide')
      }
    } catch (error) {
      console.error('Failed to save guide:', error)
      toast.error('Failed to save guide. Please try again.')
    } finally {
      setIsSavingGuide(false)
    }
  }

  // Reset form data
  const resetFormData = () => {
    setFormData({
      title: '',
      description: '',
      features: [''],
      sheetSetupTitle: '',
      sheetSetupInstructions: [''],
      examplesTitle: '',
      examplesItems: ['']
    })
  }

  // Start editing guide
  const startEditingGuide = () => {
    setIsEditingGuide(true)
    if (appGuideData) {
      // Populate form with existing data
      setFormData({
        title: appGuideData.title,
        description: appGuideData.description,
        features: appGuideData.features.length > 0 ? appGuideData.features : [''],
        sheetSetupTitle: appGuideData.sheetSetup.title,
        sheetSetupInstructions: appGuideData.sheetSetup.instructions.length > 0 ? appGuideData.sheetSetup.instructions : [''],
        examplesTitle: appGuideData.examples.title,
        examplesItems: appGuideData.examples.items.length > 0 ? appGuideData.examples.items : ['']
      })
    } else {
      // Provide template for new guide
      setFormData({
        title: `${app?.name} Guide`,
        description: "Add a description for your app here.",
        features: ["List key features of your app", "Add more features as needed"],
        sheetSetupTitle: "Google Sheet Setup",
        sheetSetupInstructions: [
          "Describe how to set up the Google Sheet",
          "Add specific column requirements",
          "Include data format guidelines"
        ],
        examplesTitle: "How to Use",
        examplesItems: [
          "Step-by-step usage instructions",
          "Common tasks and workflows",
          "Tips and best practices"
        ]
      })
    }
  }

  // Cancel editing
  const cancelEditingGuide = () => {
    setIsEditingGuide(false)
    resetFormData()
  }

  // Array field helpers
  const addArrayItem = (field: keyof typeof formData, value: string = '') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[]), value]
    }))
  }

  const removeArrayItem = (field: keyof typeof formData, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index)
    }))
  }

  const updateArrayItem = (field: keyof typeof formData, index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).map((item, i) => i === index ? value : item)
    }))
  }

  // Load guide data when tab is switched to guide
  useEffect(() => {
    if (activeTab === 'guide' && !appGuideData && app) {
      fetchAppGuideData()
    }
  }, [activeTab, app])

  // Default template guide data
  const getDefaultTemplateGuide = (appName: string): AppGuideData => ({
    title: `${appName} Guide`,
    description: "This app was created from a template. Here's how to use and manage it effectively.",
    features: [
      "View and manage data from your Google Sheet",
      "Add new entries through the app interface",
      "Edit existing entries with real-time updates",
      "Search and filter your data",
      "Responsive design for mobile and desktop"
    ],
    sheetSetup: {
      title: "Google Sheet Setup",
      instructions: [
        "Keep your sheet headers in the first row",
        "Don't delete or rename columns used by the app",
        "Add new data in subsequent rows",
        "Use consistent data formats (dates, numbers, etc.)",
        "Avoid empty rows between data entries"
      ]
    },
    examples: {
      title: "Common Tasks",
      items: [
        "To add a new entry: Use the 'Add New' button in the app",
        "To edit an entry: Click on any row to modify details",
        "To delete an entry: Use the delete option in the app interface",
        "To bulk import: Add data directly to your Google Sheet",
        "To backup data: Download your Google Sheet as Excel/CSV"
      ]
    }
  })

  // Custom app guide data
  const getCustomAppGuide = (appName: string): AppGuideData => ({
    title: `${appName} Guide`,
    description: "This is a custom app built specifically for your needs. Here's how to make the most of it.",
    features: [
      "Custom functionality tailored to your requirements",
      "Integration with your Google Sheet data",
      "Responsive and user-friendly interface",
      "Real-time data synchronization",
      "Customizable fields and layouts"
    ],
    sheetSetup: {
      title: "Google Sheet Management",
      instructions: [
        "Maintain the column structure as configured",
        "Add new data following the established format",
        "Keep required fields populated",
        "Use the app interface for best results",
        "Contact support for structural changes"
      ]
    },
    examples: {
      title: "Getting Started",
      items: [
        "Explore the app interface to understand available features",
        "Test adding and editing entries through the app",
        "Check how changes sync with your Google Sheet",
        "Use the chat feature to request modifications",
        "Share the app URL with team members as needed"
      ]
    }
  })

  if (isFullscreen) {
    return null
  }

  // App Guide Component
  const AppGuide = () => {
    if (isLoadingGuide) {
      return (
        <div className="p-4 space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      )
    }

    if (!appGuideData) {
      return (
        <div className="flex items-center justify-center h-full text-center py-12">
          <div>
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-sm mb-4">No guide available for this app</p>
            <Button
              onClick={startEditingGuide}
              className="flex items-center gap-2"
            >
              <Edit3 className="h-4 w-4" />
              Create Guide
            </Button>
            <p className="text-gray-400 text-xs mt-2">Add instructions and documentation for your app</p>
          </div>
        </div>
      )
    }

    if (isEditingGuide) {
      return (
        <div className="h-full flex flex-col p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Edit Guide</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={saveGuideData}
                disabled={isSavingGuide || !formData.title.trim()}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSavingGuide ? 'Saving...' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelEditingGuide}
                disabled={isSavingGuide}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col">
            <div className="space-y-4">
              {/* Title */}
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Guide title"
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of your app"
                  rows={3}
                />
              </div>

              {/* Features */}
              <div>
                <Label>Key Features</Label>
                <div className="space-y-2">
                  {formData.features.map((feature, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={feature}
                        onChange={(e) => updateArrayItem('features', index, e.target.value)}
                        placeholder="Feature description"
                      />
                      {formData.features.length > 1 && (
                        <Button
                          onClick={() => removeArrayItem('features', index)}
                          variant="outline"
                          size="sm"
                          className="px-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    onClick={() => addArrayItem('features')}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Feature
                  </Button>
                </div>
              </div>

              {/* Sheet Setup */}
              <div>
                <Label htmlFor="sheetSetupTitle">Sheet Setup Section Title</Label>
                <Input
                  id="sheetSetupTitle"
                  value={formData.sheetSetupTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, sheetSetupTitle: e.target.value }))}
                  placeholder="Google Sheet Setup"
                />
                <div className="mt-2">
                  <Label>Setup Instructions</Label>
                  <div className="space-y-2">
                    {formData.sheetSetupInstructions.map((instruction, index) => (
                      <div key={index} className="flex gap-2">
                        <Textarea
                          value={instruction}
                          onChange={(e) => updateArrayItem('sheetSetupInstructions', index, e.target.value)}
                          placeholder="Setup instruction"
                          rows={2}
                        />
                        {formData.sheetSetupInstructions.length > 1 && (
                          <Button
                            onClick={() => removeArrayItem('sheetSetupInstructions', index)}
                            variant="outline"
                            size="sm"
                            className="px-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      onClick={() => addArrayItem('sheetSetupInstructions')}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Instruction
                    </Button>
                  </div>
                </div>
              </div>

              {/* Examples */}
              <div>
                <Label htmlFor="examplesTitle">Examples Section Title</Label>
                <Input
                  id="examplesTitle"
                  value={formData.examplesTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, examplesTitle: e.target.value }))}
                  placeholder="How to Use"
                />
                <div className="mt-2">
                  <Label>Example Items</Label>
                  <div className="space-y-2">
                    {formData.examplesItems.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <Textarea
                          value={item}
                          onChange={(e) => updateArrayItem('examplesItems', index, e.target.value)}
                          placeholder="Example or usage tip"
                          rows={2}
                        />
                        {formData.examplesItems.length > 1 && (
                          <Button
                            onClick={() => removeArrayItem('examplesItems', index)}
                            variant="outline"
                            size="sm"
                            className="px-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      onClick={() => addArrayItem('examplesItems')}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Example
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Fill out the form fields to create comprehensive documentation for your app.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="h-full overflow-auto p-4">
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">{appGuideData.title}</h3>
              <p className="text-sm text-gray-600">{appGuideData.description}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={startEditingGuide}
              className="flex items-center gap-2 ml-4"
            >
              <Edit3 className="h-4 w-4" />
              Edit
            </Button>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-3">Features</h4>
            <ul className="space-y-2">
              {appGuideData.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-3">{appGuideData.sheetSetup.title}</h4>
            <ul className="space-y-2">
              {appGuideData.sheetSetup.instructions.map((instruction, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0" />
                  {instruction}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-3">{appGuideData.examples.title}</h4>
            <ul className="space-y-2">
              {appGuideData.examples.items.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full grid grid-rows-[auto_1fr_auto]">
      {/* Header with tabs */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h2 className="font-medium text-gray-900">Chat with Praxis</h2>
          </div>
          
          {/* Tab buttons */}
          <div className="flex gap-1">
            <Button
              variant={activeTab === 'chat' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleTabChange('chat')}
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Chat
            </Button>
            <Button
              variant={activeTab === 'guide' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleTabChange('guide')}
              className="flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4" />
              Guide
            </Button>
          </div>
        </div>
      </div>

      {/* Content area - shows either chat or guide based on active tab */}
      <div className="overflow-auto">
        {activeTab === 'chat' ? (
          <div className="px-4">
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
                isGenerating ? (
                  <div className="flex items-center justify-center h-full text-center py-12">
                    <div className="px-2 py-3 text-blue-600">
                      <TypewriterEffect 
                        text="Generating your app..." 
                        speed={150}
                        className="text-sm font-medium"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-center py-12">
                    <div>
                      <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 text-sm">Start a conversation with Praxis</p>
                      <p className="text-gray-400 text-xs mt-1">Ask questions or request changes to your app</p>
                    </div>
                  </div>
                )
              )}

              {/* Show generating indicator even when there are prior messages and a generation is in progress */}
              {messages.length > 0 && isGenerating && (
                <div className="px-2 py-3 text-blue-600">
                  <TypewriterEffect 
                    text="Generating your app..." 
                    speed={150}
                    className="text-sm font-medium"
                  />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        ) : (
          <AppGuide />
        )}
      </div>

      {/* Message input moved to page level for better viewport attachment */}
    </div>
  )
}
