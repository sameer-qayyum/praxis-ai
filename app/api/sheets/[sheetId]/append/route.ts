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
      .select("spreadsheet_id, sheet_name, columns_metadata")
      .eq("sheet_id", params.sheetId)
      .eq("user_id", userId)
      .single();

    if (sheetError || !sheetData) {
      return NextResponse.json(
        { error: "Sheet not found or access denied" },
        { status: 404, headers: corsHeaders }
      );
    }
    
    // Process form data for Google Sheets format
    // Convert the object to an array for Google Sheets API format
    // For a form submission, we convert {key1: value1, key2: value2} to [[key1, key2], [value1, value2]]
    // Or just [Object.values(rowData)] if we're just appending values
    
    // For form submissions, we'll just append the values
    const valueArray = [Object.values(rowData)];
    
    console.log('Appending data to sheet:', {
      sheetId: params.sheetId,
      spreadsheetId: sheetData.spreadsheet_id,
      sheetName: sheetData.sheet_name,
      values: valueArray
    });
    
    // Append data to the Google Sheet
    try {
      const appendResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetData.spreadsheet_id}/values/${sheetData.sheet_name}!A:Z:append?valueInputOption=USER_ENTERED`,
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
      console.log('Successfully appended data to sheet:', appendResult);
      
      // Return success response
      return NextResponse.json({
        success: true,
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
