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
 * POST handler to send messages using v0 SDK
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

    // Parse request body or get from URL params
    let chatId, message, files;
    
    // Check if this is a GET-like request with chatId as URL parameter
    const searchParams = request.nextUrl.searchParams;
    const urlChatId = searchParams.get("chatId");
    
    if (urlChatId) {
      // If chatId is in URL params, this is a request to fetch messages
      chatId = urlChatId;
      // No message or files needed in this case
    } else {
      // Otherwise parse from JSON body for normal message sending
      const body = await request.json();
      ({ chatId, message, files } = body);
    }

    // Validate parameters
    if (!chatId) {
      return NextResponse.json(
        { error: "Missing required parameter: chatId" },
        { status: 400 }
      );
    }
    
    // If this is a fetch request (from URL params), get the messages
    if (urlChatId) {
      // Fetch chat messages using SDK
      try {
        const chatData = await v0.chats.getById({
          chatId
        });
        
        // Format messages for the client
        const messages = chatData.messages.map((message: any) => ({
          id: message.id,
          role: message.role,
          content: message.text || message.content || "",
          created_at: message.created_at,
          files: message.files || []
        }));

        // Return the full chat data
        return NextResponse.json({ 
          success: true,
          chatId: chatId,
          messages: messages,
          fullChatData: chatData
        });
      } catch (error: any) {
        console.error('Error fetching chat messages:', error);
        return NextResponse.json(
          { error: error.message || 'Failed to fetch chat messages' },
          { status: 500 }
        );
      }
    }
    
    // For sending messages, we need the message parameter
    if (!message) {
      return NextResponse.json(
        { error: "Missing required parameter: message" },
        { status: 400 }
      );
    }
    
    // Prepare the request payload
    const payload: any = {
      chatId,
      message
    };

    // Add files if provided
    if (files && Array.isArray(files) && files.length > 0) {
      payload.files = files;
    }

    // Send message using SDK
    const result = await v0.chats.sendMessage(payload);

    // Get app ID associated with this chat ID
    const { data: appData, error: appError } = await supabase
      .from('apps')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (appError) {
      console.error('Error finding app:', appError);
      // Continue execution even if app not found - the message was sent successfully
    } else if (appData) {
      // Get the current number of messages
      const { data: currentData, error: getError } = await supabase
        .from('apps')
        .select('number_of_messages')
        .eq('id', appData.id)
        .single();
      
      if (getError) {
        console.error('Error getting current message count:', getError);
      } else {
        // Increment the number_of_messages count
        const currentCount = currentData.number_of_messages || 0;
        const { error: updateError } = await supabase
          .from('apps')
          .update({
            number_of_messages: currentCount + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', appData.id);

        if (updateError) {
          console.error('Error updating message count:', updateError);
          // Continue execution even if update fails - the message was sent successfully
        }
      }
    }

    // Return the full message data from v0 SDK
    return NextResponse.json({
      success: true,
      message: result,
      fullChatData: result
    });

  } catch (error: any) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}
