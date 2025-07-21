"use client"

import React from 'react'
import { GoogleSheetsProvider } from '@/context/GoogleSheetsContext'

export function GoogleSheetsClientProvider({
  children
}: {
  children: React.ReactNode
}) {
  return <GoogleSheetsProvider>{children}</GoogleSheetsProvider>
}
