import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: { sheetId: string } }
) {
  try {
    // Get the app ID from params - proper way to handle dynamic route params
    const appId = (await params).sheetId;
    
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
    
    // First check if we have column metadata in the app's data_model
    const { data: appData, error: appDataError } = await supabase
      .from("apps")
      .select("id, google_sheet, data_model")
      .eq("id", appId)
      .single();
    
    if (appDataError || !appData) {
      return NextResponse.json(
        { error: "App data not found", details: appDataError?.message },
        { status: 404 }
      );
    }
    
    // If we have app-specific data_model, return it
    if (appData.data_model && Array.isArray(appData.data_model) && appData.data_model.length > 0) {
      console.info('[DashboardColumnsAPI][GET] Source: apps.data_model', { appId, count: appData.data_model.length });
      // Ensure we return the actual Google spreadsheet ID, not the connection ID
      const { data: connectionForApp, error: connectionForAppError } = await supabase
        .from("google_sheets_connections")
        .select("sheet_id, sheet_name")
        .eq("id", app.google_sheet)
        .single();

      if (connectionForAppError || !connectionForApp) {
        return NextResponse.json(
          { error: "Sheet connection not found", details: connectionForAppError?.message },
          { status: 404 }
        );
      }

      return NextResponse.json({
        columns: appData.data_model.map((col: any, index: number) => ({
          ...col,
          id: col.id || `field-${index}`,
          active: typeof col.active === 'boolean' ? col.active : true // Respect saved value, default to true only if undefined
        })),
        sheetId: connectionForApp.sheet_id,
        sheetName: connectionForApp.sheet_name || null,
        source: 'app.data_model'
      });
    }
    
    // Fallback to global metadata if app doesn't have its own data_model
    const { data: connection, error: connectionError } = await supabase
      .from("google_sheets_connections")
      .select("id, sheet_id, sheet_name, columns_metadata")
      .eq("id", app.google_sheet)
      .single();
    
    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "Sheet connection not found", details: connectionError?.message },
        { status: 404 }
      );
    }
    
    // If we have saved metadata in the connection, use that
    if (connection.columns_metadata?.length > 0) {
      console.info('[DashboardColumnsAPI][GET] Source: google_sheets_connections.columns_metadata', { connectionId: connection.id, count: connection.columns_metadata.length });
      return NextResponse.json({
        columns: connection.columns_metadata.map((col: any, index: number) => ({
          ...col,
          id: col.id || `field-${index}`,
          active: typeof col.active === 'boolean' ? col.active : true // Respect saved value, default to true only if undefined
        })),
        sheetId: connection.sheet_id,
        source: 'connection.columns_metadata'
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
    const sheetsColumnsUrl = `${baseUrl}/api/sheets/${sheetId}/columns` + (connection.sheet_name ? `?sheet=${encodeURIComponent(connection.sheet_name)}` : "");
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
    console.info('[DashboardColumnsAPI][GET] Source: live_sheet', { sheetId, count: Array.isArray(columnData.columns) ? columnData.columns.length : 'n/a' });
    
    // Transform the API response to include the 'id' and 'active' properties (consistent with UI)
    const transformedColumns = columnData.columns.map((col: any, index: number) => ({
      ...col,
      id: `field-${index}`,
      active: true, // Default to true for newly fetched columns
    }));
    
    return NextResponse.json({
      columns: transformedColumns,
      sheetId: connection.sheet_id,
      source: 'live_sheet'
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
  { params }: { params: { sheetId: string } }
) {
  try {
    // Get the app ID from params - proper way to handle dynamic route params
    const appId = (await params).sheetId;
    
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Please login first" },
        { status: 401 }
      );
    }
    
    // Get the user's ID
    const userId = user.id;
    
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
    
    // Parse the request body
    const body = await request.json();
    const { columns, updateGlobal = false } = body;

    console.info('[DashboardColumnsAPI][PUT] Incoming', { appId, columnsCount: Array.isArray(columns) ? columns.length : 'n/a', updateGlobal });
    
    if (!columns || !Array.isArray(columns)) {
      return NextResponse.json(
        { error: "Invalid request body: columns array is required" },
        { status: 400 }
      );
    }
    
    // Check if the active flag is correctly set on all fields
    const hasAnyFieldsInactive = columns.some((col: any) => col?.active === false);
    
    try {
      // Get the current data_model to compare
      const { data: currentApp } = await supabase
        .from("apps")
        .select("data_model")
        .eq("id", appId)
        .single();
      
      // Sanitize incoming columns: drop preview-removed rows and normalize IDs/booleans
      const columnsForSave = (Array.isArray(columns) ? columns : [])
        .filter((col: any) => !String(col?.id || '').startsWith('removed:'))
        .map((col: any) => ({
          ...col,
          // Strip preview-only ID prefixes if somehow present
          id: String(col?.id || '').startsWith('temp-') || String(col?.id || '').startsWith('dup:') ? undefined : col?.id,
          // Force explicit boolean conversion
          active: col?.active === true
        }));
      
      const { error: appUpdateError, data: updateResult } = await supabase
        .from("apps")
        .update({
          data_model: columnsForSave,
          updated_at: new Date().toISOString()
        })
        .eq("id", appId)
        .select();
      console.info('[DashboardColumnsAPI][PUT] Updated apps.data_model', { appId, count: columnsForSave.length });
      
      if (appUpdateError) {
        return NextResponse.json(
          { error: "Failed to update app data model", details: appUpdateError.message },
          { status: 500 }
        );
      }
    } catch (err: any) {
      console.error('Exception updating app data_model:', err.message);
      return NextResponse.json(
        { error: "Exception updating app data model", details: err.message },
        { status: 500 }
      );
    }
    
    // Optionally update the global sheet metadata if requested
    if (updateGlobal) {
      const { error: globalUpdateError } = await supabase
        .from("google_sheets_connections")
        .update({
          columns_metadata: (Array.isArray(columns) ? columns : [])
            .filter((col: any) => !String(col?.id || '').startsWith('removed:'))
            .map((col: any) => ({
              ...col,
              id: String(col?.id || '').startsWith('temp-') || String(col?.id || '').startsWith('dup:') ? undefined : col?.id,
              active: col?.active === true
            })),
          updated_at: new Date().toISOString()
        })
        .eq("id", app.google_sheet);
      console.info('[DashboardColumnsAPI][PUT] Updated connection.columns_metadata', { connectionId: app.google_sheet });
        
      if (globalUpdateError) {
        return NextResponse.json(
          { 
            error: "Failed to update global metadata", 
            details: globalUpdateError.message,
            note: "App-specific data was updated successfully"
          },
          { status: 500 }
        );
      }
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
