import { Button } from "@/components/ui/button"
import { Sheet } from "lucide-react"

export function ConnectGoogleSheets() {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-6">
        <Sheet className="h-16 w-16 text-green-500" />
      </div>
      
      <h2 className="text-2xl font-semibold mb-4">Connect Google Sheets</h2>
      
      <p className="text-center text-gray-600 mb-8 max-w-md">
        Praxis uses Google Sheets as your database. We'll create a 
        new sheet or your specified sheet to store and read your data.
      </p>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 max-w-md w-full">
        <h3 className="text-lg font-medium text-blue-800 mb-3">What we'll do:</h3>
        <ul className="space-y-2 text-blue-700">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Create a new Google Sheet for your form data or use your specified sheet</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Set up automatic secure data syncing</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Configure read/write permissions</span>
          </li>
        </ul>
      </div>
      
      <Button className="w-full max-w-md flex items-center justify-center">
        <Sheet className="mr-2 h-5 w-5" />
        Connect Google Sheets
      </Button>
    </div>
  )
}
