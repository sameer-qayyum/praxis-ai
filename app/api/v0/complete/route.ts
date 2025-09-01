import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { chatId, demo, versionId, versionDemoUrl } = await request.json()
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    const userId = userData.user.id

    // Update the app with completed generation data
    const { data: appData, error: updateError } = await supabase
      .from('apps')
      .update({
        status: 'generated',
        preview_url: demo,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('chat_id', chatId)
      .select('id')
      .single()

    if (updateError) {
      console.error('Error updating app:', updateError)
      return NextResponse.json(
        { error: 'Failed to update app' },
        { status: 500 }
      )
    }

    // Insert version data if available
    if (appData && versionId) {
      const { error: versionError } = await supabase
        .from('app_versions')
        .insert({
          app_id: appData.id,
          version_id: versionId,
          created_by: userId,
          version_demo_url: versionDemoUrl || demo,
          version_number: 1 // First version
        })

      if (versionError) {
        console.error('Error storing version reference:', versionError)
        // Continue even if version storage fails
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'App generation completed successfully'
    })

  } catch (error: any) {
    console.error('Complete API error:', error)
    return NextResponse.json(
      { error: `Complete API Error: ${error.message || 'Unknown error'}` },
      { status: 500 }
    )
  }
}
