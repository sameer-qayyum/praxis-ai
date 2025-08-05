import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get user session to ensure we're authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    
    // Get request body
    const body = await request.json();
    const { userIds, email } = body;
    
    // Handle user lookup by email
    if (email) {
      const { data, error } = await supabase.auth.admin.listUsers()
      
      // Find user by email
      const matchingUser = error ? null : data.users.find(
        (user) => user.email?.toLowerCase() === email.toLowerCase()
      )
      
      // Format response to match our expected structure
      const formattedData = matchingUser ? [{ id: matchingUser.id, email: matchingUser.email }] : [];
      
      if (error) {
        console.error("Error checking user by email:", error);
        return NextResponse.json(
          { error: "Failed to check if user exists" },
          { status: 500 }
        );
      }
      
      return NextResponse.json({ data: formattedData });
    }
    
    // Handle user lookup by IDs
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ data: [] });
    }
    
    // Server-side access to auth users via admin API
    const { data, error } = await supabase.auth.admin.listUsers()
    
    // Filter users by the requested IDs
    const matchingUsers = error ? [] : data.users
      .filter(user => userIds.includes(user.id))
      .map(user => ({ id: user.id, email: user.email }));
    
    if (error) {
      console.error("Error fetching user emails:", error);
      return NextResponse.json(
        { error: "Failed to fetch user emails" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ data: matchingUsers });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
