'use client'
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Check } from "lucide-react"
import { WizardProgress } from "./WizardProgress"
import { ConnectGoogleSheets } from "./steps/ConnectGoogleSheets"
import { UploadForm } from "./steps/UploadForm"
import { ReviewFields } from "./steps/ReviewFields"
import { useGoogleSheets } from "@/context/GoogleSheetsContext"

interface WizardContainerProps {
  title: string
  description: string
  templateId: string
}

export function WizardContainer({ title, description, templateId }: WizardContainerProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [initialCheckComplete, setInitialCheckComplete] = useState(false)
  const { isConnected, isLoading, checkConnectionStatus } = useGoogleSheets()
  
  // Check Google token validity on mount and skip to step 2 if valid
  useEffect(() => {
    const checkGoogleConnection = async () => {
      const hasValidToken = await checkConnectionStatus()
      if (hasValidToken) {
        // If we have a valid token, skip straight to step 2
        setCurrentStep(2)
      }
      setInitialCheckComplete(true)
    }
    
    checkGoogleConnection()
  }, [checkConnectionStatus])
  
  // Define our wizard steps based on whether we have a valid token
  const allSteps = [
    {
      number: 1,
      id: "connect-google-sheets",
      title: "Connect Google Sheets",
      description: "Authorize access to your Google Sheets",
      status: currentStep === 1 ? "current" : currentStep > 1 ? "complete" : "upcoming"
    },
    {
      number: isConnected ? 1 : 2, // Adjust number based on Google Sheets connection
      id: "upload-form",
      title: "Upload Form",
      description: "Upload your PDF, Word, or Excel form",
      status: currentStep === 2 ? "current" : currentStep > 2 ? "complete" : "upcoming"
    },
    {
      number: isConnected ? 2 : 3, // Adjust number based on Google Sheets connection
      id: "review-fields",
      title: "Review Fields",
      description: "Customize the extracted form fields",
      status: currentStep === 3 ? "current" : currentStep > 3 ? "complete" : "upcoming"
    }
  ] as const
  
  // Filter steps if connected to Google
  const steps = isConnected ? allSteps.filter(step => step.id !== "connect-google-sheets") : allSteps
  
  // Calculate progress percentage
  const totalSteps = steps.length
  
  // Calculate the effective step number for progress display when Google is connected
  // If Google is connected and we're on step 2, we're actually on step 1 of 2 steps
  // If Google is connected and we're on step 3, we're actually on step 2 of 2 steps
  const effectiveStepNumber = isConnected ? currentStep - 1 : currentStep
  const progressPercentage = Math.round((effectiveStepNumber / totalSteps) * 100)
  
  const goToNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }
  
  const goToPreviousStep = () => {
    // When connected to Google, the minimum step is 2
    const minStep = isConnected ? 2 : 1
    if (currentStep > minStep) {
      setCurrentStep(currentStep - 1)
    }
  }
  
  // Render the current step component
  const renderStepContent = () => {
    // Handle case when Google is connected (step 1 is skipped)
    if (isConnected) {
      switch (currentStep) {
        case 2:
          return <UploadForm />
        case 3:
          return <ReviewFields />
        default:
          return <div>Step not found</div>
      }
    } else {
      // Regular flow when Google is not connected yet
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
  }
  
  // Show loading state while checking token validity
  if (!initialCheckComplete || isLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2 text-gray-600">Checking Google Sheets connection...</p>
        </div>
      </div>
    )
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
          disabled={isConnected ? currentStep === 2 : currentStep === 1}
          className="flex items-center"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        
        {/* Show finish button only on the last step (Review Fields), not on intermediate steps */}
        {(isConnected && currentStep === 3) || (!isConnected && currentStep === 3) ? (
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
