"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, Sheet } from "lucide-react"
import { useGoogleSheets } from "@/context/GoogleSheetsContext"
import { useRouter } from "next/navigation"

interface ConnectGoogleSheetsButtonProps {
  onSuccess?: () => void
  className?: string
  variant?: "default" | "outline" | "secondary"
  size?: "default" | "sm" | "lg"
  children?: React.ReactNode
}

export function ConnectGoogleSheetsButton({
  onSuccess,
  className = "",
  variant = "default",
  size = "default",
  children
}: ConnectGoogleSheetsButtonProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false)
  const { isConnected, refreshConnectionStatus } = useGoogleSheets()
  const router = useRouter()

  // Start the OAuth flow
  const startGoogleAuth = async () => {
    setIsLoading(true)
    
    try {
      // Get a secure state parameter from our API
      const stateResponse = await fetch('/api/auth/google-sheets-state')
      const { state } = await stateResponse.json()
      
      if (!state) {
        throw new Error('Failed to generate secure state parameter')
      }
      
      // Save a callback path in session storage to return to this page
      sessionStorage.setItem('googleSheetsReturnPath', window.location.pathname)
      
      // Get the current URL for the redirect_uri
      const redirectUri = `${window.location.origin}/api/auth/google-sheets-callback`
      
      // Define the scopes we need
      const scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',     // Keep this for file creation
        'https://www.googleapis.com/auth/drive.readonly'  // Add this for listing all files
      ].join(' ')
      
      // Build the authorization URL
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      authUrl.searchParams.append('client_id', process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '')
      authUrl.searchParams.append('redirect_uri', redirectUri)
      authUrl.searchParams.append('response_type', 'code')
      authUrl.searchParams.append('scope', scopes)
      authUrl.searchParams.append('access_type', 'offline')
      authUrl.searchParams.append('prompt', 'consent') // Force consent to get refresh token
      authUrl.searchParams.append('state', state)
      
      // Redirect to Google's OAuth page
      window.location.href = authUrl.toString()
      
      // Add listener for focus event to check auth status on return
      const onFocusHandler = async () => {
        try {
          const isNowConnected = await refreshConnectionStatus()
          if (isNowConnected && onSuccess) {
            onSuccess()
          }
        } catch (err) {
          console.error('Failed to check Google auth status on return:', err)
        } finally {
          setIsLoading(false)
          window.removeEventListener('focus', onFocusHandler)
        }
      }
      
      window.addEventListener('focus', onFocusHandler)
      
      // Clean up the focus event listener after 2 minutes
      setTimeout(() => {
        window.removeEventListener('focus', onFocusHandler)
      }, 120000) // 2 minutes
    } catch (error) {
      console.error('Error starting Google OAuth flow:', error)
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={startGoogleAuth}
      disabled={isLoading || isConnected}
    >
      {isLoading ? (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </span>
      ) : isConnected ? (
        <span className="flex items-center">
          <Check className="mr-2 h-4 w-4" />
          {children || "Google Sheets Connected"}
        </span>
      ) : (
        <span className="flex items-center">
          <Sheet className="mr-2 h-4 w-4" />
          {children || "Connect Google Sheets"}
        </span>
      )}
    </Button>
  )
}
