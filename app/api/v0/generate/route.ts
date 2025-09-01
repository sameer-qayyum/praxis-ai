import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/lib/supabase/server';

// Type for file mapping to handle v0 SDK types safely
type FileMapping = {
  path: string;
  language: string;
};

// Helper type for v0 files which might have different structures
type V0File = {
  meta?: { file?: string };
  name?: string;
  lang?: string;
  source?: string;
  content?: string;
};

export async function POST(request: NextRequest) {
  try {
    // For API routes using App Router, we need to access the Supabase DB directly 
    // without cookie handling since we don't need to maintain a session
    const supabase = await createClient();
    
    // Get the API key from environment variables
    const apiKey = process.env.V0_API_KEY || process.env.NEXT_PUBLIC_V0_API_KEY;
    
    if (!apiKey) {
      console.error('No V0 API key found in environment variables');
      return NextResponse.json({ error: 'V0_API_KEY not configured on the server' }, { status: 500 });
    }

    // Parse request body
    const body = await request.json();
    const { message, name, userId, templateId, appId } = body;
    
    // Make sure we have a userId to satisfy RLS policies
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Configure the v0 SDK with API key
    // The v0-sdk is already initialized upon import, we just need to use it
    // Validate
    if (!message) {
      return NextResponse.json(
        { error: "No message provided" },
        { status: 400 }
      );
    }
    
    try {
      // Create a new chat with the v0 SDK using enhanced parameters
      const response = await fetch('https://api.v0.dev/v1/chats', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          system: "You are building a web application using React, Next.js, and Tailwind CSS. Focus on creating clean, modern, and responsive designs with excellent user experience.",
          message,
          modelConfiguration: {
            modelId: "v0-1.5-md",
            thinking: true,
            imageGenerations: false,
          },
          responseMode: "async", // This ensures immediate response
        })
      });

      if (!response.ok) {
        throw new Error(`V0 API error: ${response.status} ${response.statusText}`);
      }
  
      const chat = await response.json();
      // Ensure we have a chat ID; otherwise return an error
      if (!chat.id) {
        return NextResponse.json(
          { error: 'V0 chat did not return an id' },
          { status: 502 }
        );
      }

      // Update the app record with chat_id and generating status
      const updateData = {
        chat_id: chat.id,
        status: 'generating', // Set to generating, not generated
        updated_by: userId,
        updated_at: new Date().toISOString()
      };

      const { error: dbError } = await supabase
        .from('apps')
        .update(updateData)
        .eq('id', appId);

      if (dbError) {
        console.error('Error updating app with chat_id:', dbError);
        throw dbError;
      }

      // Extract file information safely from the SDK response
      const files: FileMapping[] = [];

      if (chat.files && Array.isArray(chat.files)) {
        chat.files.forEach((file: any) => {
          // Handle different file structures that might come from v0
          const v0File = file as V0File;

          // Try multiple possible path locations in the file object
          const path = v0File.name || (v0File.meta && v0File.meta.file) || '';

          // Determine language if possible, fall back to empty string
          const language = v0File.lang || '';

          if (path) {
            files.push({ path, language });
          }
        });
      }

      // Return the response data including chat ID, project ID, and files
      return NextResponse.json({ 
        success: true, 
        chatId: chat.id,
        projectId: chat.projectId,
        demo: chat.demo,
        files: files,
        messages: chat.messages || []
      });
    
    } catch (sdkError: any) {
      console.error('DEBUG - V0 SDK Error:', sdkError);
      return NextResponse.json(
        { error: `V0 SDK Error: ${sdkError.message || 'Unknown SDK error'}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error calling v0 API:", error);
    return NextResponse.json(
      { 
        error: error.message || "An error occurred"
      },
      { status: 500 }
    );
  }
}

