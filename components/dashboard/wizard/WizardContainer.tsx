'use client'
"use client"

import { ReactNode, useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Check } from "lucide-react"
import { WizardProgress } from "./WizardProgress"
import { ConnectGoogleSheets } from "./steps/ConnectGoogleSheets"
import { UploadForm } from "./steps/UploadForm"
import { ReviewFields } from "./steps/ReviewFields"

interface WizardContainerProps {
  title: string
  description: string
  templateId: string
}

export function WizardContainer({ title, description, templateId }: WizardContainerProps) {
  const [currentStep, setCurrentStep] = useState(1)
  
  // Define our wizard steps
  const steps = [
    {
      number: 1,
      title: "Connect Google Sheets",
      description: "Authorize access to your Google Sheets",
      status: currentStep === 1 ? "current" : currentStep > 1 ? "complete" : "upcoming"
    },
    {
      number: 2,
      title: "Upload Form",
      description: "Upload your PDF, Word, or Excel form",
      status: currentStep === 2 ? "current" : currentStep > 2 ? "complete" : "upcoming"
    },
    {
      number: 3,
      title: "Review Fields",
      description: "Customize the extracted form fields",
      status: currentStep === 3 ? "current" : currentStep > 3 ? "complete" : "upcoming"
    }
  ] as const
  
  // Calculate progress percentage
  const totalSteps = steps.length
  const progressPercentage = Math.round((currentStep / totalSteps) * 100)
  
  const goToNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }
  
  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }
  
  // Render the current step component
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <ConnectGoogleSheets />
      case 2:
        return <UploadForm />
      case 3:
        return <ReviewFields />
      default:
        return <div>Step not found</div>
    }
  }
  
  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-gray-600">{description}</p>
      </div>
      
      <WizardProgress 
        steps={steps as any} 
        currentStep={currentStep} 
        totalSteps={totalSteps}
        progressPercentage={progressPercentage}
      />
      
      <div className="mb-8">
        {renderStepContent()}
      </div>
      
      {/* Navigation buttons */}
      <div className="flex justify-between pt-6 border-t">
        <Button 
          variant="outline" 
          onClick={goToPreviousStep}
          disabled={currentStep === 1}
          className="flex items-center"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        
        {currentStep === totalSteps ? (
          <Button 
            onClick={() => console.log('Finished! App created successfully')}
            className="flex items-center bg-green-600 hover:bg-green-700"
          >
            Finish
            <Check className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button 
            onClick={goToNextStep}
            className="flex items-center"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}
