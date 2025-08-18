import React, { useState, useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DroppableProvided, DraggableProvided } from "@hello-pangea/dnd";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  InfoIcon,
  AlertCircle,
  Plus,
  Type as TypeIcon,
  Hash,
  CheckCircle,
  Calendar,
  Mail,
  Link as LinkIcon,
  Phone,
  List,
  CheckSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import { useGoogleSheets, type ColumnSyncResult, type ColumnChange } from "@/context/GoogleSheetsContext";

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
  onFieldChange?: (changed: boolean, fields?: Field[], updateGlobal?: boolean) => void
}

// Field type options with icons and descriptions
const fieldTypes = [
  { value: "text", label: "Text", icon: TypeIcon, description: "Free-form text values." },
  { value: "number", label: "Number", icon: Hash, description: "Numeric values that can be summed or averaged." },
  { value: "boolean", label: "Boolean (Yes/No)", icon: CheckCircle, description: "True/false values rendered as a toggle." },
  { value: "date", label: "Date", icon: Calendar, description: "Calendar dates with appropriate formatting." },
  { value: "email", label: "Email", icon: Mail, description: "Email addresses with basic validation." },
  { value: "url", label: "URL", icon: LinkIcon, description: "Web links, rendered as clickable anchors." },
  { value: "tel", label: "Phone Number", icon: Phone, description: "Telephone numbers with dialing support." },
  { value: "dropdown", label: "Dropdown (Single Select)", icon: List, description: "Choose a single value from predefined options." },
  { value: "checkbox", label: "Checkbox Group (Multi Select)", icon: CheckSquare, description: "Select multiple values from predefined options." },
] as const;

