import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr'; 
import { cookies } from 'next/headers';

// Type for column information
interface ColumnDefinition {
  name: string;
  type: string;
  description: string;
  sampleData: string[];
}

// Helper function to infer column type from sample data
function inferColumnType(samples: string[]): string {
  // Filter out empty/null values
  const nonEmptySamples = samples.filter(s => s && s.trim() !== '');
  if (nonEmptySamples.length === 0) return 'text';

  // Calculate the number of unique values for dropdown/checkbox inference
  const uniqueValues = new Set(nonEmptySamples.map(s => s.trim()));
  const uniqueCount = uniqueValues.size;
  
  // Boolean detection (yes/no, true/false, 0/1)
  const boolPatterns = [
    ['true', 'false'],
    ['yes', 'no'],
    ['y', 'n'],
    ['0', '1'],
    ['✓', '✗'],
    ['on', 'off']
  ];
  
  if (uniqueCount <= 2) {
    const lowerSamples = nonEmptySamples.map(s => s.toLowerCase().trim());
    for (const pattern of boolPatterns) {
      if (lowerSamples.every(s => pattern.includes(s))) {
        return 'boolean';
      }
    }
  }
  
  // URL detection
  const urlPattern = /^(https?:\/\/|www\.|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,})/i;
  if (nonEmptySamples.some(s => urlPattern.test(s.trim()))) {
    return 'url';
  }
  
  // Email detection
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (nonEmptySamples.some(s => emailRegex.test(s.trim()))) {
    return 'email';
  }

  // Phone detection
  const phoneRegex = /^[\d\+\-\(\)\s\.]{6,20}$/;
  if (nonEmptySamples.every(s => phoneRegex.test(s.trim()))) {
    return 'tel';
  }

  // Date detection
  const dateRegex = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/;
  if (nonEmptySamples.some(s => dateRegex.test(s.trim()))) {
    return 'date';
  }

  // Number detection
  const numberRegex = /^-?\d+(\.\d+)?$/;
  if (nonEmptySamples.every(s => numberRegex.test(s.trim()))) {
    return 'number';
  }
  
  // Dropdown/Radio (single-select) detection
  // If we have few unique values compared to the total samples
  if (uniqueCount <= 5 && uniqueCount < nonEmptySamples.length * 0.6) {
    return 'dropdown';
  }
  
  // Checkbox group (multi-select) detection
  // Look for delimiter patterns suggesting multiple values
  const multiValuePattern = /[,;|]/;
  if (nonEmptySamples.some(s => multiValuePattern.test(s)) && uniqueCount <= 10) {
    return 'checkbox';
  }
  
  // Default to text
  return 'text';
}

export async function GET(
  request: Request,
  { params }: { params: { sheetId: string } }
) {
  try {
    // Create Supabase client using the correct pattern for API routes
    const cookieStore = await cookies();

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options) {
        cookieStore.set(name, value, options);
      },
      remove(name: string, options) {
        cookieStore.set(name, '', { ...options, maxAge: 0 });
      },
    },
  });

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Please login first" },
        { status: 401 }
      );
    }

    // Get user's Google OAuth token
    const { data: credentials, error: credentialsError } = await supabase
      .from("oauth_credentials")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", session.user.id)
      .eq("provider", "google_sheets")
      .single();

    if (credentialsError || !credentials?.access_token) {
      return NextResponse.json(
        { 
          error: "Failed to retrieve Google credentials", 
          details: credentialsError?.message || "No access token found",
          action: "reconnect" 
        },
        { status: 400 }
      );
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(credentials.expires_at);
    
    if (now > expiresAt) {
      // Token is expired, attempt to refresh
      try {
        const refreshResponse = await fetch(
          `https://yhfvwlptgkczsvemjlqr.supabase.co/functions/v1/refresh-google-token`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({
              userId: session.user.id,
              refreshToken: credentials.refresh_token
            })
          }
        );

        const refreshResult = await refreshResponse.json();
        
        if (!refreshResponse.ok || !refreshResult.access_token) {
          return NextResponse.json(
            { 
              error: "Failed to refresh Google token", 
              details: refreshResult.error || "Unknown error",
              action: "reconnect"
            },
            { status: 401 }
          );
        }
        
        // Use the new access token
        credentials.access_token = refreshResult.access_token;
      } catch (refreshError) {
        console.error("Error refreshing token:", refreshError);
        return NextResponse.json(
          { 
            error: "Failed to refresh Google token", 
            details: "Error during refresh process",
            action: "reconnect"
          },
          { status: 401 }
        );
      }
    }

    /**
     * Converts a column index to Excel-style column letters (1-based index)
     * Examples: 1 -> A, 26 -> Z, 27 -> AA, 28 -> AB, 703 -> AAA
     */
    function columnToLetter(column: number): string {
      let temp: number;
      let letter = '';
      while (column > 0) {
        temp = (column - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        column = (column - (temp + 1)) / 26;
      }
      return letter;
    }
    
    // Call Google Sheets API to get the sheet data
    const sheetId = params.sheetId;
    // Optional sheet/tab name from query string, URL-decoded
    const url = new URL(request.url);
    const sheetParam = url.searchParams.get("sheet");
    const sheetPrefix = sheetParam ? `${encodeURIComponent(sheetParam)}!` : "";
    
    // Use a wider range to support more columns (up to 500)
    const MAX_COLUMN_FETCH = 500;
    const endColumnLetter = columnToLetter(MAX_COLUMN_FETCH);
    
    // First, get the first row (headers)
    const headersResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetPrefix}A1:${endColumnLetter}1`,
      {
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          Accept: 'application/json'
        }
      }
    );

    if (!headersResponse.ok) {
      return NextResponse.json(
        { error: "Failed to retrieve sheet headers", status: headersResponse.status },
        { status: headersResponse.status }
      );
    }

    const headersData = await headersResponse.json();
    const headers = headersData.values?.[0] || [];

    // If no headers found, the sheet might be empty
    if (headers.length === 0) {
      return NextResponse.json({
        columns: [],
        isEmpty: true
      });
    }

    // Get sample data (first 5 rows after header) - using same column range as headers
    const samplesResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetPrefix}A2:${endColumnLetter}6`,
      {
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          Accept: 'application/json'
        }
      }
    );

    if (!samplesResponse.ok) {
      // Continue with just headers if we can't get samples
      const columns: ColumnDefinition[] = headers.map((header: string) => ({
        name: header,
        type: 'Text',
        description: '',
        sampleData: []
      }));

      return NextResponse.json({
        columns,
        isEmpty: false
      });
    }

    const samplesData = await samplesResponse.json();
    const sampleRows = samplesData.values || [];

    // Transform the data into column definitions with types and samples
    const columns: ColumnDefinition[] = headers.map((header: string, index: number) => {
      // Extract sample data for this column
      const sampleData = sampleRows.map((row: string[]) => row[index] || '').filter(Boolean);
      
      // Infer the column type from sample data
      const inferredType = inferColumnType(sampleData);
      
      // Return column definition with the inferred type
      return {
        name: header,
        type: inferredType,
        description: '', // Default empty description that user can fill in
        sampleData: sampleData // Keep all samples for the frontend
      };
    });

    return NextResponse.json({
      columns,
      isEmpty: false
    });
    
  } catch (error: any) {
    console.error("Error in sheet columns API:", error);
    
    return NextResponse.json(
      { error: "Failed to process request", details: error.message },
      { status: 500 }
    );
  }
}
