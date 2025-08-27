import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr'; 
import { cookies } from 'next/headers';
import { corsHeaders, handleCorsPreflightRequest } from '@/utils/cors';

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(
  request: Request,
  { params }: { params: { sheetId: string } }
) {
  // Check if this is a preflight request
  const preflightResponse = handleCorsPreflightRequest(request);
  if (preflightResponse) return preflightResponse;
  
  try {
    // Check if this is an internal service call with service role key
    const serviceRoleKey = request.headers.get('x-supabase-service-role-key');
    const providedUserId = request.headers.get('x-user-id');
    let userId: string;
    
    // Create appropriate Supabase client based on authentication method
    let supabase;
    
    if (serviceRoleKey && serviceRoleKey === process.env.SUPABASE_SERVICE_ROLE_KEY && providedUserId) {
      // Service role authentication for internal API calls
      const emptyStore = await cookies(); // Empty cookie store for service role client
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            get(name: string) {
              return emptyStore.get(name)?.value;
            },
            set(name: string, value: string, options) {
              // No-op for service role client
            },
            remove(name: string, options) {
              // No-op for service role client
            },
          },
        }
      );
      userId = providedUserId;
    } else {
      // Standard user authentication via session cookies
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
            { error: refreshResult.error || "Failed to refresh access token" },
            { status: 500, headers: corsHeaders }
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

    // Parse URL to check for update parameters
    const url = new URL(request.url);
    const updateId = url.searchParams.get('updateId');
    const idColumn = url.searchParams.get('idColumn') || 'A'; // Default to column A
    const isUpdateMode = !!updateId;

    // Get the data from the request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400, headers: corsHeaders }
      );
    }
    
    const rowData = body.data;
    
    if (!rowData || typeof rowData !== 'object') {
      return NextResponse.json(
        { error: "Invalid data format. Expected object." },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Get information about the sheet to validate ownership and get spreadsheet ID
    const { data: sheetData, error: sheetError } = await supabase
      .from("google_sheets_connections")
      .select("*") // Select all fields for debugging
      .eq("sheet_id", params.sheetId)
      .eq("user_id", userId)
      .single();

    console.log('Sheet data from DB:', JSON.stringify(sheetData, null, 2));
    console.log('Sheet error:', sheetError);

    if (sheetError || !sheetData) {
      return NextResponse.json(
        { error: "Sheet not found or access denied" },
        { status: 404, headers: corsHeaders }
      );
    }
    
    // Process form data for Google Sheets format
    const valueArray = [Object.values(rowData)];
    const formattedSheetName = `'${sheetData.sheet_name.replace(/'/g, "''")}'`;
    
    // Handle update mode vs append mode
    if (isUpdateMode) {
      // UPDATE MODE: Find the row with the specified ID and update it
      try {
        // First, query the sheet to find the row with the matching ID
        const queryResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetData.spreadsheet_id}/values/${formattedSheetName}!${idColumn}:${idColumn}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${credentials.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!queryResponse.ok) {
          const errorText = await queryResponse.text();
          console.error('Google Sheets query error:', errorText);
          return NextResponse.json(
            { error: "Failed to query Google Sheet for update", details: errorText },
            { status: queryResponse.status, headers: corsHeaders }
          );
        }

        const queryResult = await queryResponse.json();
        const values = queryResult.values || [];
        
        // Find the row index that matches the updateId
        let targetRowIndex = -1;
        for (let i = 0; i < values.length; i++) {
          if (values[i][0] === updateId) {
            targetRowIndex = i + 1; // Google Sheets uses 1-based indexing
            break;
          }
        }

        if (targetRowIndex === -1) {
          return NextResponse.json(
            { error: `No row found with ${idColumn} = '${updateId}'` },
            { status: 404, headers: corsHeaders }
          );
        }

        // Update the specific row
        const updateResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetData.spreadsheet_id}/values/${formattedSheetName}!${targetRowIndex}:${targetRowIndex}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${credentials.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              values: valueArray
            })
          }
        );

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error('Google Sheets update error:', errorText);
          return NextResponse.json(
            { error: "Failed to update Google Sheet row", details: errorText },
            { status: updateResponse.status, headers: corsHeaders }
          );
        }

        const updateResult = await updateResponse.json();
        
        return NextResponse.json({
          success: true,
          mode: 'update',
          updatedRange: updateResult.updatedRange,
          updatedRows: updateResult.updatedRows,
          updatedCells: updateResult.updatedCells,
          targetRow: targetRowIndex
        }, { headers: corsHeaders });

      } catch (error: any) {
        console.error('Error updating Google Sheet:', error);
        return NextResponse.json(
          { error: "Error updating Google Sheet", details: error.message },
          { status: 500, headers: corsHeaders }
        );
      }
    }
    
    // APPEND MODE: Original functionality (default behavior)
    try {
      
      const appendResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetData.spreadsheet_id || sheetData.sheet_id}/values/${formattedSheetName}!A:Z:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${credentials.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: valueArray
          })
        }
      );
  
      if (!appendResponse.ok) {
        const errorText = await appendResponse.text();
        console.error('Google Sheets API error:', errorText);
        return NextResponse.json(
          {
            error: "Failed to append to Google Sheet",
            status: appendResponse.status,
            details: errorText
          },
          { status: appendResponse.status, headers: corsHeaders }
        );
      }
  
      const appendResult = await appendResponse.json();
      
      // Return success response
      return NextResponse.json({
        success: true,
        mode: 'append',
        updatedRange: appendResult.updates?.updatedRange,
        updatedRows: appendResult.updates?.updatedRows,
      }, { headers: corsHeaders });
    } catch (error: any) {
      console.error('Error appending to Google Sheet:', error);
      
      return NextResponse.json(
        { error: "Error appending to Google Sheet", details: error.message },
        { status: 500, headers: corsHeaders }
      );
    }
    
  } catch (error: any) {
    console.error("Error in sheet append API:", error);
    return NextResponse.json(
      { error: "Failed to append data to sheet", details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
