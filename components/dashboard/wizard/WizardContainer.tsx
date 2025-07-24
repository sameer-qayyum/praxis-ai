"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Check } from "lucide-react"
import { WizardProgress } from "./WizardProgress"
import { ConnectGoogleSheets } from "./steps/ConnectGoogleSheets"
import { UploadForm } from "./steps/UploadForm"
import { ReviewFields } from "./steps/ReviewFields"
import { useGoogleSheets } from "@/context/GoogleSheetsContext"
import type { ColumnSyncResult } from "@/context/GoogleSheetsContext"
import { toast } from "sonner"

interface WizardContainerProps {
  title: string
  description: string
  templateId: string
}

export function WizardContainer({ title, description, templateId }: WizardContainerProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [initialCheckComplete, setInitialCheckComplete] = useState(false)
  const [selectedFieldsCount, setSelectedFieldsCount] = useState(0)
  const [fields, setFields] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [columnChanges, setColumnChanges] = useState<ColumnSyncResult | null>(null)
  const { isConnected, isLoading, checkConnectionStatus, selectedSheet, saveSheetConnection, writeSheetColumns } = useGoogleSheets()
  
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

  useEffect(() => {
    // When step changes, scroll to top
    window.scrollTo(0, 0)
  }, [currentStep])

  const handleFinish = async () => {    
    if (!selectedSheet?.id || selectedFieldsCount === 0) {
      console.log('❌ Validation failed:', { 
        hasSheetId: !!selectedSheet?.id, 
        selectedFieldsCount 
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Filter only included fields and format for storage
      
      const columnsMetadata = fields
        .filter(field => {
          const included = !!field.include;
          if (!included) console.log(`Field ${field.name} excluded`);
          return included;
        })
        .map(field => {
          // Create the field metadata object that will be saved to the database
          const fieldMeta = {
            id: field.id,
            name: field.name,
            type: field.type,
            description: field.description,
            options: field.options || []
          };
          
          return fieldMeta;
        });
        
      // Use sheet name as connection name
      const connectionName = selectedSheet.name;
      const connectionDescription = `App created from ${selectedSheet.name} sheet with ${columnsMetadata.length} fields`;
      // Database save with specific try/catch
      let dbSaveResult = false;
      try {
        dbSaveResult = await saveSheetConnection(
          connectionName,
          connectionDescription,
          columnsMetadata
        );
        
      } catch (dbError) {
        console.error('❌ saveSheetConnection error:', dbError);
      }
      
      // Sheet update with specific try/catch
      let sheetUpdateResult = false;
      try {
        sheetUpdateResult = await writeSheetColumns(
          selectedSheet.id,
          columnsMetadata
        );
      } catch (sheetError) {
        console.error('❌ writeSheetColumns error:', sheetError);
        console.error('❌ Error details:', JSON.stringify(sheetError));
      }
      
      // Report results
      if (dbSaveResult && sheetUpdateResult) {
        toast.success('App created successfully! Sheet and columns updated.');
        // You can add navigation to the created app here
      } else if (dbSaveResult) {
        toast.success('App created but sheet columns could not be updated.');
      } else if (sheetUpdateResult) {
        toast.warning('Sheet columns updated but app data could not be saved. Please try again.');
      } else {
        toast.error('Failed to create app. Please try again.');
      }
    } catch (error) {
      toast.error('An error occurred while creating the app');
    } finally {
      setIsSubmitting(false);
    }
  }

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
    
    // When connected to Google, we need special handling for steps
    if (isConnected) {
      // When on step 2 (Upload Form), we want to go to step 3 (Review Fields)
      if (currentStep === 2) {
        setCurrentStep(3)
        return
      }
    }
    
    // Standard next step logic
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
  const renderCurrentStep = () => {
    // Handle case when Google is connected (step 1 is skipped)
    if (isConnected) {
      switch (currentStep) {
        case 2:
          return <UploadForm onSheetColumnsChange={setColumnChanges} />
        case 3:
          return <ReviewFields 
            onFieldsChange={setSelectedFieldsCount} 
            onFieldsUpdate={setFields} 
            columnChanges={columnChanges}
          />
        default:
          return <div>Step not found</div>
      }
    } else {
      // Regular flow when Google is not connected yet
      switch (currentStep) {
        case 1:
          return <ConnectGoogleSheets />
        case 2:
          return <UploadForm onSheetColumnsChange={setColumnChanges} />
        case 3:
          return <ReviewFields 
            onFieldsChange={setSelectedFieldsCount} 
            onFieldsUpdate={setFields} 
            columnChanges={columnChanges}
          />
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
        {renderCurrentStep()}
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
            onClick={handleFinish} 
            className="flex items-center bg-green-600 hover:bg-green-700"
            // Finish button is disabled if selectedSheet isn't loaded or if fields count is 0
            disabled={!selectedSheet?.id || selectedFieldsCount === 0 || isSubmitting}
          >
            Finish
            <Check className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button 
            onClick={goToNextStep}
            className="flex items-center"
            // Disable Next button if we're on the UploadForm step and no sheet is selected
            disabled={currentStep === 2 && !selectedSheet?.id}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}
