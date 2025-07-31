import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Simple rate limiting implementation that can be replaced with Redis in production
const rateLimits = new Map<string, { count: number, reset: number }>();

function checkRateLimit(identifier: string, limit: number, windowSeconds: number): { allowed: boolean; remaining: number; reset: number } {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);
  const windowEnd = windowStart + windowSeconds;
  const key = `${identifier}:${windowStart}`;
  
  if (!rateLimits.has(key)) {
    rateLimits.set(key, { count: 1, reset: windowEnd });
    
    // Clean up old entries (this would be done by TTL in Redis)
    for (const [existingKey, data] of rateLimits.entries()) {
      if (data.reset < now) {
        rateLimits.delete(existingKey);
      }
    }
    
    return { allowed: true, remaining: limit - 1, reset: windowEnd };
  }
  
  const limitData = rateLimits.get(key)!;
  limitData.count++;
  
  return { 
    allowed: limitData.count <= limit, 
    remaining: Math.max(0, limit - limitData.count), 
    reset: windowEnd 
  };
}

// Defining the handler with the exact Next.js expected signature
export const POST = async (
  request: Request,
  { params }: { params: { appId: string; pathSecret: string } }
) => {
  try {
    const { appId, pathSecret } = params;
    
    // Simple rate limiting - 100 requests per hour per appId
    const rateLimit = checkRateLimit(`form-submit:${appId}`, 100, 3600);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded", 
          reset: new Date(rateLimit.reset * 1000).toISOString()
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.reset.toString()
          }
        }
      );
    }
    
    // Create Supabase client with service role for backend operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Validate the appId and pathSecret combination using the apps table
    const { data: appData, error: appError } = await supabase
      .from('apps')
      .select('id, google_sheet, created_by')
      .eq('id', appId)
      .eq('path_secret', pathSecret)
      .single();
    
    if (appError || !appData) {
      console.log('Invalid app or secret:', { appId, error: appError });
      return NextResponse.json(
        { error: "Form not found or unauthorized" },
        { status: 403 }
      );
    }
    
    // Get the sheet connection to get the sheet_id
    const { data: sheetConnection, error: sheetError } = await supabase
      .from('google_sheets_connections')
      .select('sheet_id')
      .eq('id', appData.google_sheet)
      .single();
    
    if (sheetError || !sheetConnection) {
      console.error('Sheet connection not found:', sheetError);
      return NextResponse.json(
        { error: "Unable to process submission at this time" },
        { status: 500 }
      );
    }
    
    const sheetId = sheetConnection.sheet_id;
    
    // Get form data from request body
    const formData = await request.json().catch(() => null);
    if (!formData || typeof formData !== 'object') {
      return NextResponse.json(
        { error: "Invalid form data" },
        { status: 400 }
      );
    }
    
    // Instead of duplicating the Google Sheets API logic, use the existing append API
    // This ensures we're using the same token refresh, validation, and append logic
    const appendResponse = await fetch(
      `${request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL}/api/sheets/${sheetId}/append`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Use the service role key to bypass authentication
          'x-supabase-service-role-key': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'x-user-id': appData.created_by // Pass the sheet owner's user ID
        },
        body: JSON.stringify({
          data: formData
        })
      }
    );

    const appendResult = await appendResponse.json();
    
    if (!appendResponse.ok) {
      console.error('Append API error:', appendResult);
      
      
      return NextResponse.json(
        { error: appendResult.error || "Failed to submit form data" },
        { status: appendResponse.status }
      );
    }
    

    // Return success response
    return NextResponse.json({
      success: true,
      message: "Form submitted successfully",
    });
    
  } catch (error: any) {
    console.error("Error in public form submit API:", error);
    
    return NextResponse.json(
      { error: "Unable to process submission at this time" },
      { status: 500 }
    );
  }
}
