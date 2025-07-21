import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies"
import { nanoid } from "nanoid"

// Generate a state parameter for OAuth security
export async function GET(request: Request) {
  // Get the referrer URL
  const referrer = request.headers.get('referer') || '/dashboard'
  try {
    // Generate a random state for CSRF protection
    const state = nanoid(16)
    
    // Set the state in a secure HTTP-only cookie
    // Use proper type assertion to avoid TypeScript errors
    const cookieStore = cookies() as unknown as ReadonlyRequestCookies
    cookieStore.set("googleOAuthState", state, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10 // 10 minutes expiry
    })
    
    // Also store the referrer URL to redirect back after OAuth
    cookieStore.set("googleOAuthReferrer", referrer, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10 // 10 minutes expiry
    })
    
    // Return the state to the client for use in the OAuth request
    return NextResponse.json({ state })
  } catch (error) {
    console.error("Error generating OAuth state:", error)
    return NextResponse.json(
      { error: "Failed to generate state parameter" },
      { status: 500 }
    )
  }
}
