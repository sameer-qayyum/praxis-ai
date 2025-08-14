import React, { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, 
} from "@/components/ui/select"
import { Eye, RefreshCw, History, Database } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { GoogleSheetPanel } from "./GoogleSheetPanel"

interface AppVersion {
  id: string
  app_id: string
  version_id: string
  version_demo_url: string
  version_number: number
  created_at: string
  created_by: string
}

interface AppData {
  id: string
  preview_url: string
  status?: string
  chat_id?: string
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
  isGenerating?: boolean
  selectedVersion?: string
  setSelectedVersion?: (version: string) => void
  handleRegenerateApp?: (saveFieldsPromise: Promise<void>) => void
  previewKey?: number // Key to force refresh when regeneration happens
}

export const PreviewPanel = ({
  app,
  activeTab,
  setActiveTab,
  isFullscreen,
  messages,
  isDeploying,
  handleDeploy,
  isGenerating = false,
  selectedVersion,
  setSelectedVersion,
  handleRegenerateApp,
  previewKey: externalPreviewKey,
}: PreviewPanelProps) => {
  // Use both local state for URL changes and external key for regeneration
  const [localPreviewKey, setLocalPreviewKey] = useState(Date.now());
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState(app?.preview_url || '');
  
  // Combine local preview key and external preview key to force refresh in both scenarios
  const combinedPreviewKey = externalPreviewKey ? `${localPreviewKey}-${externalPreviewKey}` : `${localPreviewKey}`;
  
  // Log app information for debugging
  useEffect(() => {
    console.log('[PreviewPanel] App data:', {
      id: app?.id,
      previewUrl: app?.preview_url,
      status: app?.status,
      fullAppObject: app
    });
    
    if (!app?.id) {
      console.warn('[PreviewPanel] No app ID available - this will prevent version fetching');
    }
  }, [app]);
  
  // Fetch versions for this app - only when app has a chat_id
  const { data: versionsData } = useQuery({
    queryKey: ["app-versions", app?.id, app?.chat_id],
    queryFn: async () => {
      if (!app?.id || !app?.chat_id) {
        console.log('[PreviewPanel] Missing app ID or chat_id, skipping versions fetch:', { appId: app?.id, chatId: app?.chat_id });
        return { versions: [] };
      }
      
      console.log('[PreviewPanel] Fetching versions for app ID:', app.id, 'with chat_id:', app.chat_id);
      const response = await fetch(`/api/v0/versions?appId=${app.id}`);
      
      if (!response.ok) {
        console.error('[PreviewPanel] Failed to fetch versions:', response.status, response.statusText);
        throw new Error("Failed to fetch app versions");
      }
      
      const data = await response.json();
      console.log('[PreviewPanel] Versions response:', data);
      return data;
    },
    enabled: !!app?.id && !!app?.chat_id, // Only enable when both app.id and app.chat_id exist
  });
  
  // Get the versions array from the response
  const versions = versionsData?.versions || [];
  useEffect(() => {
    console.log('[PreviewPanel] Versions available:', versions.length, 'Active tab:', activeTab);
    
    if (versions.length === 0) {
      console.log('[PreviewPanel] No versions found. Make sure app_versions table has records with this app_id');
    }
  }, [versions.length, activeTab]);
  
  // Refresh functionality is now handled directly inline where needed
  
  // Function to handle version selection
  const handleVersionChange = (versionId: string) => {
    if (setSelectedVersion) {
      setSelectedVersion(versionId);
      
      // Find the version and update the preview URL
      const selectedVersionData = versions.find((v: AppVersion) => v.version_id === versionId);
      if (selectedVersionData?.version_demo_url) {
        setCurrentPreviewUrl(selectedVersionData.version_demo_url);
        setLocalPreviewKey(Date.now()); // Force iframe refresh
      }
    }
  };

  // Force iframe refresh when preview_url changes
  useEffect(() => {
    if (app?.preview_url) {
      setLocalPreviewKey(Date.now());
      setCurrentPreviewUrl(app.preview_url);
      console.log('Preview URL changed, refreshing iframe:', app.preview_url);
    }
  }, [app?.preview_url, externalPreviewKey]);
  
  // Auto-select newest version when versions change
  useEffect(() => {
    console.log('[PreviewPanel] Versions changed, count:', versions.length);
    
    if (versions.length > 0 && setSelectedVersion) {
      // Get the newest version (first in the array since it's ordered by version_number DESC)
      const newestVersion = versions[0];
      console.log('[PreviewPanel] Auto-selecting newest version:', {
        versionId: newestVersion.version_id,
        versionNumber: newestVersion.version_number,
        demoUrl: newestVersion.version_demo_url
      });
      
      setSelectedVersion(newestVersion.version_id);
      setCurrentPreviewUrl(newestVersion.version_demo_url);
      setLocalPreviewKey(Date.now());
    }
  }, [versions, versions.length, setSelectedVersion]);
  return (
    <div className={`flex flex-col bg-gray-50 dark:bg-slate-900 h-full ${isFullscreen ? 'w-full' : 'flex-1'}`}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col overflow-hidden">
        <div className="border-b bg-white dark:bg-slate-800 px-4 py-2 flex justify-between items-center">
          <TabsList className="grid w-[200px] grid-cols-2">
            <TabsTrigger value="preview" className="text-xs">
              <Eye className="mr-1 h-3 w-3" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="code" className="text-xs">
              <Database className="mr-1 h-3 w-3" />
              Google Sheet
            </TabsTrigger>
          </TabsList>
          
          {/* Version selector dropdown */}
          {activeTab === 'preview' && versions.length > 0 ? (
            <div className="flex items-center space-x-2">
              <div className="text-xs text-gray-500 flex items-center">
                <History className="mr-1 h-3 w-3" />
               
              </div>
              <Select 
                value={selectedVersion} 
                onValueChange={handleVersionChange}
              >
                <SelectTrigger className="h-8 w-[120px]">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((version: AppVersion) => (
                    <SelectItem 
                      key={version.version_id} 
                      value={version.version_id}
                    >
                      {`Version ${version.version_number}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <TabsContent value="preview" className="flex-1 m-0 p-0 overflow-hidden h-full relative">
          {isGenerating || app.status === 'pending' ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 text-blue-500 dark:text-blue-300 animate-spin" />
                </div>
                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">Generating Your App</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                  We&apos;re creating your application based on the Google Sheet fields...
                </p>
              </div>
            </div>
          ) : app.preview_url ? (
            <div className="w-full h-full">
              {/* Refresh button in top-right corner */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="absolute top-2 right-2 z-10 bg-white/80 hover:bg-white" 
                onClick={() => setLocalPreviewKey(Date.now())}
                title="Refresh preview"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <iframe
                key={combinedPreviewKey} // Use dynamic key from state to force re-render
                src={`${currentPreviewUrl}?timestamp=${combinedPreviewKey}`} // Use same timestamp for consistency
                title="App Preview"
                className="w-full h-full border-0 bg-white"
                style={{ height: "100%", overflow: "hidden" }}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg mx-auto mb-2 flex items-center justify-center">
                  <Eye className="h-6 w-6 text-gray-400 dark:text-gray-300" />
                </div>
                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">No preview available</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Deploy your app to see a preview</p>
                <Button onClick={handleDeploy} disabled={isDeploying} size="sm">
                  <RefreshCw className={`mr-2 h-3 w-3 ${isDeploying ? "animate-spin" : ""}`} />
                  Deploy App
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="code" className="flex-1 m-0 p-0 overflow-hidden">
          <GoogleSheetPanel 
            app={app} 
            handleRegenerateApp={handleRegenerateApp} 
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
