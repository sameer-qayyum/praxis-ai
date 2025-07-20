"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"

export function FeedbackButton() {
  const handleFeedbackClick = () => {
    // This would open a feedback form or modal
    console.log("Feedback button clicked")
    // For now, we'll just log it. Later you could implement a feedback modal
  }

  return (
    <Button 
      variant="ghost" 
      size="sm"
      onClick={handleFeedbackClick}
      className="font-medium"
    >
      Feedback
    </Button>
  )
}
