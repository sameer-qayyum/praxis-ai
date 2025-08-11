import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Database, Sliders, RefreshCw } from "lucide-react";
import { SheetDataView } from "./SheetDataView";
import { SheetFieldManager } from "./SheetFieldManager";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGoogleSheets } from "@/context/GoogleSheetsContext";
import { toast } from "@/components/ui/use-toast";
import { createClient } from "@/lib/supabase/client";

interface GoogleSheetPanelProps {
  app: {
    id: string;
    google_sheet?: string;
  };
}

export const GoogleSheetPanel: React.FC<GoogleSheetPanelProps> = ({ app }) => {
  const [activeTab, setActiveTab] = useState<string>("data");
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState<boolean>(false);
  const [fieldsVersion, setFieldsVersion] = useState<number>(0);
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { writeSheetColumns } = useGoogleSheets();
  
  // Track field changes
  const [modifiedFields, setModifiedFields] = useState<any[] | null>(null);
  
  // Handle field changes
  const handleFieldChanges = (changed: boolean, fields?: any[]) => {
    setHasChanges(changed);
    if (fields) {
      setModifiedFields(fields);
    }
  };

  // Save field changes mutation
  const saveFieldsMutation = useMutation({
    mutationFn: async () => {
      if (!app?.id) throw new Error("App ID not available");
      
      // Use the modified fields if available, otherwise fall back to query cache
      let columnsToSave;
      
      if (modifiedFields) {
        console.log('GoogleSheetPanel: Using modified fields from state:', modifiedFields);
        columnsToSave = modifiedFields;
      } else {
        // Fall back to query cache
        const fieldsData = queryClient.getQueryData<{ columns: any[] }>(["sheet-columns", app.id]);
        if (!fieldsData?.columns) throw new Error("No field data available");
        columnsToSave = fieldsData.columns;
        console.log('GoogleSheetPanel: Using fields from cache:', columnsToSave);
      }
      
      // Ensure boolean values are explicitly set
      const columnsWithExplicitBooleans = columnsToSave.map(col => ({
        ...col,
        active: col.active === true // Force explicit boolean conversion
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
            columns: columnsWithExplicitBooleans,
            updateGlobal: true
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to update columns: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      // Also write columns to the actual Google Sheet if available
      try {
        if (app?.google_sheet) {
          // app.google_sheet is a connection ID, resolve to actual sheet_id
          const { data: connection, error: connErr } = await supabase
            .from('google_sheets_connections')
            .select('sheet_id')
            .eq('id', app.google_sheet)
            .single();
          if (connErr) {
            console.error('Failed to fetch google_sheets_connections:', connErr);
          } else if (connection?.sheet_id) {
            await writeSheetColumns(connection.sheet_id, columnsWithExplicitBooleans);
          } else {
            console.warn('No sheet_id found for connection id:', app.google_sheet);
          }
        }
      } catch (sheetErr) {
        console.error("Failed to write columns to Google Sheet:", sheetErr);
        // Do not throw here; metadata saved already. Surface via toast in onError if needed.
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Field metadata has been saved successfully.");
      setHasChanges(false);
      setModifiedFields(null);
      // Refresh SheetFieldManager's data so it resets originalFields
      queryClient.invalidateQueries({ queryKey: ["sheet-columns", app?.id] });
      // Force remount of SheetFieldManager to clear local state immediately
      setFieldsVersion((v) => v + 1);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save fields: ${error.message}`);
    }
  });

  // Save field changes without regenerating the app
  const handleSaveFieldsOnly = async () => {
    try {
      await saveFieldsMutation.mutateAsync();
    } catch (error) {
      console.error("Failed to save field changes:", error);
    }
  };

  // Regenerate app mutation
  const regenerateAppMutation = useMutation({
    mutationFn: async () => {
      if (!app?.id) throw new Error("App ID not available");
      
      // First save the fields
      await saveFieldsMutation.mutateAsync();
      
      // Then call the regenerate API
      const response = await fetch(
        `/api/apps/${app.id}/regenerate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to regenerate app: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Your app is being regenerated with the updated field configurations.");
      setShowRegenerateDialog(false);
      setHasChanges(false);
      
      // Invalidate app query data to refresh
      queryClient.invalidateQueries({
        queryKey: ["app", app?.id],
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to regenerate app: ${error.message}`);
    }
  });

  // Save field changes and regenerate the app
  const handleRegenerateApp = async () => {
    await regenerateAppMutation.mutateAsync();
  };

  return (
    <div className="relative flex flex-col h-full min-h-0">
      <Tabs 
        defaultValue="data" 
        value={activeTab} 
        onValueChange={setActiveTab} 
        className="flex-1 flex flex-col overflow-hidden min-h-0"
      >
        <div className="border-b px-4 bg-white dark:bg-slate-800">
          <TabsList>
            <TabsTrigger value="data">
              <Database className="h-4 w-4 mr-1" />
              Sheet Data
            </TabsTrigger>
            <TabsTrigger value="fields">
              <Sliders className="h-4 w-4 mr-1" />
              Field Management
            </TabsTrigger>
          </TabsList>
        </div>
        
        {/* Sheet Data Tab */}
        <TabsContent value="data" className="flex-1 p-0 overflow-hidden min-h-0">
          <div className={`h-full overflow-auto ${hasChanges ? 'pb-24' : ''}`}>
            <SheetDataView app={app} />
          </div>
        </TabsContent>
        
        {/* Field Management Tab */}
        <TabsContent value="fields" className="flex-1 p-0 overflow-hidden min-h-0">
          <div className={`h-full overflow-auto ${hasChanges ? 'pb-24' : ''}`}>
            <SheetFieldManager 
              key={fieldsVersion}
              app={app}
              onFieldChange={handleFieldChanges}
            />
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Update prompt when changes detected - fixed footer */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 border-t p-4 bg-amber-50 dark:bg-amber-900/20 flex justify-between items-center z-20">
          <div>
            <p className="font-medium">Field changes detected</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Update your app to apply these changes?</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleSaveFieldsOnly}
              disabled={saveFieldsMutation.isPending}
            >
              {saveFieldsMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Fields Only"
              )}
            </Button>
            <Button 
              onClick={() => setShowRegenerateDialog(true)}
              disabled={saveFieldsMutation.isPending}
            >
              Save & Regenerate App
            </Button>
          </div>
        </div>
      )}
      
      {/* Regeneration Confirmation Dialog */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate App</DialogTitle>
            <DialogDescription>
              This will update your field metadata and regenerate your app with the new field configurations.
              Any custom changes you've made to the app will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button 
              onClick={handleRegenerateApp}
              disabled={regenerateAppMutation.isPending}
            >
              {regenerateAppMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                "Regenerate App"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
