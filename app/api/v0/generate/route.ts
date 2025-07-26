import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/lib/supabase/server';
import { v0 } from "v0-sdk";

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
    const { message, name, userId, templateId } = body;
    
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

    // Use the v0 SDK to create a new chat
    console.log('DEBUG - Making API request to V0 with message:', message);
    
    try {
      // Create a new chat with the v0 SDK
      const chat = await v0.chats.create({ message });
      
      if (chat.id && chat.projectId) {
        // Store the chat and project reference in the database with the user ID to satisfy RLS
        const { error: dbError } = await supabase
          .from('apps')
          .insert({
            chat_id: chat.id,
            v0_project_id: chat.projectId,
            name: name || 'V0 Generated App',
            created_by: userId,
            status: 'generated',
            template_id: templateId,
            preview_url:chat.demo
          });
        
        if (dbError) {
          console.error('Error storing v0 project reference:', dbError);
          // Continue even if database storage fails
        }
      }
    
      // Extract file information safely from the SDK response
      const files: FileMapping[] = [];
      
      if (chat.files && Array.isArray(chat.files)) {
        chat.files.forEach((file: any) => {
          // Handle different file structures that might come from v0
          // Cast to our helper type to safely access properties
          const v0File = file as V0File;
          
          // Try multiple possible path locations in the file object
          const fileName = v0File.name || 
                         (v0File.meta && v0File.meta.file) || 
                         '';
                         
          if (fileName) {
            files.push({
              path: fileName,
              language: getLanguageFromPath(fileName)
            });
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

// Helper function to get language from file path
function getLanguageFromPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'js': return 'javascript';
    case 'jsx': return 'javascript';
    case 'ts': return 'typescript';
    case 'tsx': return 'typescript';
    case 'css': return 'css';
    case 'scss': return 'scss';
    case 'html': return 'html';
    case 'json': return 'json';
    case 'md': return 'markdown';
    default: return extension || 'plaintext';
  }
}
