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
    chat_id?: string;
    name?: string;
    data_model?: string;
  };
  handleRegenerateApp?: (saveFieldsPromise: Promise<void>) => void;
}

export const GoogleSheetPanel: React.FC<GoogleSheetPanelProps> = ({ app, handleRegenerateApp }) => {
  const [activeTab, setActiveTab] = useState<string>("data");
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [updateGlobal, setUpdateGlobal] = useState<boolean>(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState<boolean>(false);
  const [fieldsVersion, setFieldsVersion] = useState<number>(0);
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { writeSheetColumns } = useGoogleSheets();
  
  // Track field changes
  const [modifiedFields, setModifiedFields] = useState<any[] | null>(null);
  
  // Handle field changes
  const handleFieldChanges = (changed: boolean, fields?: any[], updateGlobalToggle?: boolean) => {
    setHasChanges(changed);
    if (fields) {
      setModifiedFields(fields);
    }
    if (typeof updateGlobalToggle === 'boolean') {
      setUpdateGlobal(updateGlobalToggle);
    }
  };

  // Save field changes mutation
  const saveFieldsMutation = useMutation({
    mutationFn: async () => {
      if (!app?.id) throw new Error("App ID not available");
      
      // Use the modified fields if available, otherwise fall back to query cache
      let columnsToSave;
      
      if (modifiedFields) {
        columnsToSave = modifiedFields;
      } else {
        // Fall back to query cache
        const fieldsData = queryClient.getQueryData<{ columns: any[] }>(["sheet-columns", app.id]);
        if (!fieldsData?.columns) throw new Error("No field data available");
        columnsToSave = fieldsData.columns;
      }
      
      // Final defensive filter: never persist preview-removed rows
      const columnsSansRemoved = (columnsToSave || []).filter((col: any) => !String(col?.id || '').startsWith('removed:'));

      // Ensure boolean values are explicitly set
      const columnsWithExplicitBooleans = columnsSansRemoved.map(col => ({
        ...col,
        active: col.active === true // Force explicit boolean conversion
      }));

      // Call our dashboard sheets columns API to update (local app data_model only for 'Save Fields Only')
      const response = await fetch(
        `/api/dashboard/sheets/${app.id}/columns`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            columns: columnsWithExplicitBooleans,
            updateGlobal: updateGlobal
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to update columns: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      const makeNamesAndChecksum = (cols: any[]) => {
        const names = Array.isArray(cols) ? cols.map((c: any) => c?.name) : [];
        const checksum = `${names.length}:${names[0] ?? ''}:${names[names.length - 1] ?? ''}`;
        return { names, checksum };
      };

      // After saving, re-fetch canonical columns from the server and write those to the actual Google Sheet if available
      try {
        if (app?.google_sheet) {
          // Re-fetch to ensure we use the canonical, server-saved version
          const refreshed = await fetch(`/api/dashboard/sheets/${app.id}/columns?t=${Date.now()}`);
          const refreshedData = refreshed.ok ? await refreshed.json() : { columns: columnsWithExplicitBooleans, source: 'fallback' };
          const { names: refNames, checksum: refChecksum } = makeNamesAndChecksum(refreshedData.columns || []);

          // app.google_sheet is a connection ID, resolve to actual sheet_id
          const { data: connection, error: connErr } = await supabase
            .from('google_sheets_connections')
            .select('sheet_id')
            .eq('id', app.google_sheet)
            .single();
          if (connErr) {
            console.error('[FieldsSave] Failed to fetch google_sheets_connections', connErr);
          } else if (connection?.sheet_id) {
            const { names: writeNames, checksum: writeChecksum } = makeNamesAndChecksum(refreshedData.columns || []);
          } else {
            console.warn('[FieldsSave] No sheet_id found for connection id', app.google_sheet);
          }
        }
      } catch (sheetErr) {
        console.error('[FieldsSave] Failed to write columns to Google Sheet', sheetErr);
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

  // Prepare for regenerating the app by passing the saveFields promise to parent
  const prepareRegenerateApp = async () => {
    try {
      setShowRegenerateDialog(false);
      if (handleRegenerateApp) {
        // Create a promise that will save fields
        const saveFieldsPromise = saveFieldsMutation.mutateAsync();
        
        // Pass this promise to the parent component's handleRegenerateApp function
        handleRegenerateApp(saveFieldsPromise);
        
        // After everything is done, reset local state
        await saveFieldsPromise;
        setHasChanges(false);
      } else {
        console.warn("handleRegenerateApp function not provided to GoogleSheetPanel");
        toast.error("App regeneration is not available");
      }
    } catch (error) {
      console.error("Failed to prepare for app regeneration:", error);
    }
  };

  // Save field changes without regenerating the app
  const handleSaveFieldsOnly = async () => {
    try {
      await saveFieldsMutation.mutateAsync();
    } catch (error) {
      console.error("Failed to save field changes:", error);
    }
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
              variant="default" 
              onClick={prepareRegenerateApp}
              disabled={!handleRegenerateApp}
            >
              {saveFieldsMutation.isPending ? (
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
