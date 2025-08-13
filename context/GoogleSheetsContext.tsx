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
  type: 'added' | 'removed' | 'reordered' | 'unchanged' | 'renamed';
  name: string; // for renamed, this is the new name
  index?: number;
  newIndex?: number;
  oldName?: string; // present when type === 'renamed'
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
  getSheetColumns: (sheetId: string, sheetTabName?: string) => Promise<SheetColumnsResponse>;
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
  const getSheetColumns = async (sheetId: string, sheetTabName?: string): Promise<SheetColumnsResponse> => {
    try {
      const session = await supabase.auth.getSession()
      if (!session?.data?.session) {
        throw new Error("User is not authenticated")
      }
      
      const url = `/api/sheets/${sheetId}/columns` + (sheetTabName ? `?sheet=${encodeURIComponent(sheetTabName)}` : "")
      const response = await fetch(url)
      
      if (!response.ok) {
        // Check if token is expired
        if (response.status === 401) {
          const errorData = await response.json()
          if (errorData?.expired) {
            // Token expired - try refreshing and calling again
            const refreshed = await refreshConnectionStatus()
            if (refreshed) {
              return await getSheetColumns(sheetId, sheetTabName) // Retry after refresh, preserve sheet tab name
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

  // Check for changes between saved columns metadata and actual Google Sheet columns (simple index-based)
  const checkSheetColumnChanges = async (sheetId: string): Promise<ColumnSyncResult | null> => {
    try {
      const savedConnection = await getSheetConnection(sheetId);
      const sheetData = await getSheetColumns(sheetId);
      if (sheetData.isEmpty) return null;

      if (!savedConnection || !Array.isArray(savedConnection.columns_metadata)) {
        return {
          hasChanges: false,
          changes: [],
          mergedColumns: sheetData.columns.map((c) => ({ id: `col-${Math.random().toString(36).slice(2,11)}`, name: c.name, type: c.type, description: '', options: [] })),
          savedColumns: [],
          currentColumns: sheetData.columns,
        };
      }

      // Use ALL saved columns (global metadata) for comparison as per rule
      const savedRaw: any[] = savedConnection.columns_metadata;
      // Order saved by originalIndex (global position), fallback to their relative order in savedRaw
      const savedOrdered = [...savedRaw].sort((a, b) => {
        const ai = typeof a.originalIndex === 'number' ? a.originalIndex : savedRaw.indexOf(a);
        const bi = typeof b.originalIndex === 'number' ? b.originalIndex : savedRaw.indexOf(b);
        return ai - bi;
      });
      const current = sheetData.columns;
      const norm = (s: string) => (s || '').trim().toLowerCase();

      // Debug: log inputs before diffing
      try {
        console.group('[SheetsSync][checkSheetColumnChanges] Inputs');
        console.log('sheetId:', sheetId);
        console.log('Saved (ordered) count:', savedOrdered.length,
          savedOrdered.map((c: any, i: number) => ({ i, name: c?.name, originalIndex: c?.originalIndex })));
        console.log('Current (sheet) count:', current.length,
          current.map((c: any, i: number) => ({ i, name: c?.name })));
        console.groupEnd();
      } catch {}

      // Two-pointer diff with lookahead to handle shifts from deletions/additions
      const changes: ColumnChange[] = [];
      const removedIdx: number[] = [];
      const addedIdx: number[] = [];
      const renamedPairs: Array<{ index: number; oldName: string; newName: string }> = [];

      const savedLen = savedOrdered.length;
      const currentLen = current.length;
      let iS = 0;
      let iC = 0;

      const eq = (a?: string, b?: string) => norm(a || '') === norm(b || '');

      while (iS < savedLen && iC < currentLen) {
        const s = savedOrdered[iS];
        const c = current[iC];
        if (eq(s.name, c.name)) {
          try { console.debug('[SheetsSync][diff] unchanged', { iS, iC, name: c.name }); } catch {}
          changes.push({ type: 'unchanged', name: c.name, index: iC });
          iS += 1; iC += 1;
          continue;
        }
        // Lookahead: deletion in saved (removal) shifts left -> current[iC] matches saved[iS+1]
        if (iS + 1 < savedLen && eq(savedOrdered[iS + 1].name, c.name)) {
          removedIdx.push(iS);
          try { console.debug('[SheetsSync][diff] removed (lookahead match next saved)', { removedName: s.name, iS, iC, matchesNextSaved: savedOrdered[iS + 1].name }); } catch {}
          changes.push({ type: 'removed', name: s.name, index: iS });
          iS += 1;
          continue;
        }
        // Lookahead: addition in current shifts right -> current[iC+1] matches saved[iS]
        if (iC + 1 < currentLen && eq(s.name, current[iC + 1].name)) {
          addedIdx.push(iC);
          try { console.debug('[SheetsSync][diff] added (lookahead match next current)', { addedName: c.name, iS, iC, matchesNextCurrent: current[iC + 1].name }); } catch {}
          changes.push({ type: 'added', name: c.name, index: iC });
          iC += 1;
          continue;
        }
        // Otherwise treat as rename at this aligned position
        renamedPairs.push({ index: iC, oldName: s.name, newName: c.name });
        try { console.debug('[SheetsSync][diff] renamed', { index: iC, oldName: s.name, newName: c.name }); } catch {}
        changes.push({ type: 'renamed', name: c.name, oldName: s.name, index: iC });
        iS += 1; iC += 1;
      }

      // Any remaining in saved are removed
      while (iS < savedLen) {
        removedIdx.push(iS);
        try { console.debug('[SheetsSync][diff] removed (tail of saved)', { iS, name: savedOrdered[iS]?.name }); } catch {}
        changes.push({ type: 'removed', name: savedOrdered[iS].name, index: iS });
        iS += 1;
      }
      // Any remaining in current are added
      while (iC < currentLen) {
        addedIdx.push(iC);
        try { console.debug('[SheetsSync][diff] added (tail of current)', { iC, name: current[iC]?.name }); } catch {}
        changes.push({ type: 'added', name: current[iC].name, index: iC });
        iC += 1;
      }

      // Build merged active sequence aligned to current using saved metadata when matched/renamed
      const savedIdByName = new Map<string, any>();
      for (const s of savedOrdered) savedIdByName.set(norm(s.name), s);

      const renamedNewToOld = new Map<string, string>();
      for (const r of renamedPairs) renamedNewToOld.set(norm(r.newName), r.oldName);

      const mergedActive = current.map((c, idx) => {
        const normName = norm(c.name);
        if (addedIdx.includes(idx)) {
          return { id: `col-${Math.random().toString(36).slice(2,11)}`, name: c.name, type: 'text', description: '', options: [] };
        }
        // Prefer renamed mapping at this position
        const oldName = renamedNewToOld.get(normName);
        if (typeof oldName === 'string') {
          const saved = savedIdByName.get(norm(oldName)) || {};
          return { id: saved.id || `col-${Math.random().toString(36).slice(2,11)}`, name: c.name, type: saved.type || 'text', description: saved.description || '', options: saved.options || [] };
        }
        // Unchanged or shifted-but-same name: use saved metadata if exists, else defaults
        const saved = savedIdByName.get(normName) || {};
        return { id: saved.id || `col-${Math.random().toString(36).slice(2,11)}`, name: c.name, type: saved.type || 'text', description: saved.description || '', options: saved.options || [] };
      });

      // Removed entries appended with isRemoved
      const removedTail = removedIdx.sort((a,b)=>a-b).map((i) => {
        const saved = savedOrdered[i] || {};
        return { ...saved, isRemoved: true };
      });

      const finalMerged = [...mergedActive, ...removedTail];
      const hasChanges = changes.some(ch => ch.type !== 'unchanged');

      // Debug: log outputs after diffing
      try {
        console.group('[SheetsSync][checkSheetColumnChanges] Outputs');
        console.log('removedIdx:', removedIdx, 'addedIdx:', addedIdx);
        console.log('renamedPairs:', renamedPairs);
        console.log('changes:', changes);
        console.log('mergedActive:', mergedActive.map((c: any, i: number) => ({ i, name: c?.name, id: c?.id })));
        console.log('removedTail:', removedTail.map((c: any) => ({ name: c?.name, isRemoved: c?.isRemoved })));
        console.log('finalMerged:', finalMerged.map((c: any, i: number) => ({ i, name: c?.name, isRemoved: (c as any)?.isRemoved })));
        console.log('hasChanges:', hasChanges);
        console.groupEnd();
      } catch {}

      return {
        hasChanges,
        changes,
        mergedColumns: finalMerged,
        savedColumns: savedOrdered,
        currentColumns: current,
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
