"use client"

import { usePathname } from 'next/navigation'
import { ReactNode, useEffect } from 'react'

interface HideFooterWrapperProps {
  children: ReactNode
}

export function HideFooterWrapper({ children }: HideFooterWrapperProps) {
  const pathname = usePathname()

  useEffect(() => {
    const isAppRoute = pathname?.includes('/dashboard/app/')
    if (typeof document !== 'undefined') {
      // Toggle footer hide class
      document.body.classList.toggle('hide-dashboard-footer', !!isAppRoute)
      // Toggle app-route class for route-specific styling (e.g., scroll behavior)
      document.body.classList.toggle('app-route', !!isAppRoute)
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('hide-dashboard-footer')
        document.body.classList.remove('app-route')
      }
    }
  }, [pathname])

  return <>{children}</>
}
