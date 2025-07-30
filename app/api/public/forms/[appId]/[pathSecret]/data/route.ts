import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@supabase/supabase-js";

// In-memory store for rate limiting - would be replaced with Redis in production
const requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
const RATE_LIMIT = 100; // Requests per hour per app
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

export async function GET(
  request: NextRequest,
  { params }: { params: { appId: string; pathSecret: string } }
) {
  const { appId, pathSecret } = params;
  const { searchParams } = new URL(request.url);
  
  try {
    // 1. Rate limiting check
    const key = `${appId}-data`;
    const now = Date.now();
    const rateData = requestCounts.get(key) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
    
    if (now > rateData.resetTime) {
      // Reset the window
      requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    } else {
      // Increment the counter
      if (rateData.count >= RATE_LIMIT) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Try again later." },
          { status: 429 }
        );
      }
      requestCounts.set(key, { count: rateData.count + 1, resetTime: rateData.resetTime });
    }
    
    // 2. Validate appId and pathSecret
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
    
    // Check if the app exists and the path secret is valid
    const { data: app, error: appError } = await supabase
      .from("apps")
      .select("id, created_by, google_sheet, path_secret")
      .eq("id", appId)
      .single();
    
    if (appError || !app) {
      console.error("Error fetching app:", appError);
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }
    
    if (app.path_secret !== pathSecret) {
      console.error("Invalid path secret provided");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // 3. Get the associated Google Sheet and user ID
    const userId = app.created_by;
    const sheetId = app.google_sheet;
    
    if (!sheetId) {
      return NextResponse.json(
        { error: "No Google Sheet associated with this app" },
        { status: 400 }
      );
    }
    
    // 4. Fetch sheet data from the Google Sheet
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    
    // Build filter query string from searchParams
    const filterParams = new URLSearchParams();
    searchParams.forEach((value, key) => {
      filterParams.append(key, value);
    });
    
    // Call the internal sheets data API with service role key
    const sheetsDataUrl = `${baseUrl}/api/sheets/${sheetId}/data?${filterParams.toString()}`;
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
    
    // 5. Return the filtered data
    return NextResponse.json(sheetData);
    
  } catch (error) {
    console.error("Error in data retrieval API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
