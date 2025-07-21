import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies"

export async function GET(request: Request) {
  // Parse URL and get the code and state parameters
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")
  
  // Get the state and referrer from cookies
  const cookieStore = await cookies()
  // Fix TypeScript errors by adding proper type assertions
  const cookieStore2 = cookieStore as unknown as ReadonlyRequestCookies
  const storedState = cookieStore2.get("googleOAuthState")?.value
  // Get the original referrer URL
  const referrer = cookieStore2.get("googleOAuthReferrer")?.value || `${url.origin}/dashboard`

  // Handle errors or invalid state
  if (error) {
    return NextResponse.redirect(
      `${referrer}?googleSheets=error&message=${encodeURIComponent(error)}`
    )
  }

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(
      `${referrer}?googleSheets=error&message=${encodeURIComponent("Invalid request or state mismatch")}`
    )
  }

  try {
    // Create Supabase client
    const supabase = await createClient()
    
    // Get the current user's ID from the session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      return NextResponse.redirect(
        `${referrer}?googleSheets=error&message=${encodeURIComponent("User not authenticated")}`
      )
    }
    
    const userId = session.user.id
    
    // Call our Edge Function to exchange the code for tokens
    // This keeps our client_secret secure
    const response = await fetch(
      "https://yhfvwlptgkczsvemjlqr.supabase.co/functions/v1/google-oauth-exchange",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}` // Add anon key for authorization
        },
        body: JSON.stringify({
          code,
          redirect_uri: `${url.origin}/api/auth/google-sheets-callback`,
        }),
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error("Edge function error:", errorText)
      throw new Error(`Edge function returned ${response.status}: ${errorText}`)
    }
    
    const tokens = await response.json()

    // Store tokens in Supabase using the store_oauth_token function in the secure schema
    const { data: storedToken, error: storeError } = await supabase.rpc(
      "store_oauth_token",
      {
        p_user_id: userId,
        p_provider: "google_sheets",
        p_access_token: tokens.access_token,
        p_refresh_token: tokens.refresh_token,
        p_token_type: tokens.token_type,
        p_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        p_scope: tokens.scope
      }
    )

    if (storeError) {
      console.error("Error storing tokens:", storeError)
      return NextResponse.redirect(
        `${referrer}?googleSheets=error&message=${encodeURIComponent("Failed to store OAuth tokens")}`
      )
    }

    // Clear the cookies by setting an expired date
    cookieStore2.set("googleOAuthState", "", { expires: new Date(0) })
    cookieStore2.set("googleOAuthReferrer", "", { expires: new Date(0) })

    // Redirect back to the original page with success message
    return NextResponse.redirect(`${referrer}?googleSheets=success&message=${encodeURIComponent("Google Sheets connected successfully")}`)
    
    
  } catch (err) {
    console.error("Error in Google OAuth callback:", err)
    return NextResponse.redirect(
      `${referrer}?googleSheets=error&message=${encodeURIComponent("An unexpected error occurred")}`
    )
  }
}
