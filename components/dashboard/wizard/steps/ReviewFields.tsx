import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Info, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState } from "react"
import { useGoogleSheets } from "@/context/GoogleSheetsContext"
import { toast } from "sonner"

// Define the type for column/field data
interface Field {
  id: string;
  name: string;
  type: string;
  description: string;
  include: boolean;
  sampleData: string[];
  options?: string[]; // For Dropdown, Radio, and Checkbox Group fields
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
  "File Upload"
]

// Types that require options to be defined
const typesRequiringOptions = ["Dropdown", "Radio", "Checkbox Group"]

interface ReviewFieldsProps {
  onFieldsChange?: (count: number) => void;
  onFieldsUpdate?: (fields: Field[]) => void;
}

export function ReviewFields({ onFieldsChange, onFieldsUpdate }: ReviewFieldsProps) {
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<Field[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [includedFieldCount, setIncludedFieldCount] = useState(0)
  const [customFieldCounter, setCustomFieldCounter] = useState(0);
  const { selectedSheet, getSheetColumns } = useGoogleSheets();
  
  // Function to fetch column data when the component loads
  useEffect(() => {
    if (!selectedSheet) {
      setLoading(false);
      return;
    }

    const fetchColumnData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Use GoogleSheetsContext to fetch column data
        const data = await getSheetColumns(selectedSheet.id);
        
        if (data.isEmpty) {
          setFields([]);
          toast.error("The selected sheet appears to be empty. Please add custom fields.");
        } else {
          // Transform API response to our Field format
          
          const transformedFields = data.columns.map((col: any, index: number) => {
            // Capitalize first letter of type to match our dropdown options
            let fieldType = col.type || 'text';
            fieldType = fieldType.charAt(0).toUpperCase() + fieldType.slice(1);
            
            // Handle special case mappings
            const typeMapping: Record<string, string> = {
              'Checkbox': 'Checkbox Group',
              'Tel': 'Phone',
              'Radio': 'Radio',
              'Dropdown': 'Dropdown'
            };
            
            const normalizedType = typeMapping[fieldType] || fieldType;
            
            // For dropdown/radio/checkbox types, extract options from sample data
            let options: string[] = [];
            if (typesRequiringOptions.includes(normalizedType)) {
              try {
                // Get unique values from sample data as options
                const sampleData = col.sampleData || [];
                // Ensure we're working with string[] by explicitly casting and filtering
                const validStrings: string[] = [];
                
                for (const item of sampleData) {
                  if (typeof item === 'string' && item.trim() !== '') {
                    validStrings.push(item.trim());
                  }
                }
                
                // Remove duplicates
                const uniqueValues = Array.from(new Set(validStrings));
                options = uniqueValues.length > 0 ? uniqueValues : ['Option 1'];
              } catch (error) {
                console.error('Error processing options:', error);
                options = ['Option 1'];
              }
            }
            
            return {
              id: `col-${index}`,
              name: col.name,
              type: normalizedType,
              description: col.description || '',
              include: true,
              sampleData: col.sampleData || [],
              options: options
            };
          });
          
          setFields(transformedFields);
        }
      } catch (err: any) {
        console.error("Error fetching column data:", err);
        setError(err.message);
        toast.error("Failed to load sheet columns. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchColumnData();
  }, [selectedSheet, getSheetColumns, toast]);
  
  // Update parent component about fields
  useEffect(() => {
    if (onFieldsUpdate && fields.length > 0) {
      onFieldsUpdate(fields);
    }
  }, [fields, onFieldsUpdate]);

  // Field handlers
  const handleIncludeChange = (id: string, checked: boolean) => {
    
    setFields(prev => {
      const updatedFields = prev.map(field => 
        field.id === id ? { ...field, include: checked } : field
      );
      
      // Calculate new included count and notify parent
      const newIncludedCount = updatedFields.filter(f => f.include).length;
      
      setIncludedFieldCount(newIncludedCount);
      if (onFieldsChange) {
        onFieldsChange(newIncludedCount);
      }
      
      return updatedFields;
    });
  };
  
  const handleNameChange = (id: string, name: string) => {
    setFields(prev => 
      prev.map(field => 
        field.id === id ? { ...field, name } : field
      )
    );
  };
  
  const handleTypeChange = (id: string, type: string) => {
    setFields(prev => 
      prev.map(field => {
        if (field.id === id) {
          // Initialize options array if switching to a type that requires options
          const needsOptions = typesRequiringOptions.includes(type);
          const options = needsOptions ? (field.options?.length ? field.options : ["Option 1"]) : field.options;
          
          return { ...field, type, options };
        }
        return field;
      })
    );
    
    // If changed to a type requiring options, show a toast to notify user
    if (typesRequiringOptions.includes(type)) {
      toast.info("Don't forget to add options for this field type");
    }
  };
  
  const handleDescriptionChange = (id: string, description: string) => {
    setFields(prev => 
      prev.map(field => 
        field.id === id ? { ...field, description } : field
      )
    );
  };
  
  // Add a custom field
  const addCustomField = () => {
    const newFieldId = `custom-${customFieldCounter}`;
    
    setFields(prev => [...prev, {
      id: newFieldId,
      name: `field_${customFieldCounter + 1}`,
      type: "Text",
      description: "",
      include: true,
      sampleData: [],
      options: []
    }]);
    
    setCustomFieldCounter(prev => prev + 1);
  };
  
  // Add an option to a field
  const addOption = (fieldId: string) => {
    setFields(prev => 
      prev.map(field => {
        if (field.id === fieldId) {
          const options = field.options || [];
          return { 
            ...field, 
            options: [...options, `Option ${options.length + 1}`] 
          };
        }
        return field;
      })
    );
  };
  
  // Update an option value
  const updateOption = (fieldId: string, optionIndex: number, value: string) => {
    setFields(prev => 
      prev.map(field => {
        if (field.id === fieldId && field.options) {
          const newOptions = [...field.options];
          newOptions[optionIndex] = value;
          return { ...field, options: newOptions };
        }
        return field;
      })
    );
  };
  
  // Remove an option
  const removeOption = (fieldId: string, optionIndex: number) => {
    setFields(prev => 
      prev.map(field => {
        if (field.id === fieldId && field.options) {
          const newOptions = field.options.filter((_, index) => index !== optionIndex);
          return { ...field, options: newOptions };
        }
        return field;
      })
    );
  };
  
  // Update included fields count
  useEffect(() => {
    const count = fields.filter(field => field.include).length
    setIncludedFieldCount(count)
    onFieldsChange?.(count)
    onFieldsUpdate?.(fields)
  }, [fields, onFieldsChange, onFieldsUpdate]);

  // Calculate the number of included fields on initial load
  useEffect(() => {
    const includedCount = fields.filter(field => field.include).length;
    
    setIncludedFieldCount(includedCount);
    
    // Notify parent about initial field count
    if (onFieldsChange) {
      onFieldsChange(includedCount);
    }
  }, [fields, onFieldsChange]);

  // Render loading state
  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-gray-600">Loading sheet columns...</p>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="w-full max-w-4xl mx-auto py-10">
        <h2 className="text-2xl font-semibold mb-4">Failed to Load Fields</h2>
        <p className="text-red-500 mb-6">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }
  
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Review & Customize Fields</h2>
        <Button onClick={addCustomField} variant="outline" size="sm" className="flex items-center">
          <Plus className="h-4 w-4 mr-1" />
          Add Custom Field
        </Button>
      </div>
      
      {fields.length > 0 ? (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-300">Field types have been automatically detected</h3>
              <p className="text-blue-800 dark:text-blue-400 text-sm mt-1">
                We've analyzed your sheet data to suggest appropriate field types. Please review and adjust them if needed to ensure your app is correctly configured.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-amber-900 dark:text-amber-300">Define fields for your application</h3>
              <p className="text-amber-800 dark:text-amber-400 text-sm mt-1">
                It's important to correctly define the fields you want to use in your application. This ensures data is stored and retrieved correctly. Add fields using the button above.
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
          
          <div className="bg-white dark:bg-gray-800 border rounded-md overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-900">
                  <th className="py-3 px-4 text-left text-sm font-medium">Include</th>
                  <th className="py-3 px-4 text-left text-sm font-medium">Field Name</th>
                  <th className="py-3 px-4 text-left text-sm font-medium">Type</th>
                  <th className="py-3 px-4 text-left text-sm font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.id} className="border-b">
                    <td className="py-4 px-4">
                      <Checkbox 
                        checked={field.include} 
                        onCheckedChange={(checked) => handleIncludeChange(field.id, !!checked)}
                      />
                    </td>
                    <td className="py-4 px-4">
                      <Input 
                        value={field.name} 
                        onChange={(e) => handleNameChange(field.id, e.target.value)} 
                        className="w-full max-w-[200px]" 
                      />
                      {field.sampleData.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          Sample data: {field.sampleData.map((item, i) => (
                            <span key={i} className="mr-2">{item}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <Select 
                        value={field.type}
                        onValueChange={(value) => handleTypeChange(field.id, value)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-4 px-4">
                      <Input 
                        value={field.description} 
                        onChange={(e) => handleDescriptionChange(field.id, e.target.value)} 
                        className="w-full" 
                      />
                      
                      {/* Display options UI for field types that need it */}
                      {typesRequiringOptions.includes(field.type) && (
                        <div className="mt-4 border p-3 rounded-md bg-gray-50 dark:bg-gray-900">
                          <p className="text-sm font-medium mb-2">Options:</p>
                          
                          {/* List existing options */}
                          {(field.options || []).map((option, index) => (
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
                                <span className="sr-only">Remove option</span>
                                <span className="text-lg">×</span>
                              </Button>
                            </div>
                          ))}
                          
                          {/* Add option button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addOption(field.id)}
                            className="text-xs mt-1"
                          >
                            Add Option
                          </Button>
                          
                          {/* Warning if no options */}
                          {(field.options || []).length === 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                              Please add at least one option for this field type.
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="border border-dashed rounded-md p-4 mt-6 flex justify-center">
            <Button variant="outline" className="flex items-center" onClick={addCustomField}>
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Field
            </Button>
          </div>
        </>
      )}
      
      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center">
          <Badge variant="outline" className="mr-2">{includedFieldCount} fields selected</Badge>
          <span className="text-sm text-gray-500">{includedFieldCount} columns in Google Sheet</span>
        </div>
      </div>
    </div>
  )
}
