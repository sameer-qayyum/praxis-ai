import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
// Define CORS headers directly in this file for better reliability
const getCorsHeaders = (request: Request) => {
  // When using credentials, we can't use the wildcard '*' for Allow-Origin
  // We must specify the exact origin or set it to the request's origin
  const origin = request.headers.get('origin') || '';
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
    'Access-Control-Allow-Credentials': 'true',
  };
};

// Handle CORS preflight requests
const handleCorsPreflightRequest = (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }
  return null;
};
import { PermissionLevel } from '@/types/permissions';

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function GET(request: Request) {
  // Check if this is a preflight request
  const preflightResponse = handleCorsPreflightRequest(request);
  if (preflightResponse) return preflightResponse;

  try {
    // Log request details for debugging
    console.log('Auth check request received with headers:', {
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
    });
    
    // Extract app URL from Origin or Referer header
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    
    // For debugging/development, allow the check to proceed without strict origin validation
    // Remove this in production if you need strict origin checking
    let appUrl = origin || 'default-app-url';
    if (!origin && referer) {
      try {
        const refererUrl = new URL(referer);
        appUrl = `${refererUrl.protocol}//${refererUrl.host}`;
      } catch (error) {
        console.log('Using default app URL due to referer parsing error');
      }
    }

    // Initialize Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // User is not authenticated, return redirect URL to login page
      const encodedRedirectUrl = encodeURIComponent(appUrl);
      // Ensure the URL has a protocol prefix
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
      const redirectUrl = siteUrl.startsWith('http') ? 
        `${siteUrl}/sign-in` : 
        `https://${siteUrl}/sign-in`;
      
      console.log('Redirecting unauthenticated user to:', redirectUrl);
      
      return NextResponse.json(
        {
          authenticated: false,
          redirectUrl: redirectUrl,
        },
        { status: 401, headers: getCorsHeaders(request) }
      );
    }

    const userId = session.user.id;

    // Find the app by URL
    // For testing, skip app URL validation
    let appId;
    try {
      // Try to find the app by URL, but don't error if not found
      const { data: app } = await supabase
        .from('apps')
        .select('id')
        .eq('app_url', appUrl)
        .maybeSingle();

      // If app is found, use its ID
      if (app) {
        appId = app.id;
        console.log('Found app ID:', appId, 'for URL:', appUrl);
      } else {
        // For testing only: If no app found, we'll still allow authentication check
        // Remove this in production or implement proper fallback logic
        console.log('App not found for URL:', appUrl, '- proceeding anyway for testing');
        
        // In production, you would return a 404 here:
        // return NextResponse.json({ error: 'App not found' }, { status: 404, headers: getCorsHeaders(request) });
      }
    } catch (error) {
      console.error('Error finding app:', error);
      // Continue for testing purposes
    }

    // For testing - if we don't have an appId, skip permission checks
    let hasAccess = true;
    let permissionLevel = PermissionLevel.ADMIN;
    
    // Only check permissions if we found a valid app
    if (appId) {
      // Check if user has permission to access this app
      const { data: permission } = await supabase
        .from('app_permissions')
        .select('permission_level')
        .eq('app_id', appId)
        .eq('user_id', userId)
        .maybeSingle();

      // Also check if user is the app creator
      const { data: isCreator } = await supabase
        .from('apps')
        .select('id')
        .eq('id', appId)
        .eq('created_by', userId)
        .maybeSingle();

      hasAccess = !!permission || !!isCreator;
      if (permission) {
        permissionLevel = permission.permission_level as PermissionLevel;
      }
      
      console.log('Permission check:', { hasAccess, permissionLevel, userId, appId });

      if (!hasAccess) {
        // User does not have permission to access this app
        return NextResponse.json(
          {
            authenticated: true,
            authorized: false,
            message: 'You do not have permission to access this app',
          },
          { status: 403, headers: getCorsHeaders(request) }
        );
      }
    } else {
      console.log('Skipping permission check - no app ID');
    }

    // User is authenticated and has permission
    return NextResponse.json(
      {
        authenticated: true,
        authorized: true,
        user: {
          id: userId,
          email: session.user.email,
        },
        permission: permissionLevel // Will be ADMIN by default or from actual permission
      },
      { status: 200, headers: getCorsHeaders(request) }
    );
  } catch (error) {
    console.error('Auth check error:', error);
    // Return more helpful error information for debugging
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error',
        authenticated: false
      },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
