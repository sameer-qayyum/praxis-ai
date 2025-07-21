// Supabase Edge Function for Google OAuth token exchange
// This keeps client_secret secure by handling the exchange server-side

// TypeScript declarations for development environment
// These won't affect the actual Supabase deployment
declare global {
  interface DenoNamespace {
    serve(handler: (req: Request) => Promise<Response>): void;
    env: {
      get(key: string): string | undefined;
    };
  }
  var Deno: DenoNamespace;
}

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

interface TokenExchangeRequest {
  code: string
  redirect_uri: string
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope: string
}

Deno.serve(async (req: Request) => {
  try {
    // Parse request body
    const { code, redirect_uri } = await req.json() as TokenExchangeRequest
    
    if (!code || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Get client ID and secret from environment variables
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Missing OAuth configuration" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri,
        grant_type: "authorization_code",
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error("Error exchanging code for tokens:", tokenData)
      return new Response(
        JSON.stringify({ error: "Failed to exchange authorization code" }),
        { status: tokenResponse.status, headers: { "Content-Type": "application/json" } }
      )
    }

    // Return the tokens to the client
    return new Response(
      JSON.stringify(tokenData),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
    
  } catch (error) {
    console.error("Error in token exchange:", error)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
