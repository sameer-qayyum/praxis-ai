import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Define proper types for the sheet data API response
interface SheetDataResponse {
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface SheetDataViewProps {
  app: {
    id: string;
    google_sheet?: string;
  };
}

export const SheetDataView: React.FC<SheetDataViewProps> = ({ app }) => {
  // State for pagination and filtering
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const supabase = createClient();

  // Fetch sheet data with enhanced caching to prevent 429 rate limit errors
  const {
    data: sheetData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<SheetDataResponse | null>({
    queryKey: ["sheet-data", app?.google_sheet, page, pageSize, searchTerm],
    queryFn: async () => {
      if (!app?.google_sheet) return null;

      // First get the sheet_id from google_sheets_connections
      const { data: connection, error: connectionError } = await supabase
        .from("google_sheets_connections")
        .select("sheet_id")
        .eq("id", app.google_sheet)
        .single();

      if (connectionError || !connection?.sheet_id) {
        throw new Error(
          connectionError?.message || "Failed to find sheet connection"
        );
      }

      // Build query parameters for pagination and search
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (searchTerm) {
        queryParams.append("search", searchTerm);
      }

      // Create a specialized endpoint for the frontend to use
      // We need to pass the app.id (not google_sheet) since the API endpoint identifies apps by their ID
      const apiUrl = `/api/dashboard/sheets/${app.id}/data?${queryParams.toString()}`;
      
      try {
        const response = await fetch(apiUrl);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API Error (${response.status}):`, errorText);
          throw new Error(
            `Failed to fetch sheet data: ${response.status} ${response.statusText}`
          );
        }

        return await response.json();
      } catch (error) {
        console.error("Error in SheetDataView fetch:", error);
        throw error;
      }
    },
    enabled: !!app?.google_sheet,
    // Enhanced caching to prevent 429 errors
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (previously called cacheTime)
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    retry: (failureCount, error: any) => {
      // Don't retry on 404s or other client errors, but do retry on rate limits
      if (error?.message?.includes('429')) {
        return failureCount < 3; // Retry up to 3 times for rate limit errors
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000) // Exponential backoff
  });

  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(!!searchTerm);
    setPage(1); // Reset to first page on new search
    refetch();
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm("");
    setIsSearching(false);
    refetch();
  };

  // Calculate total pages
  const totalPages = sheetData?.totalRows
    ? Math.ceil(sheetData.totalRows / pageSize)
    : 0;

  return (
    <div className="p-4 flex flex-col h-full">
      {/* Search and filter controls */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 justify-between">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="text"
              placeholder="Search sheet data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" size="sm">
            Search
          </Button>
          {isSearching && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearSearch}
            >
              Clear
            </Button>
          )}
        </form>

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
            Refresh
          </Button>
        </div>
      </div>

      {/* Active filters display */}
      {isSearching && (
        <div className="mb-4 flex items-center text-sm text-gray-500">
          <Filter className="h-3.5 w-3.5 mr-1" />
          <span>
            Filtering by: <strong>{searchTerm}</strong>
          </span>
        </div>
      )}

      {/* Data table */}
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          <span>Loading sheet data...</span>
        </div>
      ) : isError ? (
        <div className="p-4 border rounded-lg bg-red-50 text-red-700 my-4">
          <p>Failed to load sheet data:</p>
          <p className="font-mono text-sm">
            {(error as Error)?.message || "Unknown error"}
          </p>
        </div>
      ) : sheetData && sheetData.rows && sheetData.rows.length > 0 ? (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  {sheetData?.headers?.map((header: string) => (
                    <TableHead key={header}>{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheetData && sheetData.rows.map((row: any, index: number) => (
                  <TableRow key={`row-${index}`}>
                    {sheetData && sheetData.headers.map((header: string) => (
                      <TableCell key={`${index}-${header}`} className="truncate max-w-[200px]">
                        {row[header] || ""}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {sheetData?.totalRows
                ? `Showing ${(page - 1) * pageSize + 1}-${
                    Math.min(page * pageSize, sheetData.totalRows)
                  } of ${sheetData.totalRows} rows`
                : ""}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 rows</SelectItem>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="20">20 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-40 border rounded-lg bg-gray-50">
          <p className="text-gray-500">No data found in this sheet</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => refetch()}
          >
            Refresh Data
          </Button>
        </div>
      )}
    </div>
  );
};
