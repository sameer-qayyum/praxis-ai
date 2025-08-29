import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/lib/supabase/server';
import { v0 } from "v0-sdk";
import { waitUntil } from '@vercel/functions';

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
    
    // Validate
    if (!message) {
      return NextResponse.json(
        { error: "No message provided" },
        { status: 400 }
      );
    }

    // Create or update app record with 'generating' status
    let currentAppId = appId;
    
    if (appId) {
      // Update existing app to generating status
      await supabase
        .from('apps')
        .update({
          status: 'generating',
          updated_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', appId);
    } else {
      // Create new app with generating status
      const { data: newApp } = await supabase
        .from('apps')
        .insert({
          name: name || 'Praxis AI App',
          status: 'generating',
          created_by: userId,
          updated_by: userId
        })
        .select('id')
        .single();
      
      currentAppId = newApp?.id;
    }

    // Start V0 generation in background
    waitUntil(processV0Generation(message, name, userId, templateId, currentAppId));

    // Return immediately with generating status
    return NextResponse.json({
      success: true,
      appId: currentAppId,
      status: 'generating',
      message: 'Generation started. This may take several minutes.'
    });
  } catch (error: any) {
    console.error("Error in generate route:", error);
    return NextResponse.json(
      { 
        error: error.message || "An error occurred"
      },
      { status: 500 }
    );
  }
}

// Background function to process V0 generation
async function processV0Generation(
  message: string, 
  name: string, 
  userId: string, 
  templateId: string, 
  appId: string
) {
  const supabase = await createClient();
  
  try {
    // Create a new chat with the v0 SDK using enhanced parameters
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
    
    if (chat.id) {
      // Update the app record with generated status and chat data
      const updateData = {
        chat_id: chat.id,
        status: 'generated',
        preview_url: chat.demo,
        updated_by: userId,
        updated_at: new Date().toISOString()
      };
      
      const { data: appData, error: dbError } = await supabase
        .from('apps')
        .update(updateData)
        .eq('id', appId)
        .select('id')
        .single();
        
      if (dbError) {
        console.error('Error updating app with generated data:', dbError);
        throw dbError;
      }
      
      // Insert into app_versions table
      let versionId = null;
      let versionDemoUrl = chat.demo || null;
      
      if (chat.latestVersion) {
        versionId = chat.latestVersion.id || null;
        versionDemoUrl = chat.latestVersion.demoUrl || versionDemoUrl;
      }
      
      if (appData && versionId) {
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
        }
      }
    }
    
  } catch (error: any) {
    console.error('Error in V0 generation:', error);
    
    // Update app status to failed
    await supabase
      .from('apps')
      .update({
        status: 'failed',
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', appId);
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