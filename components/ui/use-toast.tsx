// Adapted from shadcn/ui with sonner
import * as React from "react"
import { toast } from "sonner"

export { toast }

export function useToast() {
  return {
    toast,
  }
}
