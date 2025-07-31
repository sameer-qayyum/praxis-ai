// Supabase Edge Function for listing a user's Google Sheets
// This keeps client_secret secure by handling the API calls server-side
// TypeScript declarations for development environment
// These won't affect the actual Supabase deployment
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
// Define types for cache items
interface CacheItem {
  data: any;
  timestamp: number;
}

// In-memory cache with 5-minute TTL
const cache = new Map<string, CacheItem>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_PAGE_SIZE = 100; // Maximum number of items per page
const DEFAULT_PAGE_SIZE = 20; // Default page size if not specified

// Cache helper functions
function getCachedResponse(key: string): any | null {
  if (!cache.has(key)) return null;
  // We know the key exists because we checked with cache.has
  const cachedItem = cache.get(key)!; // Non-null assertion is safe here
  const now = Date.now();
  // Check if cache is expired
  if (now - cachedItem.timestamp > CACHE_TTL) {
    cache.delete(key); // Remove expired item
    return null;
  }
  return cachedItem.data;
}

function setCachedResponse(key: string, data: any): void {
  // Limit cache size to prevent memory issues (store max 100 responses)
  if (cache.size >= 100) {
    // Clear the oldest entries or expired entries
    const now = Date.now();
    for (const [k, v] of cache.entries()){
      if (now - v.timestamp > CACHE_TTL) {
        cache.delete(k);
      }
    }
    // If still too large, delete oldest entry
    if (cache.size >= 100) {
      const firstKey = cache.keys().next();
      if (!firstKey.done && firstKey.value) {
        cache.delete(firstKey.value);
      }
    }
  }
  cache.set(key, {
    timestamp: Date.now(),
    data
  });
}
Deno.serve(async (req)=>{
  // Set CORS headers for browser compatibility
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json"
  };
  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  try {
    // Parse and validate request parameters
    const params = await req.json();
    if (!params.userId) {
      return new Response(JSON.stringify({
        error: "Missing required parameter: userId"
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    // Validate and sanitize parameters
    const pageSize = Math.min(params.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const pageToken = params.pageToken || '';
    const sortBy = params.sortBy || 'lastModified';
    const sortOrder = params.sortOrder || 'desc';
    const query = params.query?.trim() || '';
    // Generate a cache key based on the parameters
    const cacheKey = `sheets:${params.userId}:${pageSize}:${pageToken}:${sortBy}:${sortOrder}:${query}`;
    // Check cache first
    const cachedResult = getCachedResponse(cacheKey);
    if (cachedResult) {
      console.log("Cache hit for", cacheKey);
      return new Response(JSON.stringify(cachedResult), {
        status: 200,
        headers: corsHeaders
      });
    }
    // Get credentials from environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({
        error: "Missing required environment variables"
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
    // Create a Supabase client with the service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Get the user's Google OAuth credentials from the database
    const { data: credentials, error: credentialsError } = await supabase.from("oauth_credentials").select("access_token, expires_at").eq("user_id", params.userId).eq("provider", "google_sheets").single();
    if (credentialsError || !credentials?.access_token) {
      return new Response(JSON.stringify({
        error: "Failed to retrieve Google credentials",
        details: credentialsError?.message || "No access token found"
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(credentials.expires_at);
    if (now > expiresAt) {
      return new Response(JSON.stringify({
        error: "Google token is expired",
        expired: true
      }), {
        status: 401,
        headers: corsHeaders
      });
    }
    // Log debugging information
    console.log("Access token available:", !!credentials.access_token);
    console.log("Token expires at:", credentials.expires_at);
    // Build the Google Sheets API query with better error handling
    let apiUrl = new URL("https://www.googleapis.com/drive/v3/files");
    // Base query for spreadsheets
    let queryParams = [
      "mimeType='application/vnd.google-apps.spreadsheet'"
    ];
    // Add name filter if query parameter is provided
    if (query) {
      queryParams.push(`name contains '${query}'`);
    }
    apiUrl.searchParams.set("q", queryParams.join(" and "));
    apiUrl.searchParams.set("fields", "files(id,name),nextPageToken"); // Request basic fields
    apiUrl.searchParams.set("pageSize", pageSize.toString());
    console.log("Attempting API call to:", apiUrl.toString());
    // Call the Google Sheets API to list files with detailed error handling
    const response = await fetch(apiUrl.toString(), {
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        Accept: 'application/json'
      }
    });
    console.log("API response status:", response.status, response.statusText);
    if (!response.ok) {
      // Try to get detailed error information
      let errorText;
      try {
        const errorData = await response.json();
        errorText = JSON.stringify(errorData);
        console.error("Google API error details:", errorData);
      } catch (e) {
        errorText = await response.text();
        console.error("Raw error response:", errorText);
      }
      return new Response(JSON.stringify({
        error: "Failed to retrieve Google Sheets",
        status: response.status,
        details: errorText
      }), {
        status: response.status,
        headers: corsHeaders
      });
    }
    const data = await response.json();
    console.log("API returned data:", {
      fileCount: data.files?.length || 0
    });
    // Transform the Google API response into our expected format
    const fileList = data.files || [];
    
    // Define interface for Google Drive file response
    interface GoogleDriveFile {
      id: string;
      name: string;
      modifiedTime?: string;
      webViewLink?: string;
    }
    
    // Fetch sheet metadata for each file to get tab names
    // We'll use Promise.all to fetch them in parallel but limit to avoid rate limits
    const sheetPromises = fileList.map(async (file: GoogleDriveFile) => {
      try {
        // Fetch spreadsheet metadata to get sheet names
        const sheetResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${file.id}?fields=sheets.properties(sheetId,title)`,
          {
            headers: {
              Authorization: `Bearer ${credentials.access_token}`,
              Accept: 'application/json'
            }
          }
        );
        
        if (sheetResponse.ok) {
          const sheetData = await sheetResponse.json();
          const sheets = sheetData.sheets || [];
          
          // Get the first sheet as the active sheet (default behavior in Google Sheets)
          const activeSheetName = sheets.length > 0 ? sheets[0].properties.title : 'Sheet1';
          
          // Get all sheet names for possible future use
          const sheetTabs = sheets.map((sheet: { properties: { sheetId: number; title: string } }) => ({
            id: sheet.properties.sheetId,
            name: sheet.properties.title
          }));
          
          return {
            id: file.id,
            name: file.name,
            lastModified: file.modifiedTime || new Date().toISOString(),
            url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
            activeSheetName,  // Include the name of the first sheet (typically the active one)
            sheetTabs         // Include all sheet tabs in the spreadsheet
          };
        } else {
          // If we can't get sheet info, return basic file info
          console.error(`Failed to get sheet tabs for file ${file.id}: ${sheetResponse.status}`);
          return {
            id: file.id,
            name: file.name,
            lastModified: file.modifiedTime || new Date().toISOString(),
            url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
            activeSheetName: 'Sheet1',  // Default
            sheetTabs: [{ id: 0, name: 'Sheet1' }]  // Default
          };
        }
      } catch (error) {
        console.error(`Error fetching sheet tabs for ${file.id}:`, error);
        return {
          id: file.id,
          name: file.name,
          lastModified: file.modifiedTime || new Date().toISOString(),
          url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
          activeSheetName: 'Sheet1',  // Default
          sheetTabs: [{ id: 0, name: 'Sheet1' }]  // Default
        };
      }
    });
    
    const sheets = await Promise.all(sheetPromises);
    
    // Prepare the response object with pagination info
    const result = {
      success: true,
      sheets,
      pagination: {
        hasMore: !!data.nextPageToken,
        nextPageToken: data.nextPageToken || null,
        totalFound: sheets.length,
        pageSize
      }
    };
    
    // Cache the result for future requests
    setCachedResponse(cacheKey, result);
    
    // Return the list of sheets
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    // Log detailed error information
    console.error("Error in listing Google Sheets:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error && error.stack ? error.stack : 'No stack trace';
    // Log additional context to help with debugging
    console.error("Error context:", {
      message: errorMessage,
      stack: errorDetails.split('\n').slice(0, 3).join('\n') // Just log first few lines of stack
    });
    return new Response(JSON.stringify({
      error: "Failed to list Google Sheets",
      message: errorMessage,
      details: errorDetails
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