const getTypeMeta = (value: string) => fieldTypes.find((t) => t.value === value);

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
  const [customFieldCounter, setCustomFieldCounter] = useState<number>(0);
  const [currentSheetId, setCurrentSheetId] = useState<string | undefined>(undefined);
  const [syncResult, setSyncResult] = useState<ColumnSyncResult | null>(null);
  const [changeMap, setChangeMap] = useState<Record<string, ColumnChange["type"]>>({});
  // Rename helpers for better badges
  const [renameOldToNew, setRenameOldToNew] = useState<Record<string, string>>({});
  const [renameNewToOld, setRenameNewToOld] = useState<Record<string, string>>({});
  // Add Field dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false);
  const [newFieldDraft, setNewFieldDraft] = useState<{ name: string; description: string; type: string; active: boolean; options: string[] }>({
    name: "",
    description: "",
    type: "text",
    active: true,
    options: [],
  });
  const [newOption, setNewOption] = useState<string>("");
  const [editNewOption, setEditNewOption] = useState<string>("");
  const isOptionsType = (t: string) => t === "dropdown" || t === "checkbox";

  const queryClient = useQueryClient();
  const supabase = createClient();
  const { checkSheetColumnChanges, isConnected } = useGoogleSheets();
  // Explicit syncing state for the "Sync With Google Sheet" action
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Related apps that use the same google_sheet connection
  const {
    data: relatedApps,
    isLoading: isLoadingRelatedApps,
    isError: isRelatedAppsError,
    error: relatedAppsError,
  } = useQuery<{ id: string; name: string }[] | null>({
    queryKey: ["related-apps", app?.google_sheet, app?.id],
    queryFn: async () => {
      if (!app?.google_sheet) return [];
      const { data, error } = await supabase
        .from("apps")
        .select("id,name")
        .eq("google_sheet", app.google_sheet)
        .neq("id", app.id);
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!app?.google_sheet,
    staleTime: 5 * 60 * 1000,
  });

  // Helper to compute next available custom index to avoid duplicate IDs
  const findNextCustomIndex = (existingFields: Field[], startFrom: number) => {
    const existingIds = new Set(existingFields.map((f) => f.id));
    let idx = startFrom;
    while (existingIds.has(`custom-${idx}`)) idx += 1;
    return idx;
  };

  // Helpers for consolidated actions
  const clearSyncState = () => {
    setSyncResult(null);
    setChangeMap({});
    setRenameOldToNew({});
    setRenameNewToOld({});
  };

  const discardAll = () => {
    clearSyncState();
    setFields(originalFields);
    setIsDirty(false);
    if (onFieldChange) onFieldChange(false, originalFields, updateGlobalMetadata);
  };

  // Memoized saveable fields: during preview, exclude synthetic removed rows from what gets saved upstream
  const saveableFields = useMemo<Field[]>(() => {
    if (syncResult && syncResult.hasChanges) {
      const preview = buildDisplayedFields();
      return preview.filter((f) => !String(f.id || '').startsWith('removed:'));
    }
    return fields;
  }, [fields, syncResult]);

  const getPendingChangeCount = (): number => {
    let count = 0;
    if (syncResult?.changes?.length) count += syncResult.changes.length;
    // Count edited/added/removed vs original
    if (fields.length !== originalFields.length) {
      count += Math.abs(fields.length - originalFields.length);
    }
    const len = Math.min(fields.length, originalFields.length);
    for (let i = 0; i < len; i++) {
      const a = fields[i];
      const b = originalFields[i];
      if (!b || !a) continue;
      if (
        a.name !== b.name ||
        a.type !== b.type ||
        a.description !== b.description ||
        a.active !== b.active
      ) {
        count += 1;
      }
    }
    return count;
  };

  const saveConsolidated = () => {
    if (syncResult?.hasChanges) {
      // Stage detected changes into fields, mark dirty
      applyDetectedChanges();
      clearSyncState();
      return;
    }
    // No sync changes, but local edits exist
    setIsDirty(true);
    if (onFieldChange) onFieldChange(true, fields, updateGlobalMetadata);
  };

  // Build displayed fields for preview when syncResult exists so users can see added columns
  function buildDisplayedFields(): Field[] {
    if (!syncResult || !syncResult.hasChanges) return fields;
    const existingByName = new Map<string, Field>(fields.map(f => [f.name, f]));
    const existingById = new Map<string, Field>(fields.map(f => [f.id, f]));
    const renameMapNewToOld = new Map<string, string>();
    for (const ch of syncResult.changes) {
      if (ch.type === 'renamed' && ch.oldName) renameMapNewToOld.set(ch.name, ch.oldName);
    }
    // Debug: snapshot of current fields state for matching
    try {
      console.group('[FieldsUI][buildDisplayedFields] Matching Context');
      console.groupEnd();
    } catch {}
    // Prevent many-to-one reuse of the same existing field
    const usedExistingIds = new Set<string>();
    const activeMerged = syncResult.mergedColumns.filter((c: any) => !c.isRemoved);
    const preview: Field[] = activeMerged.map((c: any, idx: number) => {
      let existing = existingByName.get(c.name);
      if (!existing && c.id) existing = existingById.get(String(c.id));
      if (!existing) {
        const oldName = renameMapNewToOld.get(c.name);
        if (oldName) existing = existingByName.get(oldName);
      }
      // If this existing has already been matched to another new column, treat as new
      if (existing && usedExistingIds.has(existing.id)) {
        existing = undefined;
      }
      if (existing) {
        usedExistingIds.add(existing.id);
        const out = {
          ...existing,
          // Ensure the displayed name reflects the new sheet header
          name: c.name,
          originalIndex: idx,
        } as Field;
        return out;
      }
      // New column preview (type defaults to text)
      const outNew = {
        id: `temp-${idx}`,
        name: c.name,
        type: "text",
        description: "",
        options: [],
        active: true,
        originalIndex: idx,
        sampleData: c.sampleData || [],
      } as Field;
      return outNew;
    });
    // Append removed columns so users can see which previously existing fields are gone
    const removedMerged = syncResult.mergedColumns.filter((c: any) => c.isRemoved);
    for (const c of removedMerged) {
      // Try to find the existing field by name or id
      let existing = existingByName.get(c.name);
      if (!existing && c.id) existing = existingById.get(String(c.id));

      if (existing) {
        preview.push({
          ...existing,
          // Use a synthetic ID to avoid duplicate keys/draggableIds when the same
          // underlying field also appears in the active preview (e.g., rename cases)
          id: `removed:${existing.id}`,
          active: false,
          originalIndex: typeof existing.originalIndex === 'number' ? existing.originalIndex : -1,
        });
      } else {
        // If we cannot find an existing field, still show a stub to indicate removal
        preview.push({
          id: `removed:${c.name}`,
          name: c.name,
          type: "text",
          description: "",
          options: [],
          active: false,
          originalIndex: -1,
          sampleData: [],
        } as Field);
      }
    }
    // Ensure unique IDs in preview to avoid duplicate React keys/draggableIds
    const seen = new Set<string>();
    const uniquePreview = preview.map((f, i) => {
      let id = f.id;
      if (seen.has(id)) {
        id = `dup:${id}:${i}`;
      }
      seen.add(id);
      return { ...f, id } as Field;
    });
    // Debug: log preview rows and computed badge classification per row
    try {
      console.group('[FieldsUI][buildDisplayedFields] Preview + Badges');
      const rows = uniquePreview.map((f) => {
        let badge: string | null = null;
        if (f.id.startsWith('removed:') || (!f.active && !!syncResult?.hasChanges)) {
          badge = 'Removed';
        } else if (renameOldToNew[f.name]) {
          badge = `Renamed → ${renameOldToNew[f.name]}`;
        } else if (!renameOldToNew[f.name] && renameNewToOld[f.name]) {
          badge = `Renamed from ${renameNewToOld[f.name]}`;
        } else if (changeMap[f.name] === 'added') {
          badge = 'New';
        } else if (changeMap[f.name] === 'reordered') {
          badge = 'Reordered';
        }
        return { name: f.name, id: f.id, active: f.active, originalIndex: f.originalIndex, badge };
      });
      console.table(rows);
      console.groupEnd();
    } catch {}
    return uniquePreview;
  }

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
      // Persist all fields except preview-removed items. Keep inactive fields if the user disabled them intentionally.
      const columnsForSave = (updatedColumns || [])
        .filter((c) => !String(c.id || '').startsWith('removed:'))
        .map((c) => ({
          ...c,
          // Ensure clean IDs for temp rows created in preview
          id: String(c.id || '').startsWith('temp-') ? undefined : c.id,
        }));
      
      // Call our dashboard sheets columns API to update
      const response = await fetch(
        `/api/dashboard/sheets/${app.id}/columns`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            columns: columnsForSave,
            updateGlobal: updateGlobalMetadata // Include flag to update global metadata if needed
          }),
        }
      );
      
      const responseStatus = response.status;
      
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
      // Initialize the custom field counter based on existing custom-* IDs
      const maxCustom = fieldData.columns.reduce((max: number, f: Field) => {
        const m = /^custom-(\d+)$/.exec(f.id || "");
        if (m) {
          const n = parseInt(m[1], 10);
          return Number.isFinite(n) && n > max ? n : max;
        }
        return max;
      }, 0);
      setCustomFieldCounter(maxCustom);
    }
  }, [fieldData]);

  // Store sheetId returned by API for later direct checks
  useEffect(() => {
    if (fieldData?.sheetId) {
      setCurrentSheetId(fieldData.sheetId as string);
    }
  }, [fieldData?.sheetId]);

  // Notify parent component of changes
  useEffect(() => {
    if (onFieldChange && fields.length > 0) {
      // Consider sync preview changes as pending even if underlying fields array hasn't changed (e.g., only removals shown as preview rows)
      const changed = Boolean(syncResult?.hasChanges) || hasFieldsChanged();
      onFieldChange(changed, saveableFields, updateGlobalMetadata);
      setIsDirty(changed);
    }
  }, [saveableFields, originalFields, onFieldChange, syncResult?.hasChanges, updateGlobalMetadata]);

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

  // Add a new custom field and ensure global metadata update is enabled
  // Open Add Field dialog
  const addNewField = () => {
    const nextIndex = customFieldCounter + 1;
    setNewFieldDraft({
      name: `field_${nextIndex}`,
      description: "",
      type: "text",
      active: true,
      options: [],
    });
    setIsAddDialogOpen(true);
  };

  // Confirm Add Field from dialog
  const confirmAddField = () => {
    // Find next available custom index to ensure unique ID
    const nextIndex = findNextCustomIndex(fields, customFieldCounter + 1);
    const newField: Field = {
      id: `custom-${nextIndex}`,
      name: newFieldDraft.name.trim() || `field_${nextIndex}`,
      type: newFieldDraft.type,
      description: newFieldDraft.description || "",
      active: newFieldDraft.active === true,
      options: isOptionsType(newFieldDraft.type) ? [...(newFieldDraft.options || [])] : [],
      originalIndex: fields.length,
      sampleData: [],
    };

    setFields((prev) => {
      const updated = [...prev, newField];
      if (onFieldChange) {
        // Defer notifying parent to next tick to avoid React render warning
        setTimeout(() => {
          onFieldChange(true, updated);
        }, 0);
      }
      return updated;
    });
    setCustomFieldCounter(nextIndex);
    setIsDirty(true);
    setUpdateGlobalMetadata(true);
    setIsAddDialogOpen(false);
  };

  // Handle refresh: prefer live sheet comparison when possible
  const handleRefreshClick = async () => {
    if (isLoading || isSyncing) return;
    setIsSyncing(true);
    try {
      if (currentSheetId && isConnected) {
        const result = await checkSheetColumnChanges(currentSheetId);
        try {
          console.group('[FieldsUI][handleRefreshClick] Sync Result');
          console.groupEnd();
        } catch {}
        setSyncResult(result);
        const map: Record<string, ColumnChange["type"]> = {};
        const rOldToNew: Record<string, string> = {};
        const rNewToOld: Record<string, string> = {};
        if (result) {
          for (const ch of result.changes) {
            // Map only the target name to avoid collisions between removed and renamed sharing the same label
            map[ch.name] = ch.type;
            if (ch.type === 'renamed' && ch.oldName) {
              // Keep rename maps for contextual badges without polluting changeMap for the old name
              rOldToNew[ch.oldName] = ch.name;
              rNewToOld[ch.name] = ch.oldName;
            }
          }
          try {
            console.group('[FieldsUI][handleRefreshClick] Badge Inputs');
            console.log('changeMap:', map);
            console.log('renameOldToNew:', rOldToNew);
            console.log('renameNewToOld:', rNewToOld);
            console.groupEnd();
          } catch {}
          setChangeMap(map);
          setRenameOldToNew(rOldToNew);
          setRenameNewToOld(rNewToOld);
          // Auto-apply detected changes so footer in GoogleSheetPanel can save directly
          // Keep sync state so badges remain visible until save
          if (result.hasChanges) {
            applyDetectedChangesFrom(result);
            // Don't clear sync state to preserve badges until save
          }
        } else {
          setChangeMap({});
          setRenameOldToNew({});
          setRenameNewToOld({});
        }
      } else {
        // Fallback to simple refetch
        await refetch();
        setSyncResult(null);
        setChangeMap({});
      }
    } catch (e) {
      console.error("Refresh check failed, falling back to refetch:", e);
      await refetch();
    } finally {
      setIsSyncing(false);
    }
  };

  // Core apply logic with an explicit result to avoid state timing issues
  const applyDetectedChangesFrom = (result: ColumnSyncResult) => {
    const existingByName = new Map<string, Field>(fields.map(f => [f.name, f]));
    const existingById = new Map<string, Field>(fields.map(f => [f.id, f]));
    const renameMapNewToOld = new Map<string, string>();
    for (const ch of result.changes) {
      if (ch.type === 'renamed' && ch.oldName) {
        renameMapNewToOld.set(ch.name, ch.oldName);
      }
    }

    // Build new ordered list from mergedColumns excluding removed
    const activeMerged = result.mergedColumns.filter((c: any) => !c.isRemoved);
    // Prevent many-to-one reuse of the same existing field
    const usedExistingIds = new Set<string>();
    const newFieldsOrdered: Field[] = activeMerged.map((c: any, idx: number) => {
      let existing = existingByName.get(c.name);
      if (!existing && c.id) {
        existing = existingById.get(String(c.id));
      }
      if (!existing) {
        const oldName = renameMapNewToOld.get(c.name);
        if (oldName) existing = existingByName.get(oldName);
      }
      // If this existing has already been matched to another new column, treat as new
      if (existing && usedExistingIds.has(existing.id)) {
        existing = undefined;
      }
      if (existing) {
        usedExistingIds.add(existing.id);
        return {
          ...existing,
          // keep existing type/description/options, but ensure defaults
          type: existing.type || "text",
          description: existing.description || "",
          options: existing.options || [],
          // Preserve the existing active flag instead of forcing true
          active: existing.active === true,
          // Ensure the stored name is updated to the new header
          name: c.name,
          originalIndex: idx,
        };
      }
      // New column -> default to Text
      return {
        id: `custom-${Date.now()}-${idx}`,
        name: c.name,
        type: "text",
        description: "",
        options: [],
        active: true,
        originalIndex: idx,
        sampleData: c.sampleData || [],
      } as Field;
    });

    // Append removed as inactive with preserved id when possible
    const removedNames = new Set(
      result.mergedColumns.filter((c: any) => c.isRemoved).map((c: any) => c.name)
    );
    const removedFields: Field[] = [];
    for (const name of removedNames) {
      const existing = existingByName.get(name);
      if (existing) {
        removedFields.push({
          ...existing,
          active: false,
          // mark removed with non-negative index left as-is; UI/server can handle
          originalIndex: typeof existing.originalIndex === 'number' ? existing.originalIndex : -1,
        });
      }
    }

    const updated = [...newFieldsOrdered, ...removedFields];
    setFields(updated);
    setIsDirty(true);
    setUpdateGlobalMetadata(true); // ensure both local and global can be updated on save
    if (onFieldChange) onFieldChange(true, updated, updateGlobalMetadata);
  };

  // Backwards-compatible wrapper using current syncResult
  const applyDetectedChanges = () => {
    if (!syncResult) return;
    applyDetectedChangesFrom(syncResult);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Field Configuration</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshClick}
            disabled={isLoading || isSyncing || updateMetadata.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${(isLoading || isSyncing) ? "animate-spin" : ""}`}
            />
            {isSyncing ? 'Syncing...' : 'Sync With Google Sheet'}
          </Button>
          <Button
            size="sm"
            onClick={addNewField}
            disabled={isLoading || updateMetadata.isPending}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Field
          </Button>
          {/* Local Save button removed to keep a single save surface in GoogleSheetPanel */}
        </div>
      </div>
      {/* Add Field Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open);
        if (!open) {
          setNewOption("");
        }
      }}>
       <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
  <DialogHeader className="flex-shrink-0">
    <DialogTitle>Add New Field</DialogTitle>
    <DialogDescription>
      Define the metadata for the new field.
    </DialogDescription>
  </DialogHeader>
  
  <ScrollArea className="flex-1 pr-4">
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="newFieldName">Field Name</Label>
        <Input
          id="newFieldName"
          value={newFieldDraft.name}
          onChange={(e) => setNewFieldDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="e.g. customer_id"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="newFieldType">Type</Label>
        <Select
          value={newFieldDraft.type}
          onValueChange={(val) => setNewFieldDraft((d) => ({ ...d, type: val }))}
        >
          <SelectTrigger id="newFieldType">
            <SelectValue placeholder="Select a type" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {fieldTypes.map((t) => (
              <SelectItem key={t.value} value={t.value} className="py-3">
                <div className="flex items-start gap-3">
                  <t.icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {getTypeMeta(newFieldDraft.type)?.description}
        </p>
      </div>
      
      {isOptionsType(newFieldDraft.type) && (
        <div className="space-y-2">
          <Label>Options</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add an option and press Add"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (newOption.trim()) {
                    setNewFieldDraft(d => ({ ...d, options: [...d.options, newOption.trim()] }));
                    setNewOption("");
                  }
                }
              }}
            />
            <Button
              type="button"
              onClick={() => {
                if (newOption.trim()) {
                  setNewFieldDraft(d => ({ ...d, options: [...d.options, newOption.trim()] }));
                  setNewOption("");
                }
              }}
            >
              Add
            </Button>
          </div>
          {newFieldDraft.options.length > 0 && (
            <ScrollArea className="max-h-[120px]">
              <div className="flex flex-wrap gap-2 mt-2">
                {newFieldDraft.options.map((opt, idx) => (
                  <div key={`${opt}-${idx}`} className="flex items-center gap-1 border rounded px-2 py-1 text-sm">
                    <span>{opt}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewFieldDraft(d => ({...d, options: d.options.filter((_, i) => i !== idx)}))}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="newFieldDesc">Description</Label>
        <Textarea
          id="newFieldDesc"
          value={newFieldDraft.description}
          onChange={(e) => setNewFieldDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="Optional description"
          className="min-h-[80px] resize-none"
        />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label htmlFor="newFieldActive">Include</Label>
          <p className="text-xs text-muted-foreground">Enable to include this field in the app.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="newFieldActive"
            checked={newFieldDraft.active}
            onCheckedChange={(checked) => setNewFieldDraft((d) => ({ ...d, active: !!checked }))}
          />
          <Label htmlFor="newFieldActive">{newFieldDraft.active ? "Included" : "Excluded"}</Label>
        </div>
      </div>
    </div>
  </ScrollArea>
  
  <DialogFooter className="flex-shrink-0 pt-4 border-t">
    <DialogClose asChild>
      <Button variant="outline">Cancel</Button>
    </DialogClose>
    <Button onClick={confirmAddField} disabled={!newFieldDraft.name.trim() || (isOptionsType(newFieldDraft.type) && newFieldDraft.options.length === 0)}>
      Add Field
    </Button>
  </DialogFooter>
</DialogContent>
      </Dialog>
      
      {/* Global metadata update toggle - prominent with preview */}
      {isDirty && (
        <Alert className="mb-4 border-amber-300 bg-amber-50/80 dark:bg-amber-900/20 dark:border-amber-700">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            Update global metadata
            {relatedApps && relatedApps.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                Affects {relatedApps.length} other {relatedApps.length === 1 ? 'app' : 'apps'}
              </Badge>
            )}
          </AlertTitle>
          <AlertDescription>
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                When enabled, changes will update the global column definition for this Google Sheet. Any other apps connected to the same sheet will receive these updates.
              </p>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  {isLoadingRelatedApps ? (
                    <p className="text-xs text-muted-foreground">Checking other apps…</p>
                  ) : isRelatedAppsError ? (
                    <p className="text-xs text-red-600">Failed to load related apps: {(relatedAppsError as Error)?.message}</p>
                  ) : relatedApps && relatedApps.length > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      <p className="mb-1">Will affect:</p>
                      <ul className="list-disc ml-5 space-y-0.5">
                        {relatedApps.slice(0, 5).map((a) => (
                          <li key={a.id} className="truncate">{a.name || a.id}</li>
                        ))}
                      </ul>
                      {relatedApps.length > 5 && (
                        <p className="mt-1">+ {relatedApps.length - 5} more…</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No other apps will be affected.</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="updateGlobal"
                    checked={updateGlobalMetadata}
                    onCheckedChange={setUpdateGlobalMetadata}
                  />
                  <Label htmlFor="updateGlobal" className="text-sm">
                    {updateGlobalMetadata ? "Enabled" : "Disabled"}
                  </Label>
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Change summary alert */}
      {/* No alert needed: detected changes are auto-applied for a single save surface in GoogleSheetPanel */}

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
                {(syncResult && syncResult.hasChanges ? buildDisplayedFields() : fields).map((field, index) => (
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
                                {/* Badge priority: Removed > Renamed > Added > Reordered */}
                                {(
                                  // Removed preview items are appended with id starting with 'removed:'
                                  field.id.startsWith('removed:')
                                ) && (
                                  <Badge className="ml-2 text-xs" variant="destructive">Removed</Badge>
                                )}
                                {/* Renamed derived from rename maps to avoid name collisions */}
                                {!field.id.startsWith('removed:') && renameOldToNew[field.name] && (
                                  <Badge className="ml-2 text-xs bg-amber-500 text-white" variant="default">
                                    {`Renamed → ${renameOldToNew[field.name]}`}
                                  </Badge>
                                )}
                                {!field.id.startsWith('removed:') && !renameOldToNew[field.name] && renameNewToOld[field.name] && (
                                  <Badge className="ml-2 text-xs bg-amber-500 text-white" variant="default">
                                    {`Renamed from ${renameNewToOld[field.name]}`}
                                  </Badge>
                                )}
                                {/* Added/Reordered from changeMap for the current name */}
                                {changeMap[field.name] === 'added' && (
                                  <Badge className="ml-2 text-xs bg-emerald-600 text-white" variant="default">New</Badge>
                                )}
                                {changeMap[field.name] === 'reordered' && (
                                  <Badge className="ml-2 text-xs" variant="secondary">Reordered</Badge>
                                )}
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
                                disabled={field.id.startsWith('temp-')}
                                onCheckedChange={() => toggleFieldInclusion(field.id)}
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={field.id.startsWith('temp-')}
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

      {/* Sticky footer removed: rely on GoogleSheetPanel's footer as the single save surface */}

      {/* Edit Field Dialog */}
      <Dialog open={isEditing !== null} onOpenChange={(open) => {
        if (!open) {
          setIsEditing(null);
          setEditNewOption("");
        }
      }}>
        <DialogContent className="max-w-lg w-full sm:w-[560px] max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Field</DialogTitle>
            <DialogDescription>
              Modify the properties of this field.
            </DialogDescription>
          </DialogHeader>
          {editedField && (
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="fieldName" className="text-sm font-medium text-foreground">Field Name</Label>
                    <Input
                      id="fieldName"
                      value={editedField.name}
                      onChange={(e) => setEditedField({ ...editedField, name: e.target.value })}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fieldType" className="text-sm font-medium text-foreground">Field Type</Label>
                    <Select
                      value={editedField.type}
                      onValueChange={(value) => setEditedField({ ...editedField, type: value })}
                    >
                      <SelectTrigger id="fieldType" className="w-full">
                        <SelectValue placeholder="Select field type" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[320px] overflow-y-auto" position="popper" sideOffset={4}>
                        {fieldTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value} className="py-3">
                            <div className="flex items-start gap-3">
                              <type.icon className="h-4 w-4 mt-0.5" />
                              <div>
                                <div className="text-sm font-medium">{type.label}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">{getTypeMeta(editedField.type)?.description}</p>
                  </div>
                  {isOptionsType(editedField.type) && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Options</Label>
                      <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                        <Input
                          placeholder="Add an option and press Add"
                          value={editNewOption}
                          onChange={(e) => setEditNewOption(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = editNewOption.trim();
                              if (val) {
                                setEditedField({ ...editedField, options: [...(editedField.options || []), val] });
                                setEditNewOption("");
                              }
                            }
                          }}
                          className="w-full"
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            const val = editNewOption.trim();
                            if (val) {
                              setEditedField({ ...editedField, options: [...(editedField.options || []), val] });
                              setEditNewOption("");
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>
                      {editedField.options && editedField.options.length > 0 && (
                        <div className="max-h-[140px] overflow-y-auto border rounded-md p-2 bg-muted/30">
                          <div className="flex flex-wrap gap-2">
                            {editedField.options.map((opt: any, idx: number) => (
                              <div key={`${opt}-${idx}`} className="flex items-center gap-1 border rounded px-2 py-1 text-sm bg-background">
                                <span>{String(opt)}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0"
                                  onClick={() => setEditedField({ ...editedField, options: (editedField.options || []).filter((_: any, i: number) => i !== idx) })}
                                >
                                  ×
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="fieldDesc" className="text-sm font-medium text-foreground">Description</Label>
                    <Textarea
                      id="fieldDesc"
                      value={editedField.description}
                      onChange={(e) => setEditedField({ ...editedField, description: e.target.value })}
                      placeholder="Describe this field"
                      className="w-full min-h-[80px] resize-none"
                    />
                  </div>
                  <div className="flex items-center space-x-2 border-t pt-3">
                    <Checkbox
                      id="fieldInclude"
                      checked={editedField.active}
                      onCheckedChange={(checked) => setEditedField({ ...editedField, active: checked === true })}
                    />
                    <label htmlFor="fieldInclude" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Include this field in the app
                    </label>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
          <DialogFooter className="flex-shrink-0 pt-4 border-t">
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
