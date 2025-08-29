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
    const chatData = await v0.chats.getById({
      chatId
    });
    
    console.log('🔍 [GETCHAT API] Raw V0 response for chat:', chatId, {
      hasDemo: !!chatData.demo,
      demoUrl: chatData.demo || 'null',
      hasLatestVersion: !!chatData.latestVersion,
      latestVersionDemoUrl: chatData.latestVersion?.demoUrl || 'null',
      messageCount: chatData.messages?.length || 0,
      chatDataKeys: Object.keys(chatData)
    });
    
    // Format messages for the client
    const messages = chatData.messages.map((message: any) => ({
      id: message.id,
      role: message.role,
      content: message.text || message.content || "",
      created_at: message.created_at,
      files: message.files || []
    }));

    const responseData = { 
      success: true,
      chatId: chatId,
      messages: chatData.messages || [],
      demo: chatData.demo || null, // Root level demo URL
      latestVersion: chatData.latestVersion || null // Includes demoUrl
    };

    console.log('📤 [GETCHAT API] Sending response:', {
      chatId: responseData.chatId,
      messageCount: responseData.messages.length,
      hasDemo: !!responseData.demo,
      demoUrl: responseData.demo,
      hasLatestVersion: !!responseData.latestVersion,
      latestVersionDemoUrl: responseData.latestVersion?.demoUrl || null
    });

    // Return the complete chat data including demo URLs
    return NextResponse.json(responseData);
    
  } catch (error: any) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch chat messages' },
      { status: 500 }
    );
  }
}