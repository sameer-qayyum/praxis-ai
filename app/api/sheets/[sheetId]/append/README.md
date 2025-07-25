# Google Sheets Append API

This API route allows you to append rows of data to a Google Sheet that a user has connected through the Praxis AI platform.

## Endpoint

```
POST /api/sheets/:sheetId/append
```

## Authentication

This endpoint requires authentication. The user must have an active session with Supabase, and they must be the owner of the sheet connection.

## Request

### URL Parameters

| Parameter | Description |
|-----------|-------------|
| `sheetId` | The ID of the Google Sheet to append data to |

### Request Body

The request body should be a JSON object with the following structure:

```json
{
  "values": [
    ["Value 1", "Value 2", "Value 3"],
    ["Another row", "More data", "Third column"]
  ]
}
```

Where `values` is a 2D array representing the rows to append. Each inner array represents one row of data, with each element representing a cell value.

## Response

### Success Response

```json
{
  "success": true,
  "updatedRows": 2,
  "updatedColumns": 3,
  "updatedCells": 6
}
```

| Field | Description |
|-------|-------------|
| `success` | Boolean indicating successful operation |
| `updatedRows` | Number of rows that were appended |
| `updatedColumns` | Number of columns that were updated |
| `updatedCells` | Total number of cells that were updated |

### Error Responses

#### 401 Unauthorized

```json
{
  "error": "Unauthorized: Please login first"
}
```

#### 400 Bad Request

```json
{
  "error": "Invalid request body: Expected { values: any[][] }"
}
```

```json
{
  "error": "Failed to retrieve Google credentials",
  "details": "No access token found",
  "action": "reconnect"
}
```

```json
{
  "error": "Data validation failed",
  "details": "Row has more values than available columns"
}
```

#### 404 Not Found

```json
{
  "error": "Sheet connection not found or unauthorized"
}
```

## How It Works

1. **Authentication Check**:
   - Validates the user has an active Supabase session
   - Retrieves their Google OAuth credentials

2. **Token Management**:
   - Checks if the Google OAuth token is expired
   - Automatically refreshes the token if needed using the Supabase Edge Function

3. **Data Validation**:
   - Retrieves the sheet connection metadata from the database
   - Verifies the user has access to this sheet
   - Validates row data against the column structure if metadata exists

4. **Google Sheets API Call**:
   - Makes an authenticated request to the Google Sheets API
   - Uses the `valueInputOption=USER_ENTERED` parameter to handle formatting
   - Appends the provided data rows to the sheet

5. **Response Processing**:
   - Returns success confirmation with update statistics
   - Provides detailed error information if any step fails

## Example Usage

```javascript
// Example: Adding two rows of data to a sheet
const appendData = async (sheetId) => {
  try {
    const response = await fetch(`/api/sheets/${sheetId}/append`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [
          ['John Doe', '30', 'john@example.com'],
          ['Jane Smith', '28', 'jane@example.com']
        ]
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to append data');
    }
    
    return result;
  } catch (error) {
    console.error('Error appending data:', error);
    throw error;
  }
};
```

## Error Handling

The API includes comprehensive error handling for:

- Authentication failures
- Token refresh issues
- Invalid request formats
- Data validation problems
- Google Sheets API errors

Each error response includes a descriptive message and, when appropriate, an action field indicating what the client should do (e.g., "reconnect" for authentication issues).
