"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Info, Loader2, Trash2, HelpCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useEffect, useState } from "react"
import { useGoogleSheets } from "@/context/GoogleSheetsContext"
import { toast } from "sonner"
import type { ColumnSyncResult } from "@/context/GoogleSheetsContext"
import { createClient } from "@/lib/supabase/client"

// Define the type for column/field data
interface Field {
  id: string
  name: string
  type: string
  description: string
  include: boolean
  sampleData: string[]
  options?: string[] // For Dropdown, Radio, and Checkbox Group fields
  isRemoved?: boolean // Flag for columns that have been removed from the Google Sheet
  isAdded?: boolean // Flag for columns that have been added to the Google Sheet
  isReordered?: boolean // Flag for columns that have been reordered in the Google Sheet
  oldIndex?: number // Previous index for reordered columns
  newIndex?: number // New index for reordered columns
  isCustom?: boolean // Flag for custom fields added by the user in the UI
  originalIndex?: number // Store original position in the sheet
}

// Field type options
const fieldTypes = [
  "Text",
  "Email",
  "Phone",
  "Number",
  "Date",
  "Long Text",
  "URL",
  "Boolean", // Yes/No toggle
  "Radio", // Single select
  "Dropdown", // Single select from dropdown
  "Checkbox Group", // Multiple select
  "File Upload",
]

// Types that require options to be defined
const typesRequiringOptions = ["Dropdown", "Radio", "Checkbox Group"]

interface ReviewFieldsProps {
  onFieldsChange?: (count: number) => void
  onFieldsUpdate?: (fields: Field[]) => void
  columnChanges?: ColumnSyncResult | null
  templateId?: string
}

