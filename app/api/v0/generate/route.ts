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

    // Use the v0 SDK to create a new chat
    console.log('DEBUG - Making API request to V0 with message:');
    
    try {
      // Create a new chat with the v0 SDK
      const chat = await v0.chats.create({ message });
      
      if (chat.id) {
        // Store the chat and project reference in the database with the user ID to satisfy RLS
        console.log('Updating apps table with userId:', userId, 'appId:', appId);
        
        let appData, dbError;
        
        if (appId) {
          // If we have an appId, use direct update to modify the existing record
          console.log('Using direct update for existing app ID:', appId);
          
          const updateData = {
            chat_id: chat.id,
            status: 'generated',
            preview_url: chat.demo,
            updated_by: userId,
            updated_at: new Date().toISOString()
          };
          
          // Update the existing record
          const result = await supabase
            .from('apps')
            .update(updateData)
            .eq('id', appId)
            .select('id')
            .single();
            
          appData = result.data;
          dbError = result.error;
        } else {
          // For new apps, we need to insert a new record
          console.log('No appId provided, creating new app record');
          
          const insertData = {
            chat_id: chat.id,
            name: name || 'Praxis AI App',
            status: 'generated',
            preview_url: chat.demo,
            created_by: userId,
            updated_by: userId
          };
          
          // Insert a new record
          const result = await supabase
            .from('apps')
            .insert(insertData)
            .select('id')
            .single();
            
          appData = result.data;
          dbError = result.error;
        }
        
        if (dbError) {
          console.error('Error storing v0 project reference:', dbError);
          // Continue even if database storage fails
        }
        
        // Insert into app_versions table
        // Get version ID from latestVersion
        let versionId = null;
        let versionDemoUrl = chat.demo || null;
        
        if (chat.latestVersion) {
          versionId = chat.latestVersion.id || null;
          // Use latestVersion.demoUrl if available
          versionDemoUrl = chat.latestVersion.demoUrl || versionDemoUrl;
        }
        
        if (appData && versionId) {
          // Insert into app_versions table
          const { error: versionError } = await supabase
            .from('app_versions')
            .insert({
              app_id: appData.id,
              version_id: versionId,
              created_by: userId,
              version_demo_url: versionDemoUrl,
              version_number: 1 // First version
            });
          
          if (versionError) {
            console.error('Error storing version reference:', versionError);
            // Continue even if version storage fails
          }
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
