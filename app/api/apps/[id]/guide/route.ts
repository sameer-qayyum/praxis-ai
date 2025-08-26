import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // Get the app ID from the URL params
    const appId = params.id
    
    if (!appId) {
      return NextResponse.json(
        { error: 'App ID is required' },
        { status: 400 }
      )
    }

    // Fetch app guide data from database
    const { data: app, error } = await supabase
      .from('apps')
      .select('guide, name')
      .eq('id', appId)
      .single()

    if (error) {
      console.error('Error fetching app:', error)
      return NextResponse.json(
        { error: 'App not found' },
        { status: 404 }
      )
    }

    if (!app) {
      return NextResponse.json(
        { error: 'App not found' },
        { status: 404 }
      )
    }

    // Parse guide JSON if it exists
    if (app.guide) {
      try {
        const guideData = JSON.parse(app.guide)
        return NextResponse.json(guideData)
      } catch (parseError) {
        console.error('Error parsing guide JSON:', parseError)
        return NextResponse.json(
          { error: 'Invalid guide format' },
          { status: 500 }
        )
      }
    }

    // Return null if no guide exists
    return NextResponse.json(null)

  } catch (error) {
    console.error('Error in apps guide GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // Get the app ID from the URL params
    const appId = params.id
    
    if (!appId) {
      return NextResponse.json(
        { error: 'App ID is required' },
        { status: 400 }
      )
    }

    // Get the guide content from request body
    const { guide } = await request.json()
    
    if (!guide || typeof guide !== 'string') {
      return NextResponse.json(
        { error: 'Guide content is required and must be a string' },
        { status: 400 }
      )
    }

    // Validate JSON format
    let parsedGuide
    try {
      parsedGuide = JSON.parse(guide)
      
      // Basic validation of required fields
      if (!parsedGuide.title || !parsedGuide.description) {
        return NextResponse.json(
          { error: 'Guide must contain title and description fields' },
          { status: 400 }
        )
      }
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Guide content must be valid JSON' },
        { status: 400 }
      )
    }

    // Update the app with the new guide
    const { data: updatedApp, error } = await supabase
      .from('apps')
      .update({ guide })
      .eq('id', appId)
      .select('guide, name')
      .single()

    if (error) {
      console.error('Error updating app guide:', error)
      return NextResponse.json(
        { error: 'Failed to save guide' },
        { status: 500 }
      )
    }

    // Return the parsed guide data
    return NextResponse.json(parsedGuide)

  } catch (error) {
    console.error('Error in apps guide POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
