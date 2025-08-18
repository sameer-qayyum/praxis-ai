import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/lib/supabase/server';

/**
 * GET handler to fetch app versions from Supabase
 */
export async function GET(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = await createClient();
    
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Please login first" },
        { status: 401 }
      );
    }
    
    // Get appId from query params
    const searchParams = request.nextUrl.searchParams;
    const appId = searchParams.get("appId");
    
    
    if (!appId) {
      return NextResponse.json(
        { error: "Missing required parameter: appId" },
        { status: 400 }
      );
    }

    // Fetch versions from Supabase with normal RLS
    const { data: versions, error } = await supabase
      .from('app_versions')
      .select('*')
      .eq('app_id', appId)
      .order('version_number', { ascending: false });
    
    
    if (error) {
      console.error('Error fetching app versions:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch app versions' },
        { status: 500 }
      );
    }

    // Return the versions
    const response = { success: true, versions };
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Error fetching app versions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch app versions' },
      { status: 500 }
    );
  }
}
