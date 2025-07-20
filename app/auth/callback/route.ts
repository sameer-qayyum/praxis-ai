import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error_code = searchParams.get('error')
  const error_description = searchParams.get('error_description')
  
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard'

  // Handle OAuth errors from provider
  if (error_code) {
    console.error('OAuth error:', error_code, error_description)
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${error_code}`)
  }

  if (code) {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Session exchange error:', error)
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=session_exchange_failed`)
      }

      // Verify the session was created successfully
      if (data?.session?.user) {
        console.log('OAuth success for user:', data.session.user.email)
        
        // Create the redirect response
        const forwardedHost = request.headers.get('x-forwarded-host')
        const isLocalEnv = process.env.NODE_ENV === 'development'
        
        let redirectUrl: string
        if (isLocalEnv) {
          redirectUrl = `${origin}${next}`
        } else if (forwardedHost) {
          redirectUrl = `https://${forwardedHost}${next}`
        } else {
          redirectUrl = `${origin}${next}`
        }
        
        console.log('Redirecting to:', redirectUrl)
        return NextResponse.redirect(redirectUrl)
      } else {
        console.error('No session created after code exchange')
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=no_session`)
      }
    } catch (err) {
      console.error('Unexpected error in OAuth callback:', err)
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=unexpected`)
    }
  }

  console.error('No authorization code received')
  return NextResponse.redirect(`${origin}/auth/auth-code-error?error=no_code`)
}
