// Utility file for shared CORS headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Supabase-Service-Role-Key',
  'Access-Control-Max-Age': '86400', // 24 hours in seconds
};

// Helper function to handle OPTIONS preflight requests
export function handleCorsPreflightRequest(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  return null;
}
