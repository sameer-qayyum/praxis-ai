"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlertTriangle, Lock as LockIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ConfigureAppAccessProps {
  onAuthSettingChange: (requiresAuth: boolean) => void
  defaultValue?: boolean
}

export function ConfigureAppAccess({ onAuthSettingChange, defaultValue = false }: ConfigureAppAccessProps) {
  const [requiresAuthentication, setRequiresAuthentication] = useState(defaultValue)

  // Call the callback whenever the setting changes
  useEffect(() => {
    onAuthSettingChange(requiresAuthentication)
  }, [requiresAuthentication, onAuthSettingChange])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Configure App Access</h2>
      <p className="text-gray-600 mb-4">
        Choose whether users need a Praxis account to access your generated app.
      </p>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center">
                <LockIcon className="h-5 w-5 mr-2 text-primary" />
                <Label htmlFor="requires-auth" className="text-lg font-medium">
                  Require Authentication
                </Label>
              </div>
              <p className="text-sm text-gray-500">
                When enabled, users will need to log in with a Praxis account to access your app.
              </p>
            </div>
            <Switch
              id="requires-auth"
              checked={requiresAuthentication}
              onCheckedChange={setRequiresAuthentication}
            />
          </div>
        </CardContent>
      </Card>

      {requiresAuthentication ? (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-800">
            <span className="font-medium">Authentication enabled.</span> Only users with Praxis accounts will be able to access your app.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-amber-800">
            <span className="font-medium">Public access enabled.</span> Anyone with the app link will be able to access your app without signing in.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
