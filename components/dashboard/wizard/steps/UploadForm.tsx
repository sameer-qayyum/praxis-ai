import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"

export function UploadForm() {
  return (
    <div className="flex flex-col items-center">
      <h2 className="text-2xl font-semibold mb-4">Upload Your Form</h2>
      
      <p className="text-center text-gray-600 mb-8">
        Upload your PDF, Word document, Excel file, or image of your form
      </p>
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 w-full max-w-lg flex flex-col items-center justify-center">
        <Upload className="h-12 w-12 text-gray-400 mb-4" />
        
        <p className="text-center mb-2">Drop your file here or click to browse</p>
        <p className="text-sm text-gray-500 mb-6">Supports PDF, Word, Excel, and images</p>
        
        <Button variant="outline" className="w-40">
          Choose File
        </Button>
      </div>
    </div>
  )
}
