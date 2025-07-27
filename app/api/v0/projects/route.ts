import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/lib/supabase/server';
import { v0 } from 'v0-sdk';

/**
 * POST handler to create a new project and optionally assign a chat to it
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

    // Parse request body
    const { name, description, icon, chatId } = await request.json();

    // Validate parameters
    if (!name) {
      return NextResponse.json(
        { error: "Missing required parameter: name" },
        { status: 400 }
      );
    }

    // Create project payload
    const projectPayload: any = { name };
    
    // Add optional fields if provided
    if (description) projectPayload.description = description;
    if (icon) projectPayload.icon = icon;
    
    // Create project using v0 SDK
    const project = await v0.projects.create(projectPayload);
    
    // If chatId is provided, assign the project to the chat
    if (chatId && project.id) {
      // Assign chat to project
      await v0.projects.assign({
        projectId: project.id,
        chatId: chatId
      });
      
      // Update the apps table in Supabase to store the project_id
      const { data: appData, error: appError } = await supabase
        .from('apps')
        .select('id')
        .eq('chat_id', chatId)
        .single();
      
      if (appError) {
        console.error('Error finding app:', appError);
        // Continue execution even if app not found
      } else if (appData) {
        // Update the v0_project_id column with the new project ID
        const { error: updateError } = await supabase
          .from('apps')
          .update({
            v0_project_id: project.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', appData.id);
          
        if (updateError) {
          console.error('Error updating app with project ID:', updateError);
        }
      }
    }

    // Return the project data
    return NextResponse.json({
      success: true,
      project,
      assigned: chatId ? true : false
    });
    
  } catch (error: any) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create project' },
      { status: 500 }
    );
  }
}

/**
 * POST handler to assign an existing project to a chat
 * Endpoint format: /api/v0/projects/assign
 */
export async function PATCH(request: NextRequest) {
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

    // Parse request body
    const { projectId, chatId } = await request.json();

    // Validate parameters
    if (!projectId || !chatId) {
      return NextResponse.json(
        { error: "Missing required parameters: projectId or chatId" },
        { status: 400 }
      );
    }
    
    // Assign chat to project using v0 SDK
    const result = await v0.projects.assign({
      projectId,
      chatId
    });
    
    // Update the apps table in Supabase to store the project_id
    const { data: appData, error: appError } = await supabase
      .from('apps')
      .select('id')
      .eq('chat_id', chatId)
      .single();
    
    if (appError) {
      console.error('Error finding app:', appError);
      return NextResponse.json(
        { error: "Failed to find app with the specified chat ID" },
        { status: 404 }
      );
    }
    
    // Update the v0_project_id column with the project ID
    const { data: updateData, error: updateError } = await supabase
      .from('apps')
      .update({
        v0_project_id: projectId,
        updated_at: new Date().toISOString()
      })
      .eq('id', appData.id)
      .select();
      
    if (updateError) {
      console.error('Error updating app with project ID:', updateError);
      return NextResponse.json(
        { error: "Failed to update app with project ID" },
        { status: 500 }
      );
    }

    // Return the result
    return NextResponse.json({
      success: true,
      result,
      updated: true
    });
    
  } catch (error: any) {
    console.error('Error assigning project to chat:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to assign project to chat' },
      { status: 500 }
    );
  }
}
