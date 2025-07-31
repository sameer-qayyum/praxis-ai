// Supabase Edge Function for creating a new Google Sheet
// This keeps client_secret secure by handling the API calls server-side
// TypeScript declarations for development environment
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
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
    // Get the request body
    const { userId, sheetName } = await req.json();
    if (!userId || !sheetName) {
      return new Response(JSON.stringify({
        error: "Missing required parameters: userId and sheetName"
      }), {
        status: 400,
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
    const { data: credentials, error: credentialsError } = await supabase.from("oauth_credentials").select("access_token, expires_at").eq("user_id", userId).eq("provider", "google_sheets").single();
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
    // Call the Google Sheets API to create a new spreadsheet
    const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.access_token}`
      },
      body: JSON.stringify({
        properties: {
          title: sheetName
        }
      })
    });
    if (!response.ok) {
      const errorData = await response.json();
      return new Response(JSON.stringify({
        error: "Failed to create Google Sheet",
        details: errorData
      }), {
        status: response.status,
        headers: corsHeaders
      });
    }
    const data = await response.json();
    // Transform the Google API response into our expected format
    const newSheet = {
      id: data.spreadsheetId,
      name: data.properties.title,
      lastModified: new Date().toISOString(),
      url: `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`
    };
    // Return the new sheet information
    return new Response(JSON.stringify({
      success: true,
      sheet: newSheet
    }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    console.error("Error creating Google Sheet:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      error: "Failed to create Google Sheet",
      message: errorMessage
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
