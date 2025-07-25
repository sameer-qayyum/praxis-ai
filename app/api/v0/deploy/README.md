# V0 + Vercel Deployment API

## Overview

This API handles the deployment of v0-generated applications to Vercel. It's designed to be called after the generation process is complete and the user has finalized their application through interaction with the v0 chat interface. The API:

1. Takes a v0 chat ID that contains the finalized application code
2. Extracts the files from the v0 chat response
3. Adds any missing essential files needed for Next.js deployment
4. Creates a new Vercel project or uses an existing one
5. Deploys the files to Vercel
6. Stores the deployment information in the database

## Authentication

This API requires a valid Supabase session. The user must be logged in to access this endpoint.

## API Endpoint

```
POST /api/v0/deploy
```

## Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chatId` | string | Yes | The v0 chat ID containing the finalized application code |
| `name` | string | Yes | The name of the application/project |
| `projectId` | string | No | The v0 project ID (if not provided, will try to find it in the database) |
| `googleSheetId` | string | No | Optional Google Sheet ID to associate with the app |
| `templateId` | string | No | Optional template ID to associate with the app |
| `vercelProjectId` | string | No | Optional existing Vercel project ID for redeployment |

### Example Request

```json
// New deployment
{
  "chatId": "chat_1234567890",
  "name": "Todo App",
  "projectId": "prj_1234567890",
  "googleSheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
}

// Redeployment
{
  "chatId": "chat_1234567890",
  "name": "Todo App",
  "vercelProjectId": "prj_vercel_1234567890"
}
```

## Response

### Success Response

```json
{
  "success": true,
  "appId": "12345-67890-abcde",
  "chatId": "chat_1234567890",
  "v0ProjectId": "prj_1234567890",
  "vercelProjectId": "prj_vercel_1234567890",
  "projectName": "Todo App",
  "url": "https://todo-app-12345.vercel.app",
  "filesDeployed": 12,
  "deploymentId": "dpl_1234567890",
  "isRedeployment": false
}
```

### Error Response

```json
{
  "error": "Error message describing what went wrong"
}
```

## Error Codes

| Status | Description |
|--------|-------------|
| 400 | Bad request (missing required fields or no project ID found) |
| 401 | Unauthorized (user not logged in) |
| 404 | Resource not found (e.g., chat not found) |
| 500 | Server error (API key missing, deployment failed, etc.) |

## Flow

1. **Authentication**: Verify the user is logged in via Supabase session
2. **Parameter Validation**: Ensure required parameters are provided
3. **Project ID Resolution**: 
   - Use provided project ID or
   - Look up project ID from the database using chat ID
4. **File Processing**:
   - Extract files from the v0 chat response
   - Add missing essential files (package.json, config files, etc.)
5. **Vercel Integration**:
   - Create a Vercel project via v0 integration (for new deployments)
   - Deploy the processed files to Vercel
6. **Database Storage**:
   - Store or update the application details in the database
7. **Response**: Return the deployment details

## Examples

### Deploying a New Application

```javascript
const response = await fetch('/api/v0/deploy', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    chatId: "chat_1234567890",
    name: "Weather Forecaster",
    projectId: "prj_1234567890"
  })
});

const result = await response.json();
console.log(`App deployed at: ${result.url}`);
```

### Redeploying an Existing Application

```javascript
const response = await fetch('/api/v0/deploy', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    chatId: "chat_1234567890",
    name: "Weather Forecaster V2",
    vercelProjectId: "prj_vercel_1234567890"
  })
});

const result = await response.json();
console.log(`App redeployed at: ${result.url}`);
```

## Google Sheets Integration

If a `googleSheetId` is provided, the deployed app will be associated with this Google Sheet in the database. This allows the app to access the Google Sheet data through the Praxis API endpoints.

## Environment Variables

This API requires the following environment variables to be set:

- `V0_API_KEY`: API key for v0 AI platform
- `VERCEL_TOKEN`: Token for Vercel API access
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase URL for authentication and database
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY`: Supabase public key

## Security Considerations

1. API keys are never exposed to the client
2. Only authenticated users can access the API
3. Database records are linked to the user ID for proper access control
4. Error messages are sanitized to avoid exposing sensitive information
