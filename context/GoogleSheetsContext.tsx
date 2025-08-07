"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

interface GoogleSheet {
  id: string
  name: string
  lastModified: string
  url: string
  activeSheetName?: string // The name of the active sheet/tab
}

interface SheetPagination {
  hasMore: boolean
  nextPageToken: string | null
  totalFound: number
  pageSize: number
}

interface SheetsListResponse {
  success: boolean
  sheets: GoogleSheet[]
  pagination: SheetPagination
}

interface SheetsListParams {
  pageSize?: number
  pageToken?: string
  sortBy?: 'name' | 'lastModified'
  sortOrder?: 'asc' | 'desc'
  query?: string
}

// Type for column information
interface SheetColumn {
  name: string;
  type: string;
  description: string;
  sampleData: string[];
}

interface SheetColumnsResponse {
  columns: SheetColumn[];
  isEmpty: boolean;
}

// Define interfaces for column change detection
export interface ColumnChange {
  type: 'added' | 'removed' | 'reordered' | 'unchanged';
  name: string;
  index?: number;
  newIndex?: number;
}

export interface ColumnSyncResult {
  hasChanges: boolean;
  changes: ColumnChange[];
  mergedColumns: any[];
  savedColumns: any[];
  currentColumns: SheetColumn[];
}

interface GoogleSheetsContextType {
  isConnected: boolean;
  isLoading: boolean;
  sheets: GoogleSheet[];
  loadingSheets: boolean;
  selectedSheet: GoogleSheet | null;
  pagination: SheetPagination | null;
  searchQuery: string;
  sortBy: 'name' | 'lastModified';
  sortOrder: 'asc' | 'desc';
  setSearchQuery: (query: string) => void;
  setSortBy: (field: 'name' | 'lastModified') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  setSelectedSheet: (sheet: GoogleSheet | null) => void;
  checkConnectionStatus: () => Promise<boolean>;
  refreshConnectionStatus: () => Promise<boolean>;
  listSheets: (params?: SheetsListParams) => Promise<GoogleSheet[]>;
  loadMoreSheets: () => Promise<GoogleSheet[]>;
  refreshSheets: () => Promise<GoogleSheet[]>;
  createSheet: (name: string) => Promise<GoogleSheet | null>;
  getSheetColumns: (sheetId: string) => Promise<SheetColumnsResponse>;
  saveSheetConnection: (connectionName: string, description: string, columnsMetadata: any[], sheetTabName?: string, forceGlobalUpdate?: boolean) => Promise<boolean>;
  writeSheetColumns: (sheetId: string, columns: any[]) => Promise<boolean>;
  getSheetConnection: (sheetId: string) => Promise<any | null>;
  checkSheetColumnChanges: (sheetId: string) => Promise<ColumnSyncResult | null>;
  lastRefreshAttempt?: Date;
}

const GoogleSheetsContext = createContext<GoogleSheetsContextType | undefined>(undefined)

export const useGoogleSheets = () => {
  const context = useContext(GoogleSheetsContext)
  if (context === undefined) {
    throw new Error("useGoogleSheets must be used within a GoogleSheetsProvider")
  }
  return context
}

interface GoogleSheetsProviderProps {
  children: ReactNode
}

