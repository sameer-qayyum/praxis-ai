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

// Background function to initiate V0 generation
async function processV0Generation(
  message: string, 
  name: string, 
  userId: string, 
  templateId: string, 
  appId: string
) {
  const supabase = await createClient();
  
  try {
    // Get the API key from environment variables
    const apiKey = process.env.V0_API_KEY || process.env.NEXT_PUBLIC_V0_API_KEY;
    
    if (!apiKey) {
      throw new Error('V0_API_KEY not configured');
    }

    // Create a new chat with direct API call to V0 (async mode)
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
    
    if (chat.id) {
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
      
      console.log(`✅ V0 generation initiated for app ${appId}, chat_id: ${chat.id}`);
    }
    
  } catch (error: any) {
    console.error('Error initiating V0 generation:', error);
    
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