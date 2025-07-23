"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

interface GoogleSheet {
  id: string
  name: string
  lastModified: string
  url: string
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
        lastRefreshAttempt,
      }}
    >
      {children}
    </GoogleSheetsContext.Provider>
  )
}
