import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/lib/supabase/server';
import { v0 } from 'v0-sdk';

type FileData = {
  name?: string;
  meta?: {
    file?: string;
    lang?: string;
  };
  source?: string;
  content?: string;
};

/**
 * GET handler to retrieve chat messages
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
    
    // Fetch chat messages using SDK
    let chatData: any;
    try {
      chatData = await v0.chats.getById({ chatId });
    } catch (err: any) {
      const msg: string = err?.message || '';
      // Gracefully handle transient propagation where the chat may not be immediately available
      if (msg.includes('HTTP 404') || msg.toLowerCase().includes('chat not found')) {
        const responseData = {
          success: false,
          chatId,
          messages: [],
          demo: null,
          latestVersion: null,
          status: 'provisioning',
          latestVersionStatus: null,
          transient: true
        };
        return NextResponse.json(responseData, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
      }
      throw err;
    }
    

    const responseData = { 
      success: true,
      chatId: chatId,
      messages: chatData.messages || [],
      demo: chatData.demo || null, // Root level demo URL
      latestVersion: chatData.latestVersion || null, // Includes demoUrl
      // Expose status fields to clients for robust polling control
      status: (chatData as any)?.status ?? null,
      latestVersionStatus: (chatData as any)?.latestVersion?.status ?? null
    };
    // Return the complete chat data including demo URLs
    // Add no-store headers to avoid client/proxy caching which can cause stale chat data
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch chat messages' },
      { status: 500 }
    );
  }
}