import { createClient } from "@/lib/supabase/server"
import { WizardContainer } from "@/components/dashboard/wizard/WizardContainer"
import { Metadata } from "next"
import { notFound } from "next/navigation"

// Force dynamic rendering for this page since it uses dynamic route params
export const dynamic = 'force-dynamic'

interface PageProps {
  params: {
    id: string
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  
  // Get template info from database
  const { data: template } = await supabase
    .from('templates')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!template) {
    return {
      title: 'Template Not Found'
    }
  }

  return {
    title: `Create ${template.title} | Praxis AI`,
    description: template.description,
  }
}

export default async function CreateWizardPage({ params }: PageProps) {
  const { id } = params
  const supabase = await createClient()
  
  // Verify authentication
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    // Handle unauthenticated users - Next.js will handle redirect in middleware
    return null
  }
  
  // Get template details
  const { data: template, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error || !template) {
    return notFound()
  }
  
  // Track template usage
  const { error: usageError } = await supabase
    .rpc('increment_template_app_count', { template_id: id })
  
  if (usageError) {
    console.error('Error incrementing template usage count:', usageError)
  }
  
  return (
    <div className="p-8">
      <WizardContainer 
        title={template.title} 
        description={template.description} 
        templateId={template.id} 
      />
    </div>
  )
}