import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Simple API handler that proxies requests to the sheets API
export async function GET(
  request: Request,
  { params }: { params: { sheetId: string } }
) {
  try {
    // Get the app ID from params - must await dynamic params in Next.js App Router
    const appId = await params.sheetId; // Note: The param is named sheetId due to Next.js routing constraints
    
    console.log("API Route received appId:", appId);
    
    // Parse search parameters
    const { searchParams } = new URL(request.url);
    
    // Create a server-side Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient(
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
            cookieStore.set(name, "", { ...options, maxAge: 0 });
          },
        },
      }
    );
    
    // Authenticate the user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Please login first" },
        { status: 401 }
      );
    }
    
    // Get the user's ID
    const userId = session.user.id;
    
    // Get the app details to verify ownership and get sheet connection
    const { data: app, error: appError } = await supabase
      .from("apps")
      .select("id, google_sheet, created_by")
      .eq("id", appId)
      .single();
    
    if (appError || !app) {
      return NextResponse.json(
        { error: "App not found", details: appError?.message },
        { status: 404 }
      );
    }
    
    // Verify the user owns the app or has permissions
    if (app.created_by !== userId) {
      // Check if user has permissions to this app
      const { count, error: permError } = await supabase
        .from("app_permissions")
        .select("id", { count: "exact" })
        .eq("app_id", appId)
        .eq("user_id", userId);
        
      if (permError || count === 0) {
        return NextResponse.json(
          { error: "You do not have access to this app" },
          { status: 403 }
        );
      }
    }
    
    // Get Google Sheet connection details
    const { data: connection, error: connectionError } = await supabase
      .from("google_sheets_connections")
      .select("sheet_id")
      .eq("id", app.google_sheet)
      .single();
    
    if (connectionError || !connection?.sheet_id) {
      return NextResponse.json(
        { error: "Sheet connection not found", details: connectionError?.message },
        { status: 404 }
      );
    }
    
    const sheetId = connection.sheet_id;
    
    // Build API URL for the internal sheets data endpoint
    let baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    
    // Strip the protocol if it exists
    if (baseUrl.startsWith("http")) {
      const url = new URL(baseUrl);
      baseUrl = url.origin;
    } else if (!baseUrl.startsWith("http")) {
      baseUrl = `https://${baseUrl}`;
    }
    
    console.log("Using base URL:", baseUrl);
    
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    
    // Build filter query string from searchParams
    const filterParams = new URLSearchParams();
    searchParams.forEach((value, key) => {
      filterParams.append(key, value);
    });
    
    // Call the internal sheets data API with service role key
    // Ensure the URL is properly constructed - use localhost for local development
    // When running on localhost, we need to use localhost:3000 to access our own API
    const sheetsDataUrl = `${baseUrl}/api/sheets/${sheetId}/data?${filterParams.toString()}`;
    console.log("Making request to internal API:", sheetsDataUrl);
    
    try {
      const response = await fetch(sheetsDataUrl, {
        method: "GET",
        headers: {
          "x-supabase-service-role-key": serviceRoleKey,
          "x-user-id": userId,
        },
      });
    
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error fetching sheet data:", errorData);
        return NextResponse.json(
          { error: "Failed to fetch sheet data" },
          { status: response.status }
        );
      }
      
      const sheetData = await response.json();
      return NextResponse.json(sheetData);
    } catch (fetchError: any) {
      console.error("Error making request to internal API:", fetchError);
      return NextResponse.json(
        { error: "Internal API request failed", details: fetchError.message },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error("Error in dashboard sheets API:", error);
    
    return NextResponse.json(
      { error: "Failed to process request", details: error.message },
      { status: 500 }
    );
  }
}
