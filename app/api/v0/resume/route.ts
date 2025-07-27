import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/lib/supabase/server';
import { v0 } from 'v0-sdk';

/**
 * POST handler to resume processing of a previously interrupted or incomplete message in a chat
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const { chatId, messageId } = await request.json();

    // Validate parameters
    if (!chatId || !messageId) {
      return NextResponse.json(
        { error: "Missing required parameters: chatId or messageId" },
        { status: 400 }
      );
    }
    
    // Call the v0 SDK to resume message processing
    const result = await v0.chats.resume({
      chatId,
      messageId
    });

    // Return the result
    return NextResponse.json({
      success: true,
      result
    });
    
  } catch (error: any) {
    console.error('Error resuming message:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to resume message processing' },
      { status: 500 }
    );
  }
}
