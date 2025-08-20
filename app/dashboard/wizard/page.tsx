"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { WizardContainer } from "@/components/dashboard/wizard/WizardContainer"

function WizardContent() {
  const searchParams = useSearchParams()
  const isCustom = searchParams.get('custom') === 'true'
  const customPrompt = searchParams.get('prompt')
  const rawPromptId = searchParams.get('promptId')
  const templateId = searchParams.get('templateId')
  
  // Clean promptId - remove any extra URL parameters that got appended
  const promptId = rawPromptId ? rawPromptId.split('?')[0] : null

  if (isCustom && customPrompt) {
    const decodedPrompt = decodeURIComponent(customPrompt)
    console.log('🔧 [WIZARD] Loading custom app wizard:', {
      decodedPromptLength: decodedPrompt.length,
      decodedPromptPreview: decodedPrompt.substring(0, 100) + (decodedPrompt.length > 100 ? '...' : ''),
      promptId: promptId,
      hasPromptId: !!promptId
    })
    
    return (
      <WizardContainer
        title="Build Custom App"
        description="Configure your custom application with Google Sheets integration"
        customPrompt={decodedPrompt}
        customPromptId={promptId}
        isCustomApp={true}
      />
    )
  }

  if (templateId) {
    
    return (
      <WizardContainer
        title="Use Template"
        description="Set up your template-based application"
        templateId={templateId}
        isCustomApp={false}
      />
    )
  }

  // Fallback - redirect to dashboard
  return (
    <div className="p-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">Invalid Wizard Configuration</h2>
        <p className="text-gray-600 mb-6">Please start from the dashboard to create an app.</p>
        <a href="/dashboard" className="text-blue-600 hover:underline">
          Return to Dashboard
        </a>
      </div>
    </div>
  )
}

export default function WizardPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading wizard...</div>}>
      <WizardContent />
    </Suspense>
  )
}
