"use client"

import { useState, useEffect } from "react"

interface TypewriterEffectProps {
  text: string
  speed?: number
  className?: string
}

export function TypewriterEffect({ text, speed = 100, className = "" }: TypewriterEffectProps) {
  const [displayText, setDisplayText] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, speed)

      return () => clearTimeout(timeout)
    } else {
      // Reset and start over for continuous animation
      const resetTimeout = setTimeout(() => {
        setDisplayText("")
        setCurrentIndex(0)
      }, 2000) // Wait 2 seconds before restarting

      return () => clearTimeout(resetTimeout)
    }
  }, [currentIndex, text, speed])

  return (
    <span className={className}>
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  )
}
