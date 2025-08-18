"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Brain, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ThinkingSectionProps {
  content: string
}

export function ThinkingSection({ content }: ThinkingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div className="border-l-4 border-l-blue-500 bg-blue-50/50">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="h-auto p-2 font-normal text-blue-700 hover:text-blue-800 hover:bg-transparent w-full justify-start"
      >
        {isHovered ? (
          <ArrowRight className="mr-2 h-4 w-4" />
        ) : (
          <Brain className="mr-2 h-4 w-4" />
        )}
        <span className="mr-2">Planned</span>
       
      </Button>

      {isExpanded && (
        <div className="px-2 pb-2 text-sm text-gray-700 whitespace-pre-wrap font-mono bg-white/50 rounded border mx-2 mb-2">
          <div className="p-3">
            {content}
          </div>
        </div>
      )}
    </div>
  )
}
