"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

interface GoogleSheetsContextType {
  isConnected: boolean
  isLoading: boolean
  checkConnectionStatus: () => Promise<boolean>
  refreshConnectionStatus: () => Promise<boolean>
}

const GoogleSheetsContext = createContext<GoogleSheetsContextType | undefined>(undefined)

export const useGoogleSheets = () => {
  const context = useContext(GoogleSheetsContext)
  if (context === undefined) {
    throw new Error("useGoogleSheets must be used within a GoogleSheetsProvider")
  }
  return context
}

interface GoogleSheetsProviderProps {
  children: ReactNode
}

export const GoogleSheetsProvider = ({ children }: GoogleSheetsProviderProps) => {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  const checkConnectionStatus = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc("has_valid_google_token")
      
      if (error) {
        console.error("Error checking Google Sheets connection:", error)
        setIsConnected(false)
        return false
      }
      
      setIsConnected(!!data)
      return !!data
    } catch (error) {
      console.error("Failed to check Google Sheets connection status:", error)
      setIsConnected(false)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const refreshConnectionStatus = async (): Promise<boolean> => {
    setIsLoading(true)
    return await checkConnectionStatus()
  }

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus()
  }, [])

  const value = {
    isConnected,
    isLoading,
    checkConnectionStatus,
    refreshConnectionStatus
  }

  return (
    <GoogleSheetsContext.Provider value={value}>
      {children}
    </GoogleSheetsContext.Provider>
  )
}
