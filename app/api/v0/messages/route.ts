import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options) {
            cookieStore.set(name, value, options);
          },
          remove(name: string, options) {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          },
        },
      }
    );

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Please login first" },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const chatId = searchParams.get("chatId");

    // Validate parameters
    if (!chatId) {
      return NextResponse.json(
        { error: "Missing required parameter: chatId" },
        { status: 400 }
      );
    }

    // Get API key from environment
    const v0ApiKey = process.env.V0_API_KEY;
    if (!v0ApiKey) {
      return NextResponse.json(
        { error: "Missing required API key in server configuration" },
        { status: 500 }
      );
    }

    // Fetch chat details from v0
    const chatResponse = await fetch(`https://api.v0.dev/v1/chats/${chatId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${v0ApiKey}`
      }
    });
    
    if (!chatResponse.ok) {
      return NextResponse.json(
        { error: "Failed to retrieve chat details", details: await chatResponse.text() },
        { status: chatResponse.status }
      );
    }
    
    const chatData = await chatResponse.json();
    
    // Format messages for the client
    const messages = chatData.messages.map((message: any) => ({
      id: message.id,
      role: message.role,
      content: message.text || message.content || "",
      created_at: message.created_at,
      files: message.files || []
    }));

    // Return the formatted messages
    return NextResponse.json({ 
      success: true,
      chatId: chatId,
      messages: messages
    });
    
  } catch (error: any) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch chat messages' },
      { status: 500 }
    );
  }
}
