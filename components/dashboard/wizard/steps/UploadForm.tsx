"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Search, Upload, Plus, FileSpreadsheet, UploadCloud, Table, X, 
  Loader2, ArrowDownAZ, Clock, SortAsc, SortDesc 
} from "lucide-react"
import { useGoogleSheets } from "@/context/GoogleSheetsContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// import { useToast } from "@/components/ui/use-toast" - We'll add proper toast notifications in a future update

// Import the GoogleSheet type directly from the context
interface SheetSortOption {
  label: string;
  value: 'name' | 'lastModified';
  icon: React.ReactNode;
}

interface SheetOrderOption {
  label: string;
  value: 'asc' | 'desc';
  icon: React.ReactNode;
}

export function UploadForm() {
  const [activeTab, setActiveTab] = useState<string>("existing-sheet")
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [newSheetName, setNewSheetName] = useState<string>("") 

  const { 
    isConnected, 
    sheets, 
    loadingSheets, 
    selectedSheet,
    setSelectedSheet,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    pagination,
    listSheets,
    loadMoreSheets,
    refreshSheets,
    createSheet
  } = useGoogleSheets()
  
  const sortOptions: SheetSortOption[] = [
    { label: "Name", value: "name", icon: <ArrowDownAZ size={16} /> },
    { label: "Last Modified", value: "lastModified", icon: <Clock size={16} /> }
  ];

  const orderOptions: SheetOrderOption[] = [
    { label: "Ascending", value: "asc", icon: <SortAsc size={16} /> },
    { label: "Descending", value: "desc", icon: <SortDesc size={16} /> }
  ];
  
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, [setSearchQuery]);
  
  const handleSortByChange = useCallback((value: string) => {
    setSortBy(value as 'name' | 'lastModified');
  }, [setSortBy]);
  
  const handleSortOrderChange = useCallback((value: string) => {
    setSortOrder(value as 'asc' | 'desc');
  }, [setSortOrder]);
  
  const handleLoadMore = useCallback(async () => {
    if (pagination?.hasMore && !loadingSheets) {
      await loadMoreSheets();
    }
  }, [pagination?.hasMore, loadingSheets, loadMoreSheets]);
  
  const createNewSheet = async () => {
    if (!newSheetName.trim()) return;
    
    try {
      const newSheet = await createSheet(newSheetName);
      if (newSheet) {
        setSelectedSheet(newSheet);
        setIsDialogOpen(false);
      }
    } catch (error) {
      console.error("Error creating sheet:", error);
    }
  };
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setSelectedFile(file)
    
    if (file) {
      setIsDialogOpen(true)
    }
  }
  
  return (
    <div className="w-full max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Choose Data Source</h2>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="existing-sheet" className="flex items-center gap-2">
            <Table className="h-4 w-4" />
            <span>Use Google Sheet</span>
          </TabsTrigger>
          <TabsTrigger value="upload-csv" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <span>Upload CSV</span>
          </TabsTrigger>
          <TabsTrigger value="paste-data" className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4" />
            <span>Paste Data</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="existing-sheet" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search your Google Sheets..."
                className="pl-10"
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>New Sheet</span>
                </Button>
              </DialogTrigger>
              
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Google Sheet</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <Input
                    placeholder="Enter sheet name..."
                    value={newSheetName}
                    onChange={(e) => setNewSheetName(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="mr-2"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default" 
                    disabled={loadingSheets || !newSheetName.trim()}
                    onClick={createNewSheet}
                  >
                    {loadingSheets ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Sheet"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="flex space-x-4">
            <div className="flex-1">
              <Select value={sortBy} onValueChange={handleSortByChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center">
                        {option.icon}
                        <span className="ml-2">{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1">
              <Select value={sortOrder} onValueChange={handleSortOrderChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sort order" />
                </SelectTrigger>
                <SelectContent>
                  {orderOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center">
                        {option.icon}
                        <span className="ml-2">{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {loadingSheets && sheets.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center">
              <Loader2 className="h-10 w-10 text-primary animate-spin mb-2" />
              <p className="text-gray-500">Loading your Google Sheets...</p>
            </div>
          ) : sheets.length > 0 ? (
            <ScrollArea className="h-[400px] border rounded-md">
              <div className="p-4 space-y-3">
                <div className="text-sm text-gray-500 pb-2 border-b mb-2">
                  <p>
                    Showing {sheets.length} sheets{pagination?.hasMore ? " (newest first)" : ""}
                    {searchQuery && " matching '" + searchQuery + "'"}
                  </p>
                </div>
                {sheets.map((sheet) => (
                  <div
                    key={sheet.id}
                    className={`flex items-center p-3 rounded-lg cursor-pointer border transition-colors ${selectedSheet?.id === sheet.id ? 'bg-primary/10 border-primary/30' : 'hover:bg-gray-100 border-transparent'}`}
                    onClick={() => {
                      setSelectedSheet(sheet);
                    }}
                  >
                    <div className="flex-shrink-0 mr-3">
                      <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{sheet.name}</h3>
                      <p className="text-sm text-gray-500">Last modified: {new Date(sheet.lastModified).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
                
                {pagination?.hasMore && (
                  <div className="pt-2 pb-2 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadMore}
                      disabled={loadingSheets}
                    >
                      {loadingSheets ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>Load More ({pagination.totalFound - sheets.length} remaining)</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : isConnected ? (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-200 rounded-md">
              <Table className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-center text-gray-600 mb-2">No Google Sheets found</p>
              <p className="text-center text-sm text-gray-500 mb-4">Create a new sheet to get started</p>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-600 mb-4">Please connect your Google account to access your sheets.</p>
            </div>
          )}
          
          {selectedSheet && (
            <div className="p-4 border border-blue-100 bg-blue-50 rounded-md flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-blue-500" />
                <span>Selected: <strong>{selectedSheet.name}</strong></span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedSheet(null)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="upload-csv">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".csv"
              onChange={handleFileUpload}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center justify-center"
            >
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <Upload className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Upload CSV File</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-4">
                Drag and drop your CSV file here, or click to browse files
              </p>
              <Button variant="outline" className="mb-4">Select File</Button>
              <p className="text-xs text-gray-400">
                Maximum file size: 10MB
              </p>
            </label>
            
            {selectedFile && (
              <div className="mt-6 bg-gray-50 p-4 rounded flex items-center justify-between">
                <div className="flex items-center">
                  <FileSpreadsheet className="h-6 w-6 text-green-600 mr-3" />
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{Math.round(selectedFile.size / 1024)} KB</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="paste-data">
          <div className="space-y-4">
            <p className="text-gray-600">
              Paste your tabular data below. Data should be tab-separated or have consistent delimiters.
            </p>
            <textarea
              className="w-full min-h-[300px] p-4 border rounded-md font-mono text-sm focus:ring-2 focus:ring-primary"
              placeholder="Paste your data here..."
            ></textarea>
          </div>
        </TabsContent>
      </Tabs>
      
      <Dialog open={isDialogOpen && selectedFile !== null && !selectedSheet} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Data Storage</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-600">
              Choose where to store data collected from your form:
            </p>
            
            <div className="space-y-2">
              <h4 className="font-medium">Create a new sheet</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter sheet name..."
                  value={newSheetName}
                  onChange={(e) => setNewSheetName(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={createNewSheet}
                  disabled={!newSheetName.trim()}
                >
                  Create
                </Button>
              </div>
            </div>
            
            {sheets.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Or select an existing sheet</h4>
                <ScrollArea className="h-[200px] rounded-md border">
                  <div className="p-1">
                    {sheets.map((sheet) => (
                      <div 
                        key={sheet.id}
                        onClick={() => {
                          setSelectedSheet(sheet)
                          setIsDialogOpen(false)
                        }}
                        className="flex items-center p-3 rounded-md cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <FileSpreadsheet className="h-5 w-5 text-gray-400 mr-2" />
                        <span>{sheet.name}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
