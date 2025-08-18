import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // Use service role key to bypass RLS for internal system queries
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const searchParams = request.nextUrl.searchParams;
    const types = searchParams.get("types")?.split(",") || [];

    let query = supabase.from("prompts").select("*");
    
    // Filter by types if provided
    if (types.length > 0) {
      query = query.in("type", types);
    }

    const { data: prompts, error } = await query;

    if (error) {
      console.error('Error fetching prompts:', error);
      return NextResponse.json(
        { error: "Failed to fetch prompts" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, prompts });

  } catch (error: any) {
    console.error("Error in prompts API:", error);
    return NextResponse.json(
      { error: error.message || "An error occurred" },
      { status: 500 }
    );
  }
}
