import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // Get the template ID from the URL params
    const templateId = params.id
    
    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Fetch template guide data from database
    const { data: template, error } = await supabase
      .from('templates')
      .select('guide, title')
      .eq('id', templateId)
      .single()

    if (error) {
      console.error('Error fetching template:', error)
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Parse guide JSON if it exists
    let guideData = null
    if (template.guide) {
      try {
        guideData = JSON.parse(template.guide)
      } catch (parseError) {
        console.error('Error parsing guide JSON:', parseError)
        // Return a default structure if JSON is invalid
        guideData = {
          title: `${template.title} Guide`,
          description: "Guide content is not properly formatted.",
          features: [],
          sheetSetup: {
            title: "Setup Instructions",
            instructions: []
          },
          examples: {
            title: "Examples",
            items: []
          }
        }
      }
    } else {
      // Return default guide structure if no guide content exists
      guideData = {
        title: `${template.title} Guide`,
        description: "This template doesn't have a guide configured yet.",
        features: [
          "Template-based app functionality",
          "Google Sheets integration",
          "Responsive design"
        ],
        sheetSetup: {
          title: "Google Sheet Setup",
          instructions: [
            "Configure your Google Sheet according to template requirements",
            "Ensure proper column headers",
            "Add your data in the appropriate format"
          ]
        },
        examples: {
          title: "Getting Started",
          items: [
            "Connect your Google Sheet",
            "Configure the required fields",
            "Test the app functionality"
          ]
        }
      }
    }

    return NextResponse.json(guideData)

  } catch (error) {
    console.error('Error in templates guide API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