export function ReviewFields({ onFieldsChange, onFieldsUpdate, columnChanges, templateId }: ReviewFieldsProps) {
  const [loading, setLoading] = useState(true)
  const [fields, setFields] = useState<Field[]>([])
  const [error, setError] = useState<string | null>(null)
  const [includedFieldCount, setIncludedFieldCount] = useState(0)
  const [customFieldCounter, setCustomFieldCounter] = useState(0)
  const [isTemplateSuggestions, setIsTemplateSuggestions] = useState(false)
  const { selectedSheet, getSheetColumns, getSheetConnection } = useGoogleSheets()

  // Function to fetch column data when the component loads
  useEffect(() => {
    if (!selectedSheet) {
      setLoading(false)
      return
    }

    const fetchColumnData = async () => {
      setLoading(true)
      setError(null)

      try {
        // First check if we have an existing connection for this sheet
        const existingConnection = await getSheetConnection(selectedSheet.id)

        if (existingConnection?.columns_metadata && Array.isArray(existingConnection.columns_metadata)) {
          // We found existing column metadata, use that instead of fetching from the sheet

          // Check if we have column changes from the previous step (regardless of hasChanges flag)
          if (columnChanges) {
            // Find change status for each column from the changes array
            const changeMap = new Map(columnChanges.changes.map(c => [c.name, c]));
            
            // Use the merged columns that preserve user customizations where possible
            const updatedFields = columnChanges.mergedColumns.map((col: any, index: number) => {
              const isRemovedFlag = !!col.isRemoved;
              const change = changeMap.get(col.name);
              
              const isAddedFlag = change?.type === 'added';
              const isReorderedFlag = change?.type === 'reordered';
              
              const fieldObj = {
                id: col.id || `col-${index}`,
                name: col.name,
                type: col.type || "Text",
                description: col.description || "",
                include: !isRemovedFlag, // Don't include removed columns by default
                sampleData: col.sampleData || [], // Use sample data if available
                options: col.options || [],
                isRemoved: isRemovedFlag,
                isAdded: isAddedFlag,
                isReordered: isReorderedFlag,
                oldIndex: isReorderedFlag ? change?.index : undefined,
                newIndex: isReorderedFlag ? change?.newIndex : undefined
              }
              
              return fieldObj
            })

            setFields(updatedFields)
            toast.success("Updated fields with changes detected in Google Sheet.")
            setLoading(false)
            return
          }

          // No changes detected, use existing metadata
          const storedFields = existingConnection.columns_metadata.map((col: any, index: number) => {
            const fieldObj = {
              id: col.id || `col-${index}`,
              name: col.name,
              type: col.type,
              description: col.description || "",
              include: true, // Always include fields from saved metadata
              sampleData: [], // We don't have sample data from stored metadata
              options: col.options || [],
            }
            return fieldObj
          })

          setFields(storedFields)
          toast.success("Loaded your previously saved field configuration.")
          setLoading(false)
          return
        }

        // If no existing metadata, fetch column data from the sheet
        const data = await getSheetColumns(selectedSheet.id)

        if (data.isEmpty) {
          // Sheet is empty and no existing connection - check for template suggestions
          if (templateId) {
            const supabase = createClient()
            try {
              const { data: templateData, error: templateError } = await supabase
                .from('templates')
                .select('new_sheet_columns_metadata')
                .eq('id', templateId)
                .single()

              if (!templateError && templateData?.new_sheet_columns_metadata && Array.isArray(templateData.new_sheet_columns_metadata)) {
                // Process template suggestions into storedFields format
                const templateSuggestions = templateData.new_sheet_columns_metadata.map((col: any, index: number) => ({
                  id: col.id || `template-${index}`,
                  name: col.name,
                  type: col.type,
                  description: col.description || "",
                  include: !!col.active, // Respect the active field from template
                  sampleData: [], // No sample data from templates
                  options: col.options || [],
                  originalIndex: col.originalIndex || index
                }))

                setFields(templateSuggestions)
                setIsTemplateSuggestions(true)
                toast.success("Loaded template field suggestions. Customize as needed.")
                setLoading(false)
                return
              }
            } catch (templateFetchError) {
              console.error("Error fetching template suggestions:", templateFetchError)
              // Fall through to default empty sheet handling
            }
          }
          
          // Fallback: No template suggestions available
          setFields([])
          toast.error("The selected sheet appears to be empty. Please add custom fields.")
        } else {
          // Transform API response to our Field format

          const transformedFields = data.columns.map((col: any, index: number) => {
            // Capitalize first letter of type to match our dropdown options
            let fieldType = col.type || "text"
            fieldType = fieldType.charAt(0).toUpperCase() + fieldType.slice(1)

            // Handle special case mappings
            const typeMapping: Record<string, string> = {
              Checkbox: "Checkbox Group",
              Tel: "Phone",
              Radio: "Radio",
              Dropdown: "Dropdown",
            }

            const normalizedType = typeMapping[fieldType] || fieldType

            // For dropdown/radio/checkbox types, extract options from sample data
            let options: string[] = []
            if (typesRequiringOptions.includes(normalizedType)) {
              try {
                // Get unique values from sample data as options
                const sampleData = col.sampleData || []
                // Ensure we're working with string[] by explicitly casting and filtering
                const validStrings: string[] = []

                for (const item of sampleData) {
                  if (typeof item === "string" && item.trim() !== "") {
                    validStrings.push(item.trim())
                  }
                }

                // Remove duplicates
                const uniqueValues = Array.from(new Set(validStrings))
                options = uniqueValues.length > 0 ? uniqueValues : ["Option 1"]
              } catch (error) {
                console.error("Error processing options:", error)
                options = ["Option 1"]
              }
            }

            return {
              id: `col-${index}`,
              name: col.name,
              type: normalizedType,
              description: col.description || "",
              include: true,
              sampleData: col.sampleData || [],
              options: options,
            }
          })

          setFields(transformedFields)
        }
      } catch (err: any) {
        console.error("Error fetching column data:", err)
        setError(err.message)
        toast.error("Failed to load sheet columns. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    fetchColumnData()
  }, [selectedSheet, getSheetColumns, getSheetConnection, toast])

  // This useEffect was removed to prevent duplicate updates (now handled by the useEffect at the end of the component)

  // Field handlers
  const handleIncludeChange = (id: string, checked: boolean) => {
    // Only update the fields state, let the useEffect handle counting and parent notifications
    setFields((prev) => {
      return prev.map((field) => (field.id === id ? { ...field, include: checked } : field))
    })
    // Note: We removed the nested state updates and parent notifications
    // These will be handled by the useEffect that watches for field changes
  }

  const handleNameChange = (id: string, name: string) => {
    setFields((prev) => prev.map((field) => (field.id === id ? { ...field, name } : field)))
  }

  const handleTypeChange = (id: string, type: string) => {
    setFields((prev) => {
      const updatedFields = prev.map((field) => {
        if (field.id === id) {
          // Initialize options array if switching to a type that requires options
          const needsOptions = typesRequiringOptions.includes(type)
          const options = needsOptions ? (field.options?.length ? field.options : ["Option 1"]) : field.options

          const updatedField = { ...field, type, options }

          return updatedField
        }
        return field
      })

      return updatedFields
    })

    // If changed to a type requiring options, show a toast to notify user
    if (typesRequiringOptions.includes(type)) {
      toast.info("Don't forget to add options for this field type")
    }
  }

  const handleDescriptionChange = (id: string, description: string) => {
    setFields((prev) => prev.map((field) => (field.id === id ? { ...field, description } : field)))
  }

  // Add a custom field
  const addCustomField = () => {
    const newFieldId = `custom-${customFieldCounter}`

    setFields((prev) => [
      ...prev,
      {
        id: newFieldId,
        name: `field_${customFieldCounter + 1}`,
        type: "Text",
        description: "",
        include: true,
        sampleData: [],
        options: [],
        isCustom: true, // Mark this as a custom field
      },
    ])

    setCustomFieldCounter((prev) => prev + 1)
  }

  // Delete a field (only custom fields can be deleted)
  const deleteField = (id: string) => {
    // Verify it's a custom field before removing - check both the isCustom flag and the id prefix
    const fieldToDelete = fields.find(field => field.id === id)
    if (!fieldToDelete?.isCustom && !id.startsWith('custom-')) {
      console.log('Cannot delete non-custom field:', id)
      return
    }
    
    setFields((prev) => prev.filter((field) => field.id !== id))
    toast.success("Custom field removed")
  }

  // Add an option to a field
  const addOption = (fieldId: string) => {
    setFields((prev) =>
      prev.map((field) => {
        if (field.id === fieldId) {
          const options = field.options || []
          return {
            ...field,
            options: [...options, `Option ${options.length + 1}`],
          }
        }
        return field
      }),
    )
  }

  // Update an option value
  const updateOption = (fieldId: string, optionIndex: number, value: string) => {
    setFields((prev) =>
      prev.map((field) => {
        if (field.id === fieldId && field.options) {
          const newOptions = [...field.options]
          newOptions[optionIndex] = value
          return { ...field, options: newOptions }
        }
        return field
      }),
    )
  }

  // Remove an option
  const removeOption = (fieldId: string, optionIndex: number) => {
    setFields((prev) =>
      prev.map((field) => {
        if (field.id === fieldId && field.options) {
          const newOptions = field.options.filter((_, index) => index !== optionIndex)
          return { ...field, options: newOptions }
        }
        return field
      }),
    )
  }

  // Update included fields count and notify parent components
  useEffect(() => {
    if (fields.length === 0) return;
    
    const includedCount = fields.filter((field) => field.include).length;
    setIncludedFieldCount(includedCount);
    
    // Notify parent about field count
    if (onFieldsChange) {
      onFieldsChange(includedCount);
    }
    
    // Update fields in parent if needed
    if (onFieldsUpdate) {
      onFieldsUpdate(fields);
    }
  }, [fields, onFieldsChange, onFieldsUpdate])

  // Get field type for display
  const getFieldType = (field: Field) => {
    return field.type || "Text"
  }

  // Render loading state
  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-gray-600">Loading sheet columns...</p>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div className="w-full max-w-4xl mx-auto py-10">
        <h2 className="text-2xl font-semibold mb-4">Failed to Load Fields</h2>
        <p className="text-red-500 mb-6">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Review & Customize Fields</h2>
        <Button onClick={addCustomField} variant="outline" size="sm" className="flex items-center bg-transparent">
          <Plus className="h-4 w-4 mr-1" />
          Add Custom Field
        </Button>
      </div>

      {columnChanges?.hasChanges && (
        <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-orange-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-orange-900 dark:text-orange-300">Sheet structure has changed</h3>
              <p className="text-orange-800 dark:text-orange-400 text-sm mt-1">
                We detected {columnChanges.changes.filter((c) => c.type === "added").length} new columns,{" "}
                {columnChanges.changes.filter((c) => c.type === "removed").length} removed columns, and{" "}
                {columnChanges.changes.filter((c) => c.type === "reordered").length} reordered columns. Your previous
                customizations have been preserved where possible.
              </p>
            </div>
          </div>
        </div>
      )}

      {fields.length > 0 ? (
        isTemplateSuggestions ? (
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-green-900 dark:text-green-300">
                  Template recommended fields loaded
                </h3>
                <p className="text-green-800 dark:text-green-400 text-sm mt-1">
                  These are the recommended fields for this template. You can customize their names, types, and descriptions. 
                  These fields will be automatically added as column headers to your Google Sheet when you finish the wizard.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-blue-900 dark:text-blue-300">
                  Field types have been automatically detected
                </h3>
                <p className="text-blue-800 dark:text-blue-400 text-sm mt-1">
                  We've analyzed your sheet data to suggest appropriate field types. Please review and adjust them if
                  needed to ensure your app is correctly configured.
                </p>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-amber-900 dark:text-amber-300">Define fields for your application</h3>
              <p className="text-amber-800 dark:text-amber-400 text-sm mt-1">
                It's important to correctly define the fields you want to use in your application. This ensures data is
                stored and retrieved correctly. Add fields using the button above.
              </p>
            </div>
          </div>
        </div>
      )}

      {fields.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-600 mb-6">No fields found in the selected sheet. Add custom fields to continue.</p>
          <Button onClick={addCustomField} className="flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Add First Field
          </Button>
        </div>
      ) : (
        <>
          <p className="text-gray-600 mb-6">
            We found {fields.length} fields. Check the ones you want to include and customize as needed.
          </p>

          <ScrollArea className="h-[60vh] pr-4">
            <div className="grid grid-cols-1 gap-4">
              {fields.map((field: Field, index) => {
              // Ensure the isRemoved flag is a boolean
              const isRemoved = field.isRemoved === true

              return (
                <div
                  key={field.id}
                  className={`bg-white dark:bg-gray-800 border rounded-lg shadow-sm overflow-hidden 
                    ${isRemoved ? "border-red-300 dark:border-red-700" : ""}
                    ${field.isAdded ? "border-green-300 dark:border-green-700" : ""}
                    ${field.isReordered ? "border-amber-300 dark:border-amber-700" : ""}
                  `}
                >
                  {/* Column change status indicators */}
                  {(isRemoved || field.isAdded || field.isReordered) && (
                    <div className={`px-4 py-2 border-b flex items-center gap-2
                      ${isRemoved ? "bg-red-50 dark:bg-red-900/20" : ""}
                      ${field.isAdded ? "bg-green-50 dark:bg-green-900/20" : ""}
                      ${field.isReordered ? "bg-amber-50 dark:bg-amber-900/20" : ""}
                    `}>
                      {isRemoved && (
                        <>
                          <Badge variant="destructive" className="whitespace-nowrap">
                            Removed from Sheet
                          </Badge>
                          <span className="text-xs text-red-600 dark:text-red-400">
                            This column no longer exists in the Google Sheet
                          </span>
                        </>
                      )}
                      
                      {field.isAdded && (
                        <>
                          <Badge className="whitespace-nowrap bg-green-500">
                            New Column
                          </Badge>
                          <span className="text-xs text-green-600 dark:text-green-400">
                            This column was recently added to the Google Sheet
                          </span>
                        </>
                      )}
                      
                      {field.isReordered && (
                        <>
                          <Badge className="whitespace-nowrap bg-amber-500">
                            Reordered Column
                          </Badge>
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            This column moved from position {field.oldIndex! + 1} to {field.newIndex! + 1}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Field content */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`include-${field.id}`}
                          checked={field.include}
                          onCheckedChange={(checked) => handleIncludeChange(field.id, !!checked)}
                          className="border-2 border-gray-300 data-[state=checked]:border-blue-500 dark:border-gray-600 dark:data-[state=checked]:border-blue-400"
                        />
                        <div className="flex items-center gap-1">
                          <label htmlFor={`include-${field.id}`} className="text-sm font-medium cursor-pointer">
                            Include field
                          </label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p>When checked, this field will be included in your app to fill out. Unchecked fields are not editable by the user.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    
                      
                      {/* Show delete button only for custom fields */}
                      {field.id.startsWith('custom-') && (
                        <Button 
                          onClick={() => deleteField(field.id)} 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="flex items-center gap-1 mb-1.5">
                          <label className="text-xs font-medium">Field Name</label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p>The name of this field as it will appear in your google sheet. Praxis will create a user friendly name of the field in the app</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          value={field.name}
                          onChange={(e) => handleNameChange(field.id, e.target.value)}
                          className={isRemoved ? "border-red-300 dark:border-red-500" : ""}
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-1 mb-1.5">
                          <label className="text-xs font-medium">Field Type</label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p>The type of input field users will see in your app. This determines how data is collected and validated.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Select
                          value={field.type}
                          onValueChange={(value) => {
                            handleTypeChange(field.id, value)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-2">
                        <div className="flex items-center gap-1 mb-1.5">
                          <label className="text-xs font-medium">Description</label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p>Context about the field. Helps Praxis understand the fields and it's value to generate the app accurately.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          value={field.description || ""}
                          onChange={(e) => handleDescriptionChange(field.id, e.target.value)}
                          placeholder="Optional description"
                        />
                      </div>
                    </div>

                    {/* Display options UI for field types that need it */}
                    {typesRequiringOptions.includes(field.type) && (
                      <div className="mt-4 border p-3 rounded-md bg-gray-50 dark:bg-gray-900">
                        <div className="flex items-center gap-1 mb-2">
                          <p className="text-sm font-medium">Options:</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p>Define the choices users can select from. Each option will appear as a selectable item in your app.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        {/* List existing options */}
                        {(field.options || []).map((option: string, index: number) => (
                          <div key={index} className="flex items-center gap-2 mb-2">
                            <Input
                              value={option}
                              onChange={(e) => updateOption(field.id, index, e.target.value)}
                              className="flex-1"
                              placeholder={`Option ${index + 1}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOption(field.id, index)}
                              className="h-8 w-8"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </Button>
                          </div>
                        ))}

                        {/* Add option button */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addOption(field.id)}
                          className="w-full mt-2"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Option
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Third row: Sample data */}
                  {field.sampleData?.length > 0 && (
                    <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-900/50 border-t">
                      <span className="font-medium">Sample data:</span>{" "}
                      {field.sampleData.map((item: any, i: number) => (
                        <span key={i} className="mr-2 italic">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
              })}
            </div>
          </ScrollArea>

          <div className="border border-dashed rounded-md p-4 mt-6 flex justify-center">
            <Button variant="outline" className="flex items-center bg-transparent" onClick={addCustomField}>
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Field
            </Button>
          </div>
        </>
      )}

      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center">
          <Badge variant="outline" className="mr-2">
            {includedFieldCount} fields selected
          </Badge>
          <span className="text-sm text-gray-500">{includedFieldCount} columns in Google Sheet</span>
        </div>
      </div>
    </div>
  )
}
