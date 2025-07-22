// Supabase Edge Function for refreshing Google OAuth tokens
// This keeps client_secret secure by handling the token refresh server-side
// TypeScript declarations for development environment
// These won't affect the actual Supabase deployment
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
// Define allowed origins for CORS
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://praxis-ai.vercel.app"
];
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Max-Age": "86400"
      }
    });
  }
  // Set CORS headers for the actual request
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json"
  };
  try {
    // Check if request body exists
    const contentLength = req.headers.get("content-length");
    if (!contentLength || parseInt(contentLength) === 0) {
      console.error("Empty request body received");
      return new Response(JSON.stringify({
        error: "Empty request body"
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    // Attempt to parse the request body and log for debugging
    let body;
    try {
      const text = await req.text();
      console.log("Request body received:", text);
      body = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(JSON.stringify({
        error: "Invalid JSON in request body"
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    // Extract parameters
    const { refreshToken, userId } = body;
    if (!refreshToken || !userId) {
      return new Response(JSON.stringify({
        error: "Missing required parameters"
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    // Get credentials from environment variables
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!clientId || !clientSecret || !supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({
        error: "Missing required environment variables"
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
    // Call Google OAuth API to refresh the token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error("Error refreshing token:", tokenData);
      return new Response(JSON.stringify({
        error: "Failed to refresh token"
      }), {
        status: tokenResponse.status,
        headers: corsHeaders
      });
    }
    // Initialize Supabase client with service role to update the database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Calculate expiration time (default to 1 hour if not specified)
    const expiresIn = tokenData.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    // Update the token in the database
    const { error: updateError } = await supabase.from("oauth_credentials").update({
      access_token: tokenData.access_token,
      // Only update refresh token if a new one was provided
      refresh_token: tokenData.refresh_token || refreshToken,
      token_type: tokenData.token_type,
      expires_at: expiresAt,
      scope: tokenData.scope,
      updated_at: new Date().toISOString()
    }).eq("user_id", userId).eq("provider", "google_sheets");
    if (updateError) {
      console.error("Error updating token in database:", updateError);
      return new Response(JSON.stringify({
        error: "Failed to update token in database"
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
    // Return the new token data to the client
    return new Response(JSON.stringify({
      success: true,
      access_token: tokenData.access_token,
      expires_at: expiresAt
    }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (err) {
    const error = err;
    console.error("Error in token refresh:", error);
    return new Response(JSON.stringify({
      error: "Failed to refresh token"
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
