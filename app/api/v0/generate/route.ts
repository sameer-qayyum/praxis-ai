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
    
    try {
      // Since V0 doesn't support true async, we'll use a fire-and-forget approach
      // Start the generation in the background and return immediately
      
      // First, create a placeholder app record to get an ID for tracking
      const placeholderData = {
        name: name || 'Praxis AI App',
        status: 'generating',
        preview_url: null,
        created_by: userId,
        updated_by: userId,
        template_id: templateId || null,
        user_prompt: templateId ? null : message // Store user prompt for custom apps
      };

      let appData;
      if (appId) {
        // Update existing app
        const result = await supabase
          .from('apps')
          .update({
            status: 'generating',
            preview_url: null,
            updated_by: userId,
            updated_at: new Date().toISOString()
          })
          .eq('id', appId)
          .select('id')
          .single();
        appData = result.data;
      } else {
        // Create new app
        const result = await supabase
          .from('apps')
          .insert(placeholderData)
          .select('id')
          .single();
        appData = result.data;
      }

      if (!appData) {
        throw new Error('Failed to create app record');
      }

      // Start V0 generation in background (fire and forget)
      // We'll use setTimeout to avoid blocking the response
      setTimeout(async () => {
        try {
          console.log(`🚀 Starting background V0 generation for app ${appData.id}`);
          
          const chat = await v0.chats.create({ 
            message,
            system: "You are building a web application using React, Next.js, and Tailwind CSS. Focus on creating clean, modern, and responsive designs with excellent user experience.",
            chatPrivacy: "private",
            modelConfiguration: {
              modelId: "v0-1.5-md", // Use the largest model for better results
              thinking: true, // Enable thinking for better reasoning
              imageGenerations: false
            }
          });
          
          console.log(`✅ V0 generation completed for app ${appData.id}, chat: ${chat.id}`);
          
          // Update the app with completed data
          await supabase
            .from('apps')
            .update({
              chat_id: chat.id,
              status: 'generated',
              preview_url: chat.demo,
              updated_by: userId,
              updated_at: new Date().toISOString()
            })
            .eq('id', appData.id);

          // Store version data if available
          if (chat.latestVersion) {
            await supabase
              .from('app_versions')
              .insert({
                app_id: appData.id,
                version_id: chat.latestVersion.id,
                created_by: userId,
                version_demo_url: chat.latestVersion.demoUrl || chat.demo,
                version_number: 1
              });
          }

        } catch (error) {
          console.error(`❌ Background V0 generation failed for app ${appData.id}:`, error);
          
          // Update app status to failed
          await supabase
            .from('apps')
            .update({
              status: 'failed',
              updated_by: userId,
              updated_at: new Date().toISOString()
            })
            .eq('id', appData.id);
        }
      }, 100); // Start after 100ms to ensure response is sent first

      // Return immediately with app ID for frontend polling
      return NextResponse.json({ 
        success: true, 
        appId: appData.id,
        status: 'generating',
        message: 'Generation started in background. Check app status for completion.'
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
