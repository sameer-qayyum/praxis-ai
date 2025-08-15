# V0 Deployment API

## Overview

This API handles the deployment of v0-generated applications using the official v0 SDK. It follows a clean, SDK-first approach that leverages v0's built-in Vercel integration. The API:

1. Resolves or creates a v0 project for the chat
2. Assigns the chat to the v0 project
3. Triggers deployment via v0's deployment API (which handles Vercel integration)
4. Extracts the production URL from the deployment response
5. Persists deployment metadata in the database

## Authentication

This API requires a valid Supabase session. The user must be logged in to access this endpoint.

## API Endpoint

```
POST /api/v0/deploy
```

## Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Display name for the application |
| `chatId` | string | Yes | The v0 chat ID containing the application |
| `versionId` | string | Yes | The specific version of the chat to deploy |
| `projectId` | string | No | The v0 project ID (if not provided, will create or find existing) |
| `appId` | string | No | Existing app ID for updates |
| `templateId` | string | No | Optional template ID to associate with the app |
| `googleSheetId` | string | No | Optional Google Sheet ID to associate with the app |
| `vercelProjectId` | string | No | Legacy parameter (ignored in current implementation) |

### Example Request

```json
// New deployment
{
  "name": "Todo App",
  "chatId": "nUITw2xRXIA",
  "versionId": "b_HQ5QjD7LKIK",
  "templateId": "template_123",
  "googleSheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
}

// Redeployment (existing app)
{
  "name": "Todo App",
  "chatId": "nUITw2xRXIA", 
  "versionId": "b_6Crs9xcIzdp",
  "appId": "f977c656-8f2b-45d1-a32d-1cac9985c1b5"
}
```

## Response

### Success Response

```json
{
  "success": true,
  "appId": "f977c656-8f2b-45d1-a32d-1cac9985c1b5",
  "v0ProjectId": "dNmuuiB3B5Z",
  "vercelProjectId": null,
  "url": "https://v0-praxis-sheet-2-app-hj.vercel.app",
  "deploymentId": "dpl_F5KP5hvVNoMXdCzdTwtaY5eMiaWb",
  "isRedeployment": true
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
2. **Parameter Validation**: Ensure required parameters (`name`, `chatId`, `versionId`) are provided
3. **App Record Management**: 
   - Find existing app by `appId` or `chatId` + `created_by`
   - Create new app record if none exists
4. **V0 Project Resolution**: 
   - Use provided `projectId` if available
   - Use existing `v0_project_id` from app record if available  
   - Create new v0 project via `v0.projects.create({ name })` if needed
5. **Chat Assignment**: Assign chat to project via `v0.projects.assign({ projectId, chatId })`
6. **Deployment**: Trigger deployment via v0 API (`POST /v1/deployments`)
7. **URL Extraction**: Extract production URL from deployment inspector URL
8. **Database Persistence**: Update app record with deployment metadata and set status to 'deployed'
9. **Response**: Return deployment details including production URL and deployment ID

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
