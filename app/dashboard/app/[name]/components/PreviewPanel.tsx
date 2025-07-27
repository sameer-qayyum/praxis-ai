import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, Code2, RefreshCw } from "lucide-react"

interface AppData {
  preview_url: string
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

interface PreviewPanelProps {
  app: AppData
  activeTab: string
  setActiveTab: (value: string) => void
  isFullscreen: boolean
  messages: Message[]
  isDeploying: boolean
  handleDeploy: () => void
}

export const PreviewPanel = ({
  app,
  activeTab,
  setActiveTab,
  isFullscreen,
  messages,
  isDeploying,
  handleDeploy,
}: PreviewPanelProps) => {
  return (
    <div className="flex flex-col bg-gray-50 overflow-hidden" style={{ width: isFullscreen ? '100%' : '70%' }}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full overflow-hidden">
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

        <TabsContent value="preview" className="flex-1 m-0 p-0 overflow-hidden">
          {app.preview_url ? (
            <div className="w-full h-full">
              <iframe
                src={app.preview_url}
                title="App Preview"
                className="w-full h-full border-0 bg-white"
                style={{ height: "100%", overflow: "hidden" }}
              />
            </div>
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

        <TabsContent value="code" className="flex-1 m-0 p-0 overflow-hidden">
          <ScrollArea className="h-full w-full">
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
  )
}
