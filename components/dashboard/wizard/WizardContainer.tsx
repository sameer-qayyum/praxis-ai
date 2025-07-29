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
import { createClient } from "@/lib/supabase/client"

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
  const [isCheckingColumns, setIsCheckingColumns] = useState(false)
  const [columnChanges, setColumnChanges] = useState<ColumnSyncResult | null>(null)
  const { isConnected, isLoading, checkConnectionStatus, selectedSheet, saveSheetConnection, writeSheetColumns } = useGoogleSheets()
  const supabase = createClient()
  
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
      toast.error('Please select a sheet and at least one field');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Store all fields with an active flag to preserve sheet structure
      const columnsMetadata = fields.map((field, index) => {
        // Create the field metadata object that will be saved to the database
        const fieldMeta = {
          id: field.id,
          name: field.name,
          type: field.type,
          description: field.description,
          options: field.options || [],
          active: !!field.include, // Track inclusion state with an active flag
          originalIndex: field.originalIndex || index // Store original position if available, otherwise use current index
        };
        
        return fieldMeta;
      });
      
      // Also create a filtered version for app generation purposes
      const activeColumnsMetadata = columnsMetadata.filter(field => field.active);
        
      // Use sheet name as connection name
      const connectionName = selectedSheet.name;
      const connectionDescription = `App created from ${selectedSheet.name} sheet with ${activeColumnsMetadata.length} active fields out of ${columnsMetadata.length} total`;
      
      // 1. Save the Google Sheet connection to get the connection ID
      const sheetConnectionResult = await saveSheetConnection(
        connectionName,
        connectionDescription,
        columnsMetadata
      );
      
      if (!sheetConnectionResult) {
        throw new Error('Failed to save Google Sheet connection');
      }
      
      // Get the connection ID from the database
      const { data: connectionData } = await supabase
        .from('google_sheets_connections')
        .select('id')
        .eq('sheet_id', selectedSheet.id)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();
      
      if (!connectionData?.id) {
        throw new Error('Failed to retrieve Google Sheet connection ID');
      }
      
      // 2. Update sheet columns in the actual Google Sheet
      const sheetUpdateResult = await writeSheetColumns(
        selectedSheet.id,
        columnsMetadata
      );
      
      if (!sheetUpdateResult) {
        toast.warning('Sheet columns could not be updated, but continuing with app creation');
      }
      
      // 3. Get the template's base prompt and build the complete prompt
      const { data: templateData, error: templateError } = await supabase
        .from('templates')
        .select('base_prompt')
        .eq('id', templateId)
        .single();
      
      if (templateError || !templateData?.base_prompt) {
        toast.warning('Could not find template prompt, using default prompt');
      }
      
      const appName = `${connectionName} App`;
      
      // Format all fields and their metadata for the prompt
      // First, sort fields by their original index to maintain sheet structure
      const sortedFields = [...columnsMetadata].sort((a, b) => a.originalIndex - b.originalIndex);
      
      // Create a detailed metadata description for v0
      const fieldsMetadataJson = JSON.stringify(sortedFields, null, 2);
      
      // Create a more human-readable version focused on active fields
      const activeFieldsText = activeColumnsMetadata
        .map(field => `${field.name} (${field.type})${field.description ? ': ' + field.description : ''}${field.options?.length > 0 ? ' | Options: ' + field.options.join(', ') : ''}`)
        .join('\n');
      
      // Use template base_prompt if available, otherwise use a default
      const basePrompt = templateData?.base_prompt || `Create a responsive Next.js app for a ${title}`;
      
      // Create a complete prompt with clear instructions about the metadata
      const promptBase = `${basePrompt}\n\n
      ACTIVE FIELDS (TO BE DISPLAYED IN THE UI):\n${activeFieldsText}\n\n
      COMPLETE SHEET STRUCTURE (INCLUDING ALL FIELDS):\n
      This is the complete structure of the Google Sheet with all fields in their original order. For each field:\n
      - id: Unique identifier for the column\n
      - name: Column name as shown in the sheet\n
      - type: Data type (Text, Number, Date, etc.)\n
      - active: If true, this field should be used in the UI and API. If false, maintain the field in the sheet structure but don't display it.\n
      - options: For fields that have predefined options (like dropdowns)\n
      - description: Additional information about the field\n
      - originalIndex: The position of the column in the sheet (0-based)\n\n
      ${fieldsMetadataJson}\n\n
      When saving data back to the sheet, ensure all columns are maintained in their original order, even inactive ones (set inactive values to empty string or null).`;
      
      // Get the current user's ID for RLS policy compliance
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      // 4. Create a minimal app record in the database (without chat_id yet)
      const { data: appData, error: appError } = await supabase
        .from('apps')
        .insert({
          name: appName, 
          template_id: templateId,
          created_by: userId,
          status: 'pending', // Mark as pending generation
          // Store the sheet name and specific prompt details in metadata columns
          google_sheet: connectionData.id,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          number_of_messages: 1
          
        })
        .select('id') // Get the created app's ID
        .single();

      if (appError) {
        throw appError;
      }

      // Clear the loading toast and show success
      toast.dismiss();
      toast.success("App setup initiated! Generating your app...");
      
      // Redirect to the app page, which will handle the generation
      // In WizardContainer.tsx, at the end of handleFinish:
      setTimeout(() => {
        window.location.href = `/dashboard/app/${appData.id}`;
      }, 1000); // 1 second delay
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
          return <UploadForm
            onSheetColumnsChange={setColumnChanges}
            onColumnCheckStateChange={setIsCheckingColumns}
          />
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
          return <UploadForm
            onSheetColumnsChange={setColumnChanges}
            onColumnCheckStateChange={setIsCheckingColumns}
          />
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
            // Also disable if we're currently checking columns
            disabled={(currentStep === 2 && !selectedSheet?.id) || isCheckingColumns}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}
