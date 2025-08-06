import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { DragDropContext, Droppable, Draggable, DroppableProvided, DraggableProvided } from "@hello-pangea/dnd";
import { useForm, useController } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  GripVertical,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  InfoIcon,
  AlarmClock,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

// Field interface based on ReviewFields component
interface Field {
  id: string;
  name: string;
  type: string;
  description: string;
  include: boolean;
  sampleData?: string[];
}

interface SheetFieldManagerProps {
  app: {
    id: string;
    google_sheet?: string;
  };
  onFieldChange?: (changed: boolean) => void;
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
  const supabase = createClient();
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
        field.include !== original.include
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
          body: JSON.stringify({ columns: updatedColumns }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to update columns: ${response.status} ${response.statusText}`
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
      onFieldChange(changed);
      setIsDirty(changed);
    }
  }, [fields, originalFields, onFieldChange]);

  // Toggle field inclusion
  const toggleFieldInclusion = (id: string) => {
    setFields((currentFields) =>
      currentFields.map((field) =>
        field.id === id ? { ...field, include: !field.include } : field
      )
    );
    setIsDirty(true);
  };

  // Handle edit field modal
  const handleEditField = (field: Field) => {
    setIsEditing(field.id);
    setEditedField({ ...field });
  };

  // Handle saving edited field
  const handleSaveEdit = () => {
    if (!editedField) return;

    setFields((currentFields) =>
      currentFields.map((field) =>
        field.id === editedField.id ? { ...editedField } : field
      )
    );
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
        </div>
      </div>

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
                          !field.include
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
                              {field.sampleData && field.sampleData.length > 0 && (
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
                                checked={field.include}
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
      {isEditing && editedField && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-md">
            <div className="p-4 border-b">
              <h3 className="font-medium">Edit Field</h3>
            </div>
            <div className="p-4 space-y-4">
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
                  checked={editedField.include}
                  onCheckedChange={(checked) =>
                    setEditedField({
                      ...editedField,
                      include: checked === true,
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
            <div className="p-4 border-t flex justify-end space-x-2">
              <Button
                variant="default"
                className="ml-2"
                onClick={() => updateMetadata.mutate(fields)}
                disabled={updateMetadata.isPending}
              >
                Save Changes
              </Button>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}

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
