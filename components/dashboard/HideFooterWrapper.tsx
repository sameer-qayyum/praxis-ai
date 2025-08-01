"use client"

import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

interface HideFooterWrapperProps {
  children: ReactNode
}

export function HideFooterWrapper({ children }: HideFooterWrapperProps) {
  const pathname = usePathname()
  
  // Check if current path is an app route
  const isAppRoute = pathname?.includes('/dashboard/app/')
  
  // Add a class to the body that can be used to hide the footer via CSS
  if (typeof document !== 'undefined') {
    if (isAppRoute) {
      document.body.classList.add('hide-dashboard-footer')
    } else {
      document.body.classList.remove('hide-dashboard-footer')
    }
  }
  
  return <>{children}</>
}
