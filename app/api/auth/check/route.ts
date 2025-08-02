import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { corsHeaders, handleCorsPreflightRequest } from '@/utils/cors';
import { PermissionLevel } from '@/types/permissions';

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: Request) {
  // Check if this is a preflight request
  const preflightResponse = handleCorsPreflightRequest(request);
  if (preflightResponse) return preflightResponse;

  try {
    // Extract app URL from Origin or Referer header
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    
    // Use origin header first, fall back to referer if needed
    let appUrl = origin;
    if (!appUrl && referer) {
      // Extract domain from referer URL
      try {
        const refererUrl = new URL(referer);
        appUrl = `${refererUrl.protocol}//${refererUrl.host}`;
      } catch (error) {
        console.error('Failed to parse referer URL:', error);
        return NextResponse.json(
          { error: 'Invalid request origin' },
          { status: 400, headers: corsHeaders }
        );
      }
    }
    
    if (!appUrl) {
      return NextResponse.json(
        { error: 'Missing origin or referer header' },
        { status: 400, headers: corsHeaders }
      );
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
      return NextResponse.json(
        {
          authenticated: false,
          redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/auth/login?redirect_to=${encodedRedirectUrl}`,
        },
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = session.user.id;

    // Find the app by URL
    const { data: app, error: appError } = await supabase
      .from('apps')
      .select('id')
      .eq('app_url', appUrl)
      .single();

    if (appError || !app) {
      console.error('App not found for URL:', appUrl, appError);
      return NextResponse.json(
        { error: 'App not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const appId = app.id;

    // Check if user has permission to access this app
    const { data: permission, error: permissionError } = await supabase
      .from('app_permissions')
      .select('permission_level')
      .eq('app_id', appId)
      .eq('user_id', userId)
      .single();

    // Also check if user is the app creator
    const { data: isCreator, error: creatorError } = await supabase
      .from('apps')
      .select('id')
      .eq('id', appId)
      .eq('created_by', userId)
      .single();

    const hasAccess = !!permission || !!isCreator;

    if (!hasAccess) {
      // User does not have permission to access this app
      return NextResponse.json(
        {
          authenticated: true,
          authorized: false,
          message: 'You do not have permission to access this app',
        },
        { status: 403, headers: corsHeaders }
      );
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
        permission: permission?.permission_level || PermissionLevel.ADMIN, // Default to admin if creator
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
