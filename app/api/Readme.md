# Praxis AI - API Documentation and Implementation Prompts

## Public Sheet Row Insertion API

### Overview
This API allows v0-generated apps to securely write data to a user's Google Sheet without requiring explicit API keys or OAuth tokens in the app code.

### Implementation Prompt

```
Create a secure API endpoint for adding rows to Google Sheets that can be safely called from public v0-generated apps. The API should:

1. Use URL-based authentication with a unique app ID and secret path segment:
   - Format: /api/public/forms/{appId}/{pathSecret}/submit
   - Both segments should be randomly generated with sufficient entropy (at least 32 bytes for pathSecret)

2. Validate requests by checking the appId and pathSecret combination in the database:
   - Query the sheet_apps table to verify legitimacy
   - Return 403 Forbidden if invalid

3. Retrieve the sheet owner's Google OAuth credentials:
   - Get the user_id from the validated app record
   - Query oauth_credentials for their Google access token
   - Handle token refresh if expired (reuse logic from columns API)

4. Process and validate form data:
   - Validate incoming data against expected column structure
   - Perform type checking and sanitization
   - Ensure required fields are present

5. Write data to Google Sheets:
   - Use the spreadsheets.values.append method
   - Set valueInputOption=USER_ENTERED for proper formula handling
   - Include proper error handling and retry logic

6. Add security measures:
   - Implement rate limiting (max 60 requests per minute per app)
   - Add request logging for audit purposes
   - Set appropriate CORS headers for v0 app domains

7. Create database schema:
   - Add sheet_apps table with app_id, path_secret, user_id, sheet_id columns
   - Add appropriate indexes and constraints

Handle potential errors gracefully with appropriate HTTP status codes and response messages.
```

### Database Schema Creation Prompt

```
Create a new Supabase migration file that adds a `sheet_apps` table to store information about v0-generated apps and their secure access paths. Include:

1. A primary key UUID column
2. An app_id column (random UUID, indexed for fast lookups)
3. A path_secret column (random string for URL authentication)
4. A user_id column (references auth.users)
5. A sheet_id column (Google Sheet ID)
6. A name column for the app
7. A created_at timestamp column
8. An updated_at timestamp column
9. An active boolean column (to enable/disable access)
10. A last_used timestamp column

Add RLS policies to ensure users can only access their own app records.

Include a function to generate a new app record with random app_id and path_secret when a user creates a new v0 app.
```

### Client Integration Prompt

```
Create a function that generates the secure submission URL for a v0-generated app during the app creation process. The function should:

1. Call the database function to create a new sheet_app record
2. Format the URL as `/api/public/forms/{appId}/{pathSecret}/submit`
3. Return this URL for inclusion in the v0 prompt

Then update the v0 prompt template to include this submission URL in the generated app code. The app should simply POST form data to this URL without needing any additional authentication or API keys.
```

### Testing Prompt

```
Write comprehensive tests for the secure form submission API that verify:

1. Valid appId and pathSecret combinations are accepted
2. Invalid combinations are rejected with appropriate error messages
3. Expired Google tokens are refreshed correctly
4. Rate limiting properly prevents abuse
5. Data is correctly written to the Google Sheet
6. Error conditions (like network failures) are handled gracefully

Use Jest and supertest for the implementation.
```

## Security Considerations

- The pathSecret should be treated as sensitive information
- Consider implementing expiring or rotating secrets for long-term security
- Add monitoring for unusual patterns of API usage
- Consider implementing IP-based blocking for repeated invalid requests
