"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Brain } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface ThinkingSectionProps {
  content: string
}

export function ThinkingSection({ content }: ThinkingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Card className="border-l-4 border-l-blue-500 bg-blue-50/50">
      <CardContent className="p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-auto p-0 font-normal text-blue-700 hover:text-blue-800 hover:bg-transparent"
        >
          <Brain className="mr-2 h-4 w-4" />
          <span className="mr-2">Thinking</span>
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>

        {isExpanded && (
          <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap font-mono bg-white/50 p-3 rounded border">
            {content}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
