import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr'; 
import { cookies } from 'next/headers';
import { corsHeaders, handleCorsPreflightRequest } from '@/utils/cors';

// Type definitions
interface SheetRow {
  [key: string]: string;
}

interface ColumnMetadata {
  name: string;
  type: string;
  description: string;
  sampleData: string[];
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(
  request: Request,
  { params }: { params: { sheetId: string } }
) {
  // Check if this is a preflight request
  const preflightResponse = handleCorsPreflightRequest(request);
  if (preflightResponse) return preflightResponse;
  try {
    // Check for service role authentication from internal API calls
    const providedUserId = request.headers.get('x-user-id');
    const serviceRoleKey = request.headers.get('x-supabase-service-role-key');
    
    let supabase;
    let userId;
    
    // Create appropriate Supabase client based on authentication type
    if (serviceRoleKey && serviceRoleKey === process.env.SUPABASE_SERVICE_ROLE_KEY && providedUserId) {
      // Use service role client for internal API calls
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            get(name: string) { return undefined; },
            set(name: string, value: string, options) {},
            remove(name: string, options) {},
          },
        }
      );
      userId = providedUserId;
    } else {
      // Standard user authentication via cookies for dashboard requests
      const cookieStore = await cookies();
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options) {
              cookieStore.set(name, value, options);
            },
            remove(name: string, options) {
              cookieStore.set(name, '', { ...options, maxAge: 0 });
            },
          },
        }
      );
      
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return NextResponse.json(
          { error: "Unauthorized: Please login first" },
          { status: 401, headers: corsHeaders }
        );
      }
      
      userId = session.user.id;
    }

    // Get user's Google OAuth token
    const { data: credentials, error: credentialsError } = await supabase
      .from("oauth_credentials")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .eq("provider", "google_sheets")
      .single();

    if (credentialsError || !credentials?.access_token) {
      return NextResponse.json(
        { 
          error: "Failed to retrieve Google credentials", 
          details: credentialsError?.message || "No access token found",
          action: "reconnect" 
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(credentials.expires_at);
    
    if (now > expiresAt) {
      // Token is expired, attempt to refresh
      try {
        const refreshResponse = await fetch(
          `https://yhfvwlptgkczsvemjlqr.supabase.co/functions/v1/refresh-google-token`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({
              userId: userId,
              refreshToken: credentials.refresh_token
            })
          }
        );

        const refreshResult = await refreshResponse.json();
        
        if (!refreshResponse.ok || !refreshResult.access_token) {
          return NextResponse.json(
            { 
              error: "Failed to refresh Google token", 
              details: refreshResult.error || "Unknown error",
              action: "reconnect"
            },
            { status: 401, headers: corsHeaders }
          );
        }
        
        // Use the new access token
        credentials.access_token = refreshResult.access_token;
      } catch (refreshError: any) {
        console.error("Error refreshing token:", refreshError);
        return NextResponse.json(
          { 
            error: "Failed to refresh Google token", 
            details: "Error during refresh process",
            action: "reconnect"
          },
          { status: 401, headers: corsHeaders }
        );
      }
    }

    // Get sheet ID from params
    const sheetId = params.sheetId;
    
    // Parse query parameters for filtering, sorting, and pagination
    const url = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = Math.min(
      parseInt(url.searchParams.get('pageSize') || '50', 10),
      1000 // Maximum allowed page size to prevent abuse
    );
    
    // Filter parameters - format: filter[column]=value
    const filterParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      if (key.startsWith('filter[') && key.endsWith(']')) {
        const column = key.slice(7, -1); // Extract column name from filter[column]
        filterParams[column] = value;
      }
    });
    
    // Sort parameters - format: sort=column:direction (e.g., sort=name:asc)
    const sortParam = url.searchParams.get('sort');
    let sortColumn = '';
    let sortDirection = 'asc';
    
    if (sortParam) {
      const [column, direction] = sortParam.split(':');
      sortColumn = column;
      if (direction && (direction.toLowerCase() === 'desc' || direction.toLowerCase() === 'asc')) {
        sortDirection = direction.toLowerCase();
      }
    }

    // Determine if we need metadata for column mapping
    const includeMetadata = url.searchParams.get('includeMetadata') === 'true';
    
    // Get connection metadata to ensure user has access
    const { data: connectionData, error: connectionError } = await supabase
      .from('google_sheets_connections')
      .select('*') // Get all fields for debugging
      .eq('sheet_id', sheetId)
      .eq('user_id', userId)
      .single();
      

    // If metadata is requested but not available, we'll proceed without it
    let columnMetadata = null;
    if (includeMetadata && !connectionError && connectionData?.columns_metadata) {
      columnMetadata = connectionData.columns_metadata;
    }

    // Convert a 1-based column index to Excel-style column letters
    function columnToLetter(column: number): string {
      let temp: number;
      let letter = '';
      while (column > 0) {
        temp = (column - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        column = (column - (temp + 1)) / 26;
      }
      return letter;
    }

    // Calculate the range based on pagination
    // We'll first get headers (row 1), then the actual data page
    const startRow = (page - 1) * pageSize + 2; // +2 because 1-based index and row 1 is headers
    const endRow = startRow + pageSize - 1;
    
    // First, get the headers to determine column count and names
    const spreadsheetId = connectionData.spreadsheet_id || connectionData.sheet_id;
    
    // For sheet names with special characters like spaces or hyphens, we need to use single quotes
    const formattedSheetName = `'${connectionData.sheet_name.replace(/'/g, "''")}'`;
    
    // Get headers from the first row
    const headersResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${formattedSheetName}!A1:ZZ1`,
      {
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          Accept: 'application/json'
        }
      }
    );

    if (!headersResponse.ok) {
      const errorData = await headersResponse.json().catch(() => ({ error: { message: "Unknown error" }}));
      return NextResponse.json(
        { 
          error: "Failed to retrieve sheet headers", 
          status: headersResponse.status,
          details: errorData.error?.message || "Google Sheets API error" 
        },
        { status: headersResponse.status, headers: corsHeaders }
      );
    }

    const headersData = await headersResponse.json();
    const headers = headersData.values?.[0] || [];
    
    // If no headers found, the sheet might be empty
    if (headers.length === 0) {
      return NextResponse.json({
        headers: [],
        rows: [],
        totalRows: 0,
        page,
        pageSize,
        totalPages: 0
      }, { headers: corsHeaders });
    }
    // Get the last column letter for the range
    const lastColumn = columnToLetter(headers.length);
    
    // For small datasets, get all data at once; for large ones, paginate
    // Fetch sheet properties to get row count and other metadata
  
    
    const sheetPropsResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!sheetPropsResponse.ok) {
      return NextResponse.json(
        { error: "Failed to retrieve sheet properties", status: sheetPropsResponse.status },
        { status: sheetPropsResponse.status, headers: corsHeaders }
      );
    }
    
    // Instead of using sheet properties which gives the sheet capacity (default 1000),
    // we need to get the actual row count with data
    // First try to get the metadata about sheet dimensions with values
    const dimensionResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${formattedSheetName}!A:A`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          'Accept': 'application/json'
        }
      }
    );
    
    let totalDataRows = 0;
    
    if (dimensionResponse.ok) {
      const dimensionData = await dimensionResponse.json();
      // Count the actual rows with values (subtract 1 for header)
      totalDataRows = dimensionData.values ? Math.max(0, dimensionData.values.length - 1) : 0;
    } else {
      // Fallback to sheet properties if we can't get the actual count
      const sheetProps = await sheetPropsResponse.json();
      const rowCount = sheetProps.sheets?.[0]?.properties?.gridProperties?.rowCount || 0;
      // We'll still use this, but with a note in the response that it's an estimate
      totalDataRows = Math.max(0, rowCount - 1); // Subtract 1 for header row
    }
    
    // Calculate total pages
    const totalPages = Math.ceil(totalDataRows / pageSize);
    
    // If the requested page is out of bounds, return empty data
    if (page > totalPages && totalPages > 0) {
      return NextResponse.json({
        headers,
        rows: [],
        totalRows: totalDataRows,
        page,
        pageSize,
        totalPages
      }, { headers: corsHeaders });
    }
    
    // Now fetch the actual data for the requested page
    const range = `A${startRow}:${lastColumn}${endRow}`;
    
    const dataResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${formattedSheetName}!${range}?majorDimension=ROWS`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!dataResponse.ok) {
      return NextResponse.json(
        { error: "Failed to retrieve sheet data", status: dataResponse.status },
        { status: dataResponse.status, headers: corsHeaders }
      );
    }
    
    const rawData = await dataResponse.json();
    const rows = rawData.values || [];
    
    // Convert rows to array of objects with header names as keys
    const data = rows.map((row: any[]) => {
      const obj: SheetRow = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
    
    // Apply filtering if any filters are specified
    let filteredData = data;
    if (Object.keys(filterParams).length > 0) {
      filteredData = data.filter((row: SheetRow) => {
        return Object.entries(filterParams).every(([column, value]) => {
          if (!row[column]) return false;
          return String(row[column]).toLowerCase().includes(value.toLowerCase());
        });
      });
    }
    
    // Apply sorting if specified
    if (sortColumn && headers.includes(sortColumn)) {
      filteredData.sort((a: SheetRow, b: SheetRow) => {
        const aVal = a[sortColumn] || '';
        const bVal = b[sortColumn] || '';
        
        // Try to compare as numbers if both values are numeric
        if (!isNaN(Number(aVal)) && !isNaN(Number(bVal))) {
          return sortDirection === 'asc' 
            ? Number(aVal) - Number(bVal)
            : Number(bVal) - Number(aVal);
        }
        
        // Otherwise compare as strings
        return sortDirection === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }
    
    // Prepare response
    const response: {
      headers: string[];
      rows: SheetRow[];
      totalRows: number;
      filteredRows?: number;
      page: number;
      pageSize: number;
      totalPages: number;
      metadata?: ColumnMetadata[];
    } = {
      headers,
      rows: filteredData,
      totalRows: totalDataRows,
      filteredRows: filteredData.length !== data.length ? filteredData.length : undefined,
      page,
      pageSize,
      totalPages
    };
    
    // Include column metadata if requested and available
    if (includeMetadata && columnMetadata.length > 0) {
      response['metadata'] = columnMetadata;
    }
    
    return NextResponse.json(response, { headers: corsHeaders });
    
  } catch (error: any) {
    console.error("Error in sheet data API:", error);
    
    return NextResponse.json(
      { error: "Failed to process request", details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
