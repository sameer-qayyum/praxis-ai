"use client"

import { Sheet, Check, AlertCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { ConnectGoogleSheetsButton } from "@/components/shared/ConnectGoogleSheetsButton"
import { useGoogleSheets } from "@/context/GoogleSheetsContext"
import { useSearchParams } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function ConnectGoogleSheets() {
  const { isConnected, refreshConnectionStatus } = useGoogleSheets()
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null)
  const searchParams = useSearchParams()
  
  useEffect(() => {
    // Check for googleSheets status in URL parameters
    const status = searchParams.get('googleSheets')
    const msg = searchParams.get('message')
    
    if (status === 'success') {
      setMessageType('success')
      setMessage(msg || 'Google Sheets connected successfully')
      // Refresh connection status to update the UI
      refreshConnectionStatus()
    } else if (status === 'error') {
      setMessageType('error')
      setMessage(msg || 'Failed to connect Google Sheets')
    }
  }, [searchParams, refreshConnectionStatus])
  return (
    <div className="flex flex-col items-center">
      <div className="mb-6">
        <Sheet className="h-16 w-16 text-green-500" />
      </div>
      
      <h2 className="text-2xl font-semibold mb-4">Connect Google Sheets</h2>
      
      <p className="text-center text-gray-600 mb-8 max-w-md">
        Praxis uses Google Sheets as your database. We'll create a 
        new sheet or your specified sheet to store and read your data.
      </p>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 max-w-md w-full">
        <h3 className="text-lg font-medium text-blue-800 mb-3">What we'll do:</h3>
        <ul className="space-y-2 text-blue-700">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Create a new Google Sheet for your form data or use your specified sheet</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Set up automatic secure data syncing</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Configure read/write permissions</span>
          </li>
        </ul>
      </div>
      
      {messageType && message && (
        <Alert 
          className={`mb-6 max-w-md w-full ${messageType === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}
        >
          <div className="flex items-center">
            {messageType === 'success' ? 
              <Check className="h-4 w-4 mr-2" /> : 
              <AlertCircle className="h-4 w-4 mr-2" />}
            <AlertDescription>{message}</AlertDescription>
          </div>
        </Alert>
      )}
      
      {isConnected ? (
        <div className="flex flex-col items-center text-green-600">
          <div className="flex items-center mb-2">
            <Check className="h-5 w-5 mr-2" />
            <span className="font-medium">Connected to Google Sheets</span>
          </div>
          <p className="text-sm text-gray-500">You can now proceed to the next step</p>
        </div>
      ) : (
        <ConnectGoogleSheetsButton 
          className="w-full max-w-md" 
          onSuccess={() => refreshConnectionStatus()}
        />
      )}
    </div>
  )
}
