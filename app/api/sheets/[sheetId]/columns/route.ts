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
  if (!samples || samples.length === 0) return 'Text';

  // Check for email pattern in the first few non-empty samples
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (samples.some(s => s && emailRegex.test(s))) return 'Email';

  // Check for phone pattern
  const phoneRegex = /^[\d\+\-\(\)\s\.]+$/;
  const potentialPhones = samples.filter(s => s && s.trim().length > 0);
  if (potentialPhones.length > 0 && potentialPhones.every(s => phoneRegex.test(s))) return 'Phone';

  // Check for dates
  const dateRegex = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/;
  if (samples.some(s => s && dateRegex.test(s))) return 'Date';

  // Check if all samples are numbers
  const numberRegex = /^-?\d+(\.\d+)?$/;
  if (samples.some(s => s && numberRegex.test(s))) return 'Number';

  // Default to text
  return 'Text';
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
          `${process.env.SUPABASE_URL}/functions/v1/refresh-google-token`,
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

    // Call Google Sheets API to get the sheet data
    const sheetId = params.sheetId;
    
    // First, get the first row (headers)
    const headersResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z1`,
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

    // Get sample data (first 5 rows after header)
    const samplesResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A2:Z6`,
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
      
      return {
        name: header,
        type: inferColumnType(sampleData),
        description: '', // Default empty description that user can fill in
        sampleData: sampleData.slice(0, 3) // Limit to 3 samples
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
