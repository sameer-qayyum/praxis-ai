# V0 + Vercel Integration API

## Overview

This API provides a seamless integration between v0 AI app generation and Vercel deployment for the Praxis AI platform. It allows users to:

1. Generate a web application using v0 AI by providing a prompt message
2. Deploy the generated application to Vercel automatically
3. Store the application details in the database for future reference
4. Support redeployment of existing applications

## Authentication

This API requires a valid Supabase session. The user must be logged in to access this endpoint.

## API Endpoint

```
POST /api/v0/generate
```

## Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | Yes* | The prompt message describing the application to generate |
| `name` | string | Yes | The name of the application/project |
| `templateId` | string | No | Optional template ID to use as a base |
| `googleSheetId` | string | No | Optional Google Sheet ID to connect with the app |
| `chatId` | string | No | Optional existing v0 chat ID for redeployment |
| `vercelProjectId` | string | No | Optional existing Vercel project ID for redeployment |

*Either `message` or `chatId` must be provided.

### Example Request

```json
// New application generation
{
  "message": "Create a todo list app with React and TypeScript",
  "name": "Todo App"
}

// Redeployment
{
  "chatId": "chat_1234567890",
  "vercelProjectId": "prj_1234567890",
  "name": "Todo App"
}
```

## Response

### Success Response

```json
{
  "success": true,
  "appId": "12345-67890-abcde",
  "chatId": "chat_1234567890",
  "v0ProjectId": "prj_v0_1234567890",
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
| 400 | Bad request (missing required fields) |
| 401 | Unauthorized (user not logged in) |
| 404 | Resource not found (e.g., chat not found) |
| 500 | Server error (API key missing, deployment failed, etc.) |

## Flow

1. **Authentication**: Verify the user is logged in via Supabase session
2. **Parameter Validation**: Ensure required parameters are provided
3. **Chat Handling**: 
   - Create a new chat with v0 API using the provided message, or
   - Retrieve an existing chat using the provided chat ID
4. **Project Creation** (for new deployments):
   - Create a v0 project
   - Assign the chat to the project
5. **File Processing**:
   - Extract files from the v0 chat response
   - Add missing essential files (package.json, config files, etc.)
6. **Vercel Integration**:
   - Create a Vercel project via v0 integration (for new deployments)
   - Deploy the processed files to Vercel
7. **Database Storage**:
   - Store the application details in the database
8. **Response**: Return the deployment details

## Examples

### Creating a New Application

```javascript
const response = await fetch('/api/v0/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "Create a weather app with a search bar that fetches real-time weather data for any city",
    name: "Weather Forecaster"
  })
});

const result = await response.json();
console.log(`App deployed at: ${result.url}`);
```

### Redeploying an Existing Application

```javascript
const response = await fetch('/api/v0/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    chatId: "existing_chat_id",
    vercelProjectId: "existing_vercel_project_id",
    name: "Weather Forecaster V2"
  })
});

const result = await response.json();
console.log(`App redeployed at: ${result.url}`);
```

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
