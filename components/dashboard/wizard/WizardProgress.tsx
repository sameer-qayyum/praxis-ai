import { Check } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface Step {
  number: number
  title: string
  description: string
  status: "upcoming" | "current" | "complete"
}

interface WizardProgressProps {
  steps: Step[]
  currentStep: number
  totalSteps: number
  progressPercentage: number
}

export function WizardProgress({ steps, currentStep, totalSteps, progressPercentage }: WizardProgressProps) {
  return (
    <div className="mb-8 w-full">
      <div className="flex justify-between items-center mb-2">
        <p className="text-sm font-medium">Step {currentStep} of {totalSteps}</p>
        <p className="text-sm font-medium">{progressPercentage}% complete</p>
      </div>
      
      {/* Progress bar using Shadcn UI Progress component */}
      <div className="mb-6">
        <Progress value={progressPercentage} className="h-2" />
      </div>
      
      {/* Step indicators */}
      <div className="flex justify-between items-start">
        {steps.map((step) => (
          <div key={step.number} className="flex-1 flex items-start">
            <div className="flex flex-col items-center mr-4">
              {step.status === "complete" ? (
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">
                  <Check className="h-5 w-5" />
                </div>
              ) : (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step.status === "current" ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
                }`}>
                  {step.number}
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className={`font-medium text-sm ${
                step.status === "upcoming" ? "text-gray-500" : "text-gray-900"
              }`}>
                {step.title}
              </p>
              <p className="text-xs text-gray-500">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
