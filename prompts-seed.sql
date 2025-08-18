-- Sample prompts for the database-driven prompt system
-- Insert these into your Supabase prompts table

INSERT INTO prompts (type, system_prompt, user_prompt, short_code) VALUES 

-- Base prompt
('base', 'You are building a web application using React, Next.js, and Tailwind CSS. Focus on creating clean, modern, and responsive designs with excellent user experience.', 'Create a modern web application', 'BASE'),

-- API Write Access
('api_write', 'SECURE FORM SUBMISSION API:

To submit form data to the Google Sheet, use this secure endpoint:

POST ${process.env.NEXT_PUBLIC_SITE_URL}/api/public/forms/${app.id}/${app.path_secret}/submit

This endpoint accepts form data and writes it to the connected Google Sheet. Include proper error handling and user feedback for successful submissions.', 'Add form submission to Google Sheets', 'API_WRITE'),

-- API Read Access  
('api_read', 'SECURE DATA RETRIEVAL API:

To read data from the Google Sheet, use this secure endpoint:

GET ${process.env.NEXT_PUBLIC_SITE_URL}/api/public/forms/${app.id}/${app.path_secret}/data

This endpoint returns the sheet data with the following structure:

{
  headers: string[],          // Array of column headers
  rows: Array<object>,        // Array of row objects with headers as keys
  totalRows: number,          // Total number of rows in sheet
  filteredRows?: number,     // Number of rows after filtering (if filtered)
  page: number,              // Current page number
  pageSize: number,          // Number of rows per page
  totalPages: number         // Total number of pages
}

Example: To sort data client-side, use: response.rows.sort((a, b) => {...})

You can filter rows by adding query parameters that match column names, e.g. ?filter[name]=John&filter[status]=active

Pagination is supported via ?page=2&pageSize=50 parameters (default page size is 50, max is 1000)

Sorting is supported via ?sort=columnName:asc or ?sort=columnName:desc

Rate limits apply (100 requests per hour per app).', 'Add data reading from Google Sheets', 'API_READ'),

-- Sheet Handling
('sheet_handling', 'When interacting with the sheet, ensure all columns are maintained in their original order, even inactive ones (set inactive values to empty string or null when writing).', 'Handle Google Sheet data properly', 'SHEET_HANDLING'),

-- Authentication (already exists in your sample data)
('auth', 'AUTHENTICATION REQUIREMENTS:

This app requires users to be authenticated before accessing content. Implement authentication as follows:

IMPORTANT: DO NOT create any API routes or mock authentication endpoints. Use the existing remote authentication API only.

1. Authentication Check API:

GET ${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/check

Include credentials in the request:
- fetch(..., { credentials: ''include'' })
- This ensures cookies are sent with the request

2. API Response Format:

Success Response (200 OK):
{
  "authenticated": true,
  "authorized": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com"
  },
  "permission": "admin" // or "editor", "viewer"
}

Unauthenticated Response (401 Unauthorized):
{
  "authenticated": false,
  "redirectUrl": "${process.env.NEXT_PUBLIC_SITE_URL}/sign-in"
}

Unauthorized Response (403 Forbidden):
{
  "authenticated": true,
  "authorized": false,
  "message": "You do not have permission to access this app"
}

3. Implementation Requirements:

- Check authentication on initial app load
- For unauthenticated users, redirect to the login URL from the response
- For authenticated but unauthorized users, display an appropriate access denied message
- Store user info in app state for displaying user-specific content
- Permission level can be used to show/hide features based on user role

4. Error Handling:

- If authentication check fails due to network errors, show a simple "Authentication unavailable" message
- DO NOT attempt to fix authentication errors by creating mock APIs or alternative endpoints
- Authentication errors are expected in development/preview environments and should be handled gracefully

5. Example Authentication Check Implementation:

Example code:
async function checkAuth() {
  try {
    const response = await fetch(''${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/check'', {
      credentials: ''include''
    });
    const data = await response.json();
    
    if (!data.authenticated) {
      // User not authenticated, redirect to login
      window.location.href = data.redirectUrl;
      return null;
    }
    
    if (!data.authorized) {
      // User authenticated but not authorized
      // Display access denied message to user
      displayAccessDeniedMessage(data.message);
      return null;
    }
    
    // User is authenticated and authorized
    return data.user;
  } catch (error) {
    console.error(''Authentication check failed:'', error);
    // Show simple error message - DO NOT attempt to fix this
    return null;
  }
}

Call this function when the app loads and before accessing protected resources.', 'Add user authentication', 'ADD_AUTH');

-- Sheet Structure Update prompt
INSERT INTO prompts (type, system_prompt, user_prompt, short_code) VALUES 
('sheet_update', 'The Google Sheet structure has been updated. Please update the app to follow the new structure.

ACTIVE FIELDS (TO BE DISPLAYED IN THE UI):
${activeFieldsText}

COMPLETE SHEET STRUCTURE (INCLUDING ALL FIELDS):

This is the complete structure of the Google Sheet with all fields in their original order. For each field:

- id: Unique identifier for the column
- name: Column name as shown in the sheet
- type: Data type (Text, Number, Date, etc.)
- active: If true, this field should be used in the UI and API. If false, maintain the field in the sheet structure but don''t display it.
- options: For fields that have predefined options (like dropdowns)
- description: Additional information about the field
- originalIndex: The position of the column in the sheet (0-based)

ALL COLUMNS MUST BE MAINTAINED IN THE SHEET STRUCTURE, even inactive ones. For inactive fields, the generated app should just keep them blank when writing back to the sheet.

${fieldsMetadataJson}', 'Update app to match new sheet structure', 'SHEET_UPDATE');
