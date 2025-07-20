"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface TemplateButtonProps {
  templateId: string
  variant?: "default" | "outline"
  size?: "default" | "sm"
  className?: string
  icon?: boolean
  children: React.ReactNode
}

export function TemplateButton({ 
  templateId, 
  variant = "default", 
  size = "default", 
  className = "",
  icon = true,
  children
}: TemplateButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleClick = () => {
    setIsLoading(true)
    router.push(`/dashboard/wizard/create/${templateId}`)
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading...
        </>
      ) : (
        <>
          {children}
          {icon && <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />}
        </>
      )}
    </Button>
  )
}
