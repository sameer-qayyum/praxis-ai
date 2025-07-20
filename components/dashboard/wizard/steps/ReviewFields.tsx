import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// Mock data for example fields
const mockFields = [
  { 
    id: 1,
    name: "customer_name",
    type: "Text",
    description: "Full name of the customer",
    include: true,
    sampleData: ["John Smith", "Sarah Johnson", "Mike Davis"]
  },
  {
    id: 2,
    name: "email_address",
    type: "Email",
    description: "Customer email for communication",
    include: true,
    sampleData: ["john@example.com", "sarah@company.com", "mike@gmail.com"]
  },
  {
    id: 3,
    name: "phone_number",
    type: "Phone",
    description: "Contact phone number",
    include: true,
    sampleData: ["(555) 123-4567", "555-987-6543", "+1-555-555-5555"]
  },
  {
    id: 4,
    name: "company_name",
    type: "Text",
    description: "Name of the customer company",
    include: true,
    sampleData: ["Acme Corp", "Tech Solutions Inc", "Global Industries"]
  }
]

export function ReviewFields() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Review & Customize Fields</h2>
      <p className="text-gray-600 mb-6">We found {mockFields.length} fields. Check the ones you want to include and customize as needed.</p>
      
      <div className="bg-white border rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="py-3 px-4 text-left text-sm font-medium">Include</th>
              <th className="py-3 px-4 text-left text-sm font-medium">Field Name</th>
              <th className="py-3 px-4 text-left text-sm font-medium">Type</th>
              <th className="py-3 px-4 text-left text-sm font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {mockFields.map((field) => (
              <tr key={field.id} className="border-b">
                <td className="py-4 px-4">
                  <Checkbox defaultChecked={field.include} />
                </td>
                <td className="py-4 px-4">
                  <Input defaultValue={field.name} className="w-full max-w-[200px]" />
                  <div className="mt-2 text-xs text-gray-500">
                    Sample data: {field.sampleData.map((item, i) => (
                      <span key={i} className="mr-2">{item}</span>
                    ))}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <Select defaultValue={field.type}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Text">Text</SelectItem>
                      <SelectItem value="Email">Email</SelectItem>
                      <SelectItem value="Phone">Phone</SelectItem>
                      <SelectItem value="Dropdown">Dropdown</SelectItem>
                      <SelectItem value="Long Text">Long Text</SelectItem>
                      <SelectItem value="Date">Date</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="py-4 px-4">
                  <Input defaultValue={field.description} className="w-full" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="border border-dashed rounded-md p-4 mt-6 flex justify-center">
        <Button variant="outline" className="flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Field
        </Button>
      </div>
      
      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center">
          <Badge variant="outline" className="mr-2">{mockFields.filter(f => f.include).length} fields selected</Badge>
          <span className="text-sm text-gray-500">{mockFields.filter(f => f.include).length} columns in Google Sheet</span>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline">Back</Button>
          <Button>Generate App ({mockFields.filter(f => f.include).length} fields)</Button>
        </div>
      </div>
    </div>
  )
}
