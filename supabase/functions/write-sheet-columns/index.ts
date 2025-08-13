// Supabase Edge Function for writing column headers, types and descriptions to a Google Sheet
// This keeps client_secret secure by handling the API calls server-side
// TypeScript declarations for development environment
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
/**
 * Converts a column index to Excel-style column letters (1-based index)
 * Examples: 1 -> A, 26 -> Z, 27 -> AA, 28 -> AB, 703 -> AAA
 */ function columnToLetter(column) {
  let temp;
  let letter = '';
  while(column > 0){
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - (temp + 1)) / 26;
  }
  return letter;
}
Deno.serve(async (req)=>{
  // Set CORS headers for browser compatibility
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json"
  };
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { userId, sheetId, columns } = await req.json();
    if (!userId || !sheetId || !columns || !Array.isArray(columns)) {
      return new Response(JSON.stringify({
        error: 'Missing required fields'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    // Initialize Supabase client
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Get user's Google tokens
    const { data: userData, error: userError } = await supabaseAdmin.from('oauth_credentials').select('access_token, refresh_token, expires_at').eq('user_id', userId).single();
    if (userError || !userData) {
      return new Response(JSON.stringify({
        error: 'User tokens not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }
    // Check if token is expired and refresh if needed
    let accessToken = userData.access_token;
    const expiresAt = new Date(userData.expires_at);
    if (expiresAt < new Date()) {
      // Token is expired, refresh it
      const refreshResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/refresh-google-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          userId,
          refreshToken: userData.refresh_token
        })
      });
      const refreshResult = await refreshResponse.json();
      const { updatedToken, error: refreshError } = refreshResult;
      if (!refreshResponse.ok || refreshError) {
        return new Response(JSON.stringify({
          error: 'Failed to refresh token',
          message: refreshError
        }), {
          status: 401,
          headers: corsHeaders
        });
      }
      accessToken = updatedToken;
    }
    // First, fetch existing sheet data (just headers)
    const MAX_COLUMN_FETCH = 500; // Arbitrary limit for reasonable fetching
    const fetchEndColumn = columnToLetter(MAX_COLUMN_FETCH);
    // Fetch the first row (headers only)
    const existingDataResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:${fetchEndColumn}1`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    if (!existingDataResponse.ok) {
      return new Response(JSON.stringify({
        error: 'Failed to fetch existing sheet data',
        message: 'Could not retrieve current sheet columns'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
    const existingData = await existingDataResponse.json();
    const existingValues = existingData.values || [];
    // Extract existing headers
    const existingHeaders = existingValues[0] || [];
    // Create a map of existing column names to their indices
    const existingColumnMap = new Map();
    existingHeaders.forEach((header, index)=>{
      if (header && header.trim() !== '') {
        existingColumnMap.set(header, index);
      }
    });
    // Non-destructive mode:
    // - Preserve existing order
    // - Rename in place using originalIndex when available (or existing name match)
    // - Append truly new fields at the end
    // - Do not clear/delete extras by default
    const resultHeaders: string[] = existingHeaders.slice();
    const placedNames = new Set<string>();
    let updatedInPlace = 0;

    for (const col of columns) {
      const name = (col?.name ?? '').toString();
      // Prefer provided originalIndex to keep the sheet's established positions stable
      const oi = Number.isFinite(col?.originalIndex) ? Number(col.originalIndex) : NaN;
      if (!isNaN(oi) && oi >= 0 && oi < resultHeaders.length) {
        resultHeaders[oi] = name;
        placedNames.add(name);
        updatedInPlace++;
        continue;
      }
      // Fallback: if a column with this name already exists, rename in place
      const existingIndex = existingColumnMap.get(name);
      if (existingIndex !== undefined) {
        resultHeaders[existingIndex] = name;
        placedNames.add(name);
        updatedInPlace++;
        continue;
      }
      // Else: will append later
    }

    const toAppend = columns
      .filter((c: any) => {
        const name = (c?.name ?? '').toString();
        return !placedNames.has(name) && !existingColumnMap.has(name);
      })
      .map((c: any) => (c?.name ?? '').toString());

    const finalHeaders = resultHeaders.concat(toAppend);
    const endColumnLetter = columnToLetter(finalHeaders.length);
    const values = [finalHeaders];

    // Write the header row with the computed non-destructive order
    const sheetResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:${endColumnLetter}1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values
      })
    });
    const sheetData = await sheetResponse.json();
    if (!sheetResponse.ok) {
      return new Response(JSON.stringify({
        error: 'Failed to update sheet',
        message: sheetData.error?.message || 'Google Sheets API error'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
    return new Response(JSON.stringify({
      success: true,
      mode: 'non_destructive',
      updatedInPlace,
      appendedCount: toAppend.length,
      finalCount: finalHeaders.length,
      updatedRange: sheetData.updatedRange,
      updatedRows: sheetData.updatedRows,
      updatedColumns: sheetData.updatedColumns
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: errorMessage
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