export const GoogleSheetsProvider = ({ children }: GoogleSheetsProviderProps) => {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefreshAttempt, setLastRefreshAttempt] = useState<Date | undefined>()
  const [sheets, setSheets] = useState<GoogleSheet[]>([])
  const [loadingSheets, setLoadingSheets] = useState(false)
  const [selectedSheet, setSelectedSheet] = useState<GoogleSheet | null>(null)
  const [pagination, setPagination] = useState<SheetPagination | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<'name' | 'lastModified'>('lastModified')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const supabase = createClient()

  const getSheetConnection = async function getSheetConnection(sheetId: string) {
    try {
      const { data, error } = await supabase
        .from('google_sheets_connections')
        .select('*')
        .eq('sheet_id', sheetId)
        .single();
        
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error fetching sheet connection:", err);
      return null;
    }
  }

  const checkConnectionStatus = async (): Promise<boolean> => {
    try {
      // First check if token is valid
      let { data: isValid, error } = await supabase.rpc("has_valid_google_token")
      
      // If token is invalid but we have no error, try to refresh it
      if (!isValid && !error) {
        setLastRefreshAttempt(new Date())
        
        // Get the current user's ID and refresh token
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.user?.id) {
          console.error("Cannot refresh token: No authenticated user")
          setIsConnected(false)
          return false
        }
        
        // Get the refresh token from storage
        const { data: credentials } = await supabase
          .from("oauth_credentials")
          .select("refresh_token")
          .eq("user_id", session.user.id)
          .eq("provider", "google_sheets")
          .single()
        
        if (!credentials?.refresh_token) {
          // Use console.debug instead of console.error to make it less intrusive
          console.debug("No refresh token found - user needs to reconnect Google Sheets")
          setIsConnected(false)
          return false
        }
        
        try {
          // Call our Edge Function to refresh the token
          
          const response = await fetch("https://yhfvwlptgkczsvemjlqr.supabase.co/functions/v1/refresh-google-token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              refreshToken: credentials.refresh_token,
              userId: session.user.id
            })
          })
          
          // Safely parse the response and handle potential JSON parsing errors
          let result;
          try {
            const text = await response.text();
           
            
            try {
              result = JSON.parse(text);
            } catch (parseError) {
              console.error("Failed to parse response as JSON:", parseError);
              console.error("Raw response was:", text);
              throw new Error("Invalid response format from token refresh service");
            }
            
            if (response.ok && result?.success) {
              isValid = true;
            } else {
              console.error("Failed to refresh Google token:", 
                result?.error || response.statusText || "Unknown error");
            }
          } catch (responseError) {
            console.error("Error processing refresh response:", responseError);
          }
        } catch (refreshError) {
          console.error("Error refreshing Google token:", refreshError)
        }
      }
      
      if (error) {
        console.error("Error checking Google Sheets connection:", error)
        setIsConnected(false)
        return false
      }
      
      setIsConnected(!!isValid)
      return !!isValid
    } catch (error) {
      console.error("Failed to check Google Sheets connection status:", error)
      setIsConnected(false)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const refreshConnectionStatus = async (): Promise<boolean> => {
    setIsLoading(true)
    setLastRefreshAttempt(new Date())
    return await checkConnectionStatus()
  }
  
  const listSheets = async (params?: SheetsListParams): Promise<GoogleSheet[]> => {
    try {
      setLoadingSheets(true)
      
      // Ensure we have a valid connection before proceeding
      const isValid = await checkConnectionStatus()
      if (!isValid) {
        console.warn("No valid Google connection - attempting to reconnect")
        // Try a final token refresh before failing
        await refreshConnectionStatus()
        if (!isConnected) {
          // Return empty sheets instead of throwing error
          console.debug("Google Sheets integration not connected - returning empty list")
          return []
        }
      }
      
      // Get the current user's ID
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user?.id) {
        throw new Error("No authenticated user")
      }
      
      // Use provided params or fallback to state values
      const requestParams = {
        userId: session.user.id,
        pageSize: params?.pageSize || 20,
        pageToken: params?.pageToken || undefined,
        sortBy: params?.sortBy || sortBy,
        sortOrder: params?.sortOrder || sortOrder,
        query: params?.query !== undefined ? params.query : searchQuery
      }
      
      console.log("Calling list-google-sheets with params:", { 
        ...requestParams,
        userId: "[REDACTED]" // Don't log the actual user ID
      });
      
      // Call our Edge Function to list sheets with the parameters
      const response = await fetch("https://yhfvwlptgkczsvemjlqr.supabase.co/functions/v1/list-google-sheets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify(requestParams)
      })
      
      
      // Handle the response
      if (!response.ok) {
        // Check if token is expired (this is a backup check)
        if (response.status === 401) {
          try {
            const errorData = await response.json()
            if (errorData?.expired) {
              // Token expired - try refreshing and calling again
              const refreshed = await refreshConnectionStatus()
              if (refreshed) {
                return await listSheets(params) // Retry after refresh
              }
            }
          } catch (parseError) {
            console.error("Error parsing authentication error:", parseError);
          }
        }
        
        // Try to get more detailed error message from response
        try {
          const errorBody = await response.text();
          throw new Error(`Failed to list sheets (${response.status}): ${response.statusText || errorBody || 'Unknown error'}`)
        } catch (textError) {
          throw new Error(`Failed to list sheets (${response.status}): ${response.statusText || 'Unknown error'}`)
        }
      }
      
      const result = await response.json() as SheetsListResponse
      const fetchedSheets = result.sheets || []
      
      // If this is a fresh load (no pageToken), replace the sheets
      // Otherwise for pagination, append to existing sheets
      if (!params?.pageToken) {
        setSheets(fetchedSheets)
      } else {
        setSheets(prevSheets => [...prevSheets, ...fetchedSheets])
      }
      
      // Update pagination state
      setPagination(result.pagination || null)
      
      return fetchedSheets
    } catch (error) {
      console.error("Error listing Google Sheets:", error)
      return []
    } finally {
      setLoadingSheets(false)
    }
  }
  
  const loadMoreSheets = async (): Promise<GoogleSheet[]> => {
    // Only proceed if we have pagination info and there are more sheets to load
    if (!pagination?.hasMore || !pagination.nextPageToken) {
      return []
    }
    
    return await listSheets({
      pageToken: pagination.nextPageToken,
      pageSize: pagination.pageSize,
      sortBy,
      sortOrder,
      query: searchQuery
    })
  }
  
  const refreshSheets = async (): Promise<GoogleSheet[]> => {
    // Clear existing sheets and reload from beginning
    setSheets([])
    setPagination(null)
    return await listSheets({
      pageSize: 20, // Default page size
      sortBy,
      sortOrder,
      query: searchQuery
    })
  }
  
  const createSheet = async (name: string): Promise<GoogleSheet | null> => {
    if (!name.trim()) return null
    
    try {
      setLoadingSheets(true)
      
      // Ensure we have a valid connection before proceeding
      const isValid = await checkConnectionStatus()
      if (!isValid) {
        throw new Error("No valid Google connection")
      }
      
      // Get the current user's ID
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user?.id) {
        throw new Error("No authenticated user")
      }
      
      // Call our Edge Function to create a new sheet
      const response = await fetch("https://yhfvwlptgkczsvemjlqr.supabase.co/functions/v1/create-google-sheet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: session.user.id,
          sheetName: name
        })
      })
      
      // Handle the response
      if (!response.ok) {
        // Check if token is expired (this is a backup check)
        if (response.status === 401) {
          const errorData = await response.json()
          if (errorData?.expired) {
            // Token expired - try refreshing and calling again
            const refreshed = await refreshConnectionStatus()
            if (refreshed) {
              return await createSheet(name) // Retry after refresh
            }
          }
        }
        
        throw new Error(`Failed to create sheet: ${response.statusText}`)
      }
      
      const result = await response.json()
      const newSheet = result.sheet
      
      if (!newSheet) {
        throw new Error("No sheet data returned from API")
      }
      
      // Update state and return
      setSheets(prevSheets => [newSheet, ...prevSheets])
      return newSheet
    } catch (error) {
      console.error("Error creating Google Sheet:", error)
      return null
    } finally {
      setLoadingSheets(false)
    }
  }

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus()
  }, [])

  // Set up initial sheets loading when connection is established
  useEffect(() => {
    if (isConnected && !isLoading) {
      listSheets()
    }
  }, [isConnected, isLoading])
  
  // Refresh sheets list when search query, sort options change
  useEffect(() => {
    if (isConnected && !isLoading) {
      // Only trigger if we've already loaded sheets once
      if (sheets.length > 0 || pagination !== null) {
        listSheets({
          query: searchQuery,
          sortBy: sortBy,
          sortOrder: sortOrder
        })
      }
    }
  }, [searchQuery, sortBy, sortOrder])
  
  // Effect for refreshing sheets when search or sort options change
  useEffect(() => {
    // Skip on initial render
    if (isConnected && !isLoading) {
      refreshSheets()
    }
  }, [searchQuery, sortBy, sortOrder])
  
  // Get columns and data from a sheet
  const getSheetColumns = async (sheetId: string): Promise<SheetColumnsResponse> => {
    try {
      const session = await supabase.auth.getSession()
      if (!session?.data?.session) {
        throw new Error("User is not authenticated")
      }
      
      const response = await fetch(`/api/sheets/${sheetId}/columns`)
      
      if (!response.ok) {
        // Check if token is expired
        if (response.status === 401) {
          const errorData = await response.json()
          if (errorData?.expired) {
            // Token expired - try refreshing and calling again
            const refreshed = await refreshConnectionStatus()
            if (refreshed) {
              return await getSheetColumns(sheetId) // Retry after refresh
            }
          }
        }
        
        throw new Error(`Failed to fetch columns: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error("Error fetching sheet columns:", error)
      throw error
    }
  }

  // Save sheet connection to google_sheets_connections table
  const saveSheetConnection = async (
    connectionName: string,
    description: string,
    columnsMetadata: any[],
    sheetTabName?: string, // Added parameter for the specific sheet tab name
    forceGlobalUpdate?: boolean // Flag to update global metadata even for existing connections
  ): Promise<boolean> => {
    
    if (!selectedSheet?.id) {
      console.error("❌ No sheet selected")
      return false
    }
    
    // If no specific sheet tab name provided, try to get it from the selectedSheet
    // or default to 'Sheet1' which is the default name in Google Sheets
    const actualSheetTabName = sheetTabName || selectedSheet.activeSheetName || 'Sheet1'

    try {
      // Get current user
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        console.error("❌ No authenticated user");
        throw new Error("No authenticated user")
      }
      

      // Check if connection already exists for this sheet and user
      
      const { data: existingConnection, error: checkError } = await supabase
        .from('google_sheets_connections')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('sheet_id', selectedSheet.id)
        .maybeSingle()

      if (checkError) {
        console.error("❌ Error checking existing connection:", checkError)
        throw checkError
      }
      
      

      let result

      if (existingConnection) {
        // Update existing connection
        // Only update columns_metadata if forceGlobalUpdate is true
        const updateData: any = {
          name: connectionName, // Connection name provided by user
          sheet_name: actualSheetTabName, // Name of the specific sheet/tab
          description,
          updated_at: new Date().toISOString(),
        };
        
        // Only update columns_metadata if explicitly requested
        if (forceGlobalUpdate === true) {
          updateData.columns_metadata = columnsMetadata;
          console.log('📝 Updating global sheet metadata as requested');
        }
        
        const { data, error } = await supabase
          .from('google_sheets_connections')
          .update(updateData)
          .eq('id', existingConnection.id)
          .select()

        if (error) {
          console.error('❌ Update error:', error);
          throw error;
        }
        result = data;
      } else {
        // Insert new connection
        
        const { data, error } = await supabase
          .from('google_sheets_connections')
          .insert({
            user_id: session.user.id,
            name: connectionName, // Connection name provided by user
            sheet_id: selectedSheet.id,
            sheet_name: actualSheetTabName, // Name of the specific sheet/tab
            description,
            columns_metadata: columnsMetadata
          })
          .select()

        if (error) {
          console.error('❌ Insert error:', error);
          throw error;
        }
        result = data;
      }
      return true
    } catch (error) {
      console.error("❌ Error saving sheet connection:", error)
      return false
    }
  }

  // Write columns to a Google Sheet via Edge Function
  const writeSheetColumns = async (
    sheetId: string, 
    columns: any[]
  ): Promise<boolean> => {
    console.log('🔍 writeSheetColumns called with:', { 
      sheetId, 
      columnsCount: columns.length,
      firstColumnName: columns[0]?.name || 'No columns'
    });
    
    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user?.id) {
        throw new Error("No authenticated user")
      }

      // Call the Edge Function to write columns to sheet
      
      const requestBody = {
        userId: session.user.id,
        sheetId,
        columns
      };
      
     
      
      const response = await fetch("https://yhfvwlptgkczsvemjlqr.supabase.co/functions/v1/write-sheet-columns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify(requestBody)
      })

      try {
        const result = await response.json()
        
        if (!response.ok || result.error) {
          console.error("❌ Error writing columns to sheet:", result.error || response.statusText);
          console.error("❌ Full error response:", result);
          return false
        }

        return true
      } catch (parseError) {
        console.error("❌ Error parsing response JSON:", parseError);
        return false
      }
    } catch (error) {
      console.error("❌ Error writing columns to sheet:", error);
      return false
    }
  };

  // Check for changes between saved columns metadata and actual Google Sheet columns
  const checkSheetColumnChanges = async (sheetId: string): Promise<ColumnSyncResult | null> => {
    try {
      console.log(`🔍 Starting column sync check for sheet: ${sheetId}`);
      
      // Get saved connection data if it exists
      const savedConnection = await getSheetConnection(sheetId);
      
      // Get current columns from Google Sheet
      const sheetData = await getSheetColumns(sheetId);
      
      // If sheet is empty, return null
      if (sheetData.isEmpty) {
        console.log('❌ Sheet is empty, no columns to check');
        return null;
      }
      
      // If we don't have saved metadata, all columns are "new"
      if (!savedConnection || !savedConnection.columns_metadata || !Array.isArray(savedConnection.columns_metadata)) {
        console.log('❌ No saved connection or columns metadata found for this sheet');
        return {
          hasChanges: false, // No real changes since we're starting fresh
          changes: [],
          mergedColumns: sheetData.columns.map((col: SheetColumn) => ({
            id: `col-${Math.random().toString(36).substring(2, 11)}`,
            name: col.name,
            type: col.type,
            description: '',
            options: []
          })),
          savedColumns: [],
          currentColumns: sheetData.columns
        };
      }
      
      const savedColumns = savedConnection.columns_metadata;
      const currentColumns = sheetData.columns;
      
      console.log('📋 SAVED COLUMNS:', JSON.stringify(savedColumns, null, 2));
      console.log('📋 CURRENT COLUMNS:', JSON.stringify(currentColumns, null, 2));
      console.log(`📊 Comparing ${savedColumns.length} saved columns with ${currentColumns.length} current columns`);
      
      // Track all changes
      const changes: ColumnChange[] = [];
      
      // Create maps for faster lookups with proper typing
      type ColumnWithIndex = { name: string; index: number; id?: string; type?: string; description?: string; options?: any[]; [key: string]: any };
      
      const savedColumnMap = new Map<string, ColumnWithIndex>(
        savedColumns.map((col: any, index: number) => [
          col.name, 
          { ...col, index }
        ])
      );
      
      const currentColumnMap = new Map<string, ColumnWithIndex>(
        currentColumns.map((col: any, index: number) => [
          col.name, 
          { ...col, index }
        ])
      );
      
      console.log('🗺️ Saved column names:', [...savedColumnMap.keys()]);
      console.log('🗺️ Current column names:', [...currentColumnMap.keys()]);
      
      // Check for removed columns (in saved but not in current)
      savedColumns.forEach((col: any, index: number) => {
        const exists = currentColumnMap.has(col.name);
        console.log(`❓ Checking if column '${col.name}' exists in current sheet: ${exists ? '✅ Exists' : '❌ Removed'}`);
        
        if (!exists) {
          console.log(`🛈 FOUND REMOVED COLUMN: '${col.name}' at index ${index}`);
          changes.push({
            type: 'removed',
            name: col.name,
            index: index
          });
        }
      });
      
      // Check for added or reordered columns
      currentColumns.forEach((col: any, currentIndex: number) => {
        const savedColumn = savedColumnMap.get(col.name);
        
        if (!savedColumn) {
          // This is a new column
          console.log(`➕ FOUND NEW COLUMN: '${col.name}' at index ${currentIndex}`);
          changes.push({
            type: 'added',
            name: col.name,
            index: currentIndex
          });
        } else if (savedColumn.index !== currentIndex) {
          // Column exists but position changed
          console.log(`🔄 FOUND REORDERED COLUMN: '${col.name}' moved from index ${savedColumn.index} to ${currentIndex}`);
          changes.push({
            type: 'reordered',
            name: col.name,
            index: savedColumn.index,
            newIndex: currentIndex
          });
        } else {
          // Column is unchanged
          console.log(`✔️ UNCHANGED COLUMN: '${col.name}' at index ${currentIndex}`);
          changes.push({
            type: 'unchanged',
            name: col.name,
            index: currentIndex
          });
        }
      });
      
      // Create merged columns that preserves custom settings from saved columns
      // but updates with the current column order and includes new columns
      const mergedColumns = currentColumns.map((col: any, index: number) => {
        const savedColumn = savedColumnMap.get(col.name);
        
        if (savedColumn) {
          // Preserve id, type, description, and options from saved column
          console.log(`🧲 Merging column '${col.name}' with saved settings:`, {
            savedId: savedColumn.id,
            savedType: savedColumn.type,
            newType: col.type
          });
          return {
            id: savedColumn.id || `col-${Math.random().toString(36).substring(2, 11)}`,
            name: col.name,
            type: savedColumn.type,
            description: savedColumn.description || '',
            options: savedColumn.options || []
          };
        } else {
          // New column, generate new ID and use inferred type from API
          console.log(`🆕 Creating new column object for '${col.name}' with type: ${col.type}`);
          return {
            id: `col-${Math.random().toString(36).substring(2, 11)}`,
            name: col.name,
            type: col.type,
            description: '',
            options: []
          };
        }
      });
      
      // What about removed columns? We need to check if any were found
      const addedColumns = changes.filter(c => c.type === 'added').length;
      const removedColumns = changes.filter(c => c.type === 'removed').length;
      const reorderedColumns = changes.filter(c => c.type === 'reordered').length;
      
      // Important: we also need to include removed columns in the merged results
      // so ReviewFields component can still see them but mark them as removed
      const removedColumnsData = savedColumns
        .filter((col: { name: string }) => !currentColumnMap.has(col.name))
        .map((col: { name: string; id?: string; type?: string; description?: string; options?: any[] }) => ({
          ...col,
          isRemoved: true  // Mark as removed so UI can handle it appropriately
        }));
      
      // Add removed columns to the end of mergedColumns with a special flag
      const finalMergedColumns = [...mergedColumns];
      
      if (removedColumnsData.length > 0) {
        console.log(`🚫 Including ${removedColumnsData.length} removed columns in results with 'isRemoved' flag:`, 
          removedColumnsData.map((col: any) => col.name));
        finalMergedColumns.push(...removedColumnsData);
      }
      
      const hasChanges = changes.some(change => change.type !== 'unchanged');
      console.log(`📊 COLUMN CHANGES SUMMARY: ${hasChanges ? '⚠️ Changes detected' : '✅ No changes'}`);
      console.log(`- Added: ${addedColumns}`);
      console.log(`- Removed: ${removedColumns}`);
      console.log(`- Reordered: ${reorderedColumns}`);
      console.log(`- Final merged column count: ${finalMergedColumns.length}`);
      
      return {
        hasChanges: hasChanges,
        changes,
        mergedColumns: finalMergedColumns,
        savedColumns,
        currentColumns
      };
    } catch (error) {
      console.error('Error checking column changes:', error);
      return null;
    }
  };

  return (
    <GoogleSheetsContext.Provider
      value={{
        isConnected,
        isLoading,
        sheets,
        loadingSheets,
        selectedSheet,
        pagination,
        searchQuery,
        sortBy,
        sortOrder,
        setSearchQuery,
        setSortBy,
        setSortOrder,
        setSelectedSheet,
        checkConnectionStatus,
        refreshConnectionStatus,
        listSheets,
        loadMoreSheets,
        refreshSheets,
        createSheet,
        getSheetColumns,
        saveSheetConnection,
        writeSheetColumns,
        getSheetConnection,
        checkSheetColumnChanges,
        lastRefreshAttempt
      }}
    >
      {children}
    </GoogleSheetsContext.Provider>
  )
}
