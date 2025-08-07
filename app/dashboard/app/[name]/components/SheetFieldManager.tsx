import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DroppableProvided, DraggableProvided } from "@hello-pangea/dnd";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
import {
  GripVertical,
  RefreshCw,
  CheckCircle2,
  InfoIcon,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Field interface based on ReviewFields component
interface Field {
  id: string;
  name: string;
  type: string;
  description: string;
  active: boolean;
  sampleData?: string[];
  options?: any[];
  originalIndex?: number;
}

interface SheetFieldManagerProps {
  app: {
    id: string;
    google_sheet?: string;
  }
  google_sheet?: string
  onFieldChange?: (changed: boolean, fields?: Field[]) => void
}

// Field type options
const fieldTypes = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean (Yes/No)" },
  { value: "date", label: "Date" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "tel", label: "Phone Number" },
  { value: "dropdown", label: "Dropdown (Single Select)" },
  { value: "checkbox", label: "Checkbox Group (Multi Select)" },
];

export const SheetFieldManager: React.FC<SheetFieldManagerProps> = ({
  app,
  onFieldChange,
}) => {
  const [fields, setFields] = useState<Field[]>([]);
  const [originalFields, setOriginalFields] = useState<Field[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editedField, setEditedField] = useState<Field | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [updateGlobalMetadata, setUpdateGlobalMetadata] = useState<boolean>(false);
  const queryClient = useQueryClient();

  // Function to check if fields have changed from original
  const hasFieldsChanged = () => {
    if (fields.length !== originalFields.length) return true;
    
    return fields.some((field, index) => {
      const original = originalFields[index];
      return (
        field.name !== original.name ||
        field.type !== original.type ||
        field.description !== original.description ||
        field.active !== original.active
      );
    });
  };

  // Fetch field metadata
  const {
    data: fieldData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["sheet-columns", app?.id],
    queryFn: async () => {
      if (!app?.id || !app?.google_sheet) return null;

      // Call our dashboard sheets columns API
      const response = await fetch(
        `/api/dashboard/sheets/${app.id}/columns`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch sheet columns: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    },
    enabled: !!app?.id && !!app?.google_sheet,
  });

  // Update metadata mutation
  const updateMetadata = useMutation({
    mutationFn: async (updatedColumns: Field[]) => {
      if (!app?.id || !app?.google_sheet) throw new Error("No sheet connection");
      
      // Call our dashboard sheets columns API to update
      const response = await fetch(
        `/api/dashboard/sheets/${app.id}/columns`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            columns: updatedColumns,
            updateGlobal: updateGlobalMetadata // Include flag to update global metadata if needed
          }),
        }
      );
      
      const responseStatus = response.status;
      console.log('SheetFieldManager: API response status:', responseStatus);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('SheetFieldManager: API error:', errorText);
        throw new Error(
          `Failed to update columns: ${responseStatus} ${response.statusText} - ${errorText}`
        );
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["sheet-columns", app?.id],
      });
      setIsDirty(false);
    },
  });

  // Update state when data is loaded
  useEffect(() => {
    if (fieldData?.columns) {
      setFields(fieldData.columns);
      setOriginalFields(JSON.parse(JSON.stringify(fieldData.columns))); // Deep clone
    }
  }, [fieldData]);

  // Notify parent component of changes
  useEffect(() => {
    if (onFieldChange && fields.length > 0) {
      const changed = hasFieldsChanged();
      
      // Pass both the changed status AND the current fields state
      // This allows the parent to know what fields to save
      onFieldChange(changed, fields);
      setIsDirty(changed);
    }
  }, [fields, originalFields, onFieldChange]);

  // Toggle field inclusion
  const toggleFieldInclusion = (id: string) => {
    setFields((currentFields) => {
      const newFields = currentFields.map((field) => {
        if (field.id === id) {
          const newActive = field.active === true ? false : true;
          return { ...field, active: newActive };
        }
        return field;
      });
      return newFields;
    });
    setIsDirty(true);
  };

  // Handle edit field modal
  const handleEditField = (field: Field) => {
    
    // Create a clean copy of the field with explicit boolean conversion
    const cleanField = {
      ...field,
      active: field.active === true, // Force explicit boolean conversion
      description: field.description || "",
      options: field.options || [],
      originalIndex: field.originalIndex || 0,
      sampleData: field.sampleData || []
    };
    
    setIsEditing(field.id);
    setEditedField(cleanField);
  };

  // Handle saving edited field
  const handleSaveEdit = () => {
    if (!editedField) return;
    
    // Find the current field state (to make sure we have the most recent active state)
    const currentField = fields.find(f => f.id === editedField.id);
    const currentActive = currentField?.active; // Get the current active state from fields array
    
    
    // Create a clean object to avoid any potential proxy issues
    const cleanEditedField = {
      id: editedField.id,
      name: editedField.name,
      type: editedField.type,
      description: editedField.description || "",
      // Use the dialog's active state which should reflect any changes in the dialog
      active: editedField.active === true, 
      options: editedField.options || [],
      originalIndex: editedField.originalIndex || 0,
      sampleData: editedField.sampleData || []
    };
    
    
    // Update the fields state with the edited field
    setFields((currentFields) =>
      currentFields.map((field) =>
        field.id === editedField.id ? cleanEditedField : field
      )
    );
    
    // Close the dialog
    setIsEditing(null);
    setEditedField(null);
    setIsDirty(true);
  };

  // Handle drag and drop reordering
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const reorderedFields = Array.from(fields);
    const [removed] = reorderedFields.splice(result.source.index, 1);
    reorderedFields.splice(result.destination.index, 0, removed);

    setFields(reorderedFields);
    setIsDirty(true);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Field Configuration</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh Fields
          </Button>
          {isDirty && (
            <Button
              size="sm"
              onClick={() => {
                // Check if any fields are inactive
                const anyInactive = fields.some(f => f.active === false);
                
                // Ensure we're explicitly setting active as boolean values and all properties are clean
                const updatedColumns = fields.map(field => {
                  // Create a clean object without any potential proxy issues
                  const cleanField = {
                    id: field.id,
                    name: field.name,
                    type: field.type,
                    description: field.description || "",
                    options: field.options || [],
                    originalIndex: field.originalIndex || 0,
                    active: field.active === true // Force strict boolean conversion
                  };
                  
                  // Double-check the active state is correctly set
                  if (cleanField.active !== true && cleanField.active !== false) {
                    console.warn(`Field ${field.id} has non-boolean active value: ${field.active}. Defaulting to true.`);
                    cleanField.active = true;
                  }
                  
                  return cleanField;
                });
                
                // Debug output - show any inactive fields
                if (anyInactive) {
                  const inactiveFields = updatedColumns.filter(f => f.active === false);
                }
                
                updateMetadata.mutate(updatedColumns);
              }}
              className="flex items-center gap-1"
              disabled={!isDirty || isLoading || updateMetadata.isPending}
            >
              <CheckCircle2 className="h-3 w-3" />
              Save Changes
            </Button>
          )}
        </div>
      </div>
      
      {/* Global metadata update toggle */}
      {isDirty && (
        <Alert className="mb-4 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Update global metadata?</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">Enable this to update the global sheet definition for all apps.</span>
            <div className="flex items-center space-x-2">
              <Switch 
                id="updateGlobal" 
                checked={updateGlobalMetadata} 
                onCheckedChange={setUpdateGlobalMetadata}
              />
              <Label htmlFor="updateGlobal" className="text-sm">
                {updateGlobalMetadata ? "Yes" : "No"}
              </Label>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          <span>Loading field metadata...</span>
        </div>
      ) : isError ? (
        <div className="p-4 border rounded-lg bg-red-50 text-red-700">
          <p>Failed to load field metadata:</p>
          <p className="font-mono text-sm">
            {(error as Error)?.message || "Unknown error"}
          </p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="columns-list">
            {(provided: DroppableProvided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-2"
              >
                {fields.map((field, index) => (
                  <Draggable
                    key={field.id}
                    draggableId={field.id}
                    index={index}
                  >
                    {(provided: DraggableProvided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`border rounded-md p-3 bg-white dark:bg-slate-800 ${
                          !field.active
                            ? "opacity-70 bg-gray-50 dark:bg-slate-900"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab"
                            >
                              <GripVertical className="h-5 w-5 text-gray-400" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center">
                                <h4 className="font-medium">{field.name}</h4>
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-xs"
                                >
                                  {
                                    fieldTypes.find(
                                      (t) => t.value === field.type
                                    )?.label || field.type
                                  }
                                </Badge>
                              </div>
                              {field.description && (
                                <p className="text-sm text-gray-500 mt-1">
                                  {field.description}
                                </p>
                              )}
                              {field.sampleData &&
                              field.sampleData.length > 0 && (
                                <div className="mt-1 flex items-center">
                                  <span className="text-xs text-gray-500">
                                    Sample: {field.sampleData[0]}
                                    {field.sampleData.length > 1
                                      ? `, ${field.sampleData[1]}...`
                                      : ""}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-2">
                              <Label
                                htmlFor={`include-${field.id}`}
                                className="mr-2 text-sm"
                              >
                                Include
                              </Label>
                              <Switch
                                id={`include-${field.id}`}
                                checked={field.active}
                                onCheckedChange={() =>
                                  toggleFieldInclusion(field.id)
                                }
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditField(field)}
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Edit Field Dialog */}
      <Dialog open={isEditing !== null} onOpenChange={(open) => !open && setIsEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Field</DialogTitle>
            <DialogDescription>
              Modify the properties of this field.
            </DialogDescription>
          </DialogHeader>
          {editedField && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="fieldName">Field Name</Label>
                <Input
                  id="fieldName"
                  value={editedField.name}
                  onChange={(e) =>
                    setEditedField({ ...editedField, name: e.target.value })
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fieldType">Field Type</Label>
                <Select
                  value={editedField.type}
                  onValueChange={(value) =>
                    setEditedField({ ...editedField, type: value })
                  }
                >
                  <SelectTrigger id="fieldType">
                    <SelectValue placeholder="Select field type" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fieldDesc">Description</Label>
                <Textarea
                  id="fieldDesc"
                  value={editedField.description}
                  onChange={(e) =>
                    setEditedField({
                      ...editedField,
                      description: e.target.value,
                    })
                  }
                  placeholder="Describe this field"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="fieldInclude"
                  checked={editedField.active}
                  onCheckedChange={(checked) =>
                    setEditedField({
                      ...editedField,
                      active: checked === true,
                    })
                  }
                />
                <label
                  htmlFor="fieldInclude"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Include this field in the app
                </label>
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-end space-x-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-4 text-sm text-gray-500 flex items-center">
        <InfoIcon className="h-4 w-4 mr-2" />
        <p>
          Drag and drop fields to reorder. Toggle fields on/off to include or
          exclude them. Click Edit to modify field properties.
        </p>
      </div>
    </div>
  );
};
