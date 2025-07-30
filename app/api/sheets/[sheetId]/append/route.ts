import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr'; 
import { cookies } from 'next/headers';

export async function POST(
  request: Request,
  { params }: { params: { sheetId: string } }
) {
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
          { status: 401 }
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
        { status: 400 }
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
            { status: 401 }
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
          { status: 401 }
        );
      }
    }

    // Get sheet ID from params
    const sheetId = params.sheetId;

    // Get the row data from request body
    const requestBody = await request.json().catch(() => null);
    if (!requestBody || !Array.isArray(requestBody.values)) {
      return NextResponse.json(
        { error: "Invalid request body: Expected { values: any[][] }" },
        { status: 400 }
      );
    }
    
    // Get sheet connection to validate and get metadata
    const { data: sheetConnection, error: sheetError } = await supabase
      .from('google_sheets_connections')
      .select('columns_metadata')
      .eq('sheet_id', sheetId)
      .eq('user_id', userId)
      .single();
    
    if (sheetError || !sheetConnection) {
      return NextResponse.json(
        { error: "Sheet connection not found or unauthorized" },
        { status: 404 }
      );
    }
    
    // Validate data against column structure if metadata exists
    if (sheetConnection.columns_metadata && Array.isArray(sheetConnection.columns_metadata)) {
      // Extract column names for validation
      const columns = sheetConnection.columns_metadata;
      
      // Check if any rows have more values than we have columns
      if (requestBody.values.some((row: any[]) => row.length > columns.length)) {
        return NextResponse.json(
          { 
            error: "Data validation failed", 
            details: "Row has more values than available columns" 
          },
          { status: 400 }
        );
      }
    }

    // Append data to the Google Sheet
    const appendResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:A:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: requestBody.values
        })
      }
    );

    if (!appendResponse.ok) {
      const errorText = await appendResponse.text();
      return NextResponse.json(
        { 
          error: "Failed to append data to sheet", 
          status: appendResponse.status,
          details: errorText
        },
        { status: appendResponse.status }
      );
    }

    const appendResult = await appendResponse.json();

    // Return success response
    return NextResponse.json({
      success: true,
      updatedRows: appendResult.updates?.updatedRows || requestBody.values.length,
      updatedColumns: appendResult.updates?.updatedColumns || 0,
      updatedCells: appendResult.updates?.updatedCells || 0
    });
    
  } catch (error: any) {
    console.error("Error in sheet append API:", error);
    
    return NextResponse.json(
      { error: "Failed to process request", details: error.message },
      { status: 500 }
    );
  }
}
