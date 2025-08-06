import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: { sheetId: string } }
) {
  try {
    // Get the app ID from params
    const appId = params.sheetId;
    
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
    
    // First check if we already have column metadata in the connection
    const { data: connection, error: connectionError } = await supabase
      .from("google_sheets_connections")
      .select("id, sheet_id, columns_metadata")
      .eq("id", app.google_sheet)
      .single();
    
    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "Sheet connection not found", details: connectionError?.message },
        { status: 404 }
      );
    }
    
    // If we have saved metadata, return it
    if (connection.columns_metadata?.length > 0) {
      return NextResponse.json({
        columns: connection.columns_metadata.map((col: any, index: number) => ({
          ...col,
          id: col.id || `field-${index}`,
          include: col.include !== false, // Default to true if not specified
        })),
        sheetId: connection.sheet_id,
      });
    }
    
    // Otherwise, we need to fetch from the columns API using service role
    const sheetId = connection.sheet_id;
    
    // Build API URL for the internal sheets columns endpoint
    let baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    if (baseUrl.startsWith("http")) {
      baseUrl = new URL(baseUrl).host;
    }
    if (!baseUrl.startsWith("http")) {
      baseUrl = `https://${baseUrl}`;
    }
    
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    
    // Call the internal sheets columns API with service role key
    const sheetsColumnsUrl = `${baseUrl}/api/sheets/${sheetId}/columns`;
    const response = await fetch(sheetsColumnsUrl, {
      method: "GET",
      headers: {
        "x-supabase-service-role-key": serviceRoleKey,
        "x-user-id": userId,
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error fetching sheet columns:", errorData);
      return NextResponse.json(
        { error: "Failed to fetch sheet columns" },
        { status: response.status }
      );
    }
    
    const columnData = await response.json();
    
    // Transform the API response to include the 'id' and 'include' properties
    const transformedColumns = columnData.columns.map((col: any, index: number) => ({
      ...col,
      id: `field-${index}`,
      include: true, // Default to true for newly fetched columns
    }));
    
    return NextResponse.json({
      columns: transformedColumns,
      sheetId: connection.sheet_id,
    });
    
  } catch (error: any) {
    console.error("Error in dashboard sheets columns API:", error);
    
    return NextResponse.json(
      { error: "Failed to process request", details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { appId: string } }
) {
  try {
    // Get the app ID from params
    const appId = params.appId;
    
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
    
    // Verify the user owns the app (we only allow owners to update metadata, not just viewers)
    if (app.created_by !== userId) {
      return NextResponse.json(
        { error: "Only app owners can update field metadata" },
        { status: 403 }
      );
    }
    
    // Get the updated metadata from request body
    const { columns } = await request.json();
    
    if (!columns || !Array.isArray(columns)) {
      return NextResponse.json(
        { error: "Invalid request body: columns array is required" },
        { status: 400 }
      );
    }
    
    // Update the connection's metadata
    const { error: updateError } = await supabase
      .from("google_sheets_connections")
      .update({
        columns_metadata: columns,
        updated_at: new Date().toISOString()
      })
      .eq("id", app.google_sheet);
      
    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update metadata", details: updateError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "Metadata updated successfully"
    });
    
  } catch (error: any) {
    console.error("Error in dashboard sheets columns API:", error);
    
    return NextResponse.json(
      { error: "Failed to process request", details: error.message },
      { status: 500 }
    );
  }
}
