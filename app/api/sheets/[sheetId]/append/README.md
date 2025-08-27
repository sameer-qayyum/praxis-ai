# Google Sheets Append/Update API

This API route allows you to append new rows or update existing rows in a Google Sheet that a user has connected through the Praxis AI platform.

## Endpoint

```
POST /api/sheets/:sheetId/append
```

## Modes of Operation

This API supports two modes:
- **Append Mode** (default): Adds new rows to the end of the sheet
- **Update Mode**: Updates existing rows based on an ID field

## Authentication

This endpoint requires authentication. The user must have an active session with Supabase, and they must be the owner of the sheet connection.

## Request

### URL Parameters

| Parameter | Description | Required |
|-----------|-------------|----------|
| `sheetId` | The ID of the Google Sheet to modify | Yes |

### Query Parameters (for Update Mode)

| Parameter | Description | Required | Default |
|-----------|-------------|----------|---------|
| `updateId` | The ID value to search for when updating | No (triggers update mode) | - |
| `idColumn` | The column letter containing the ID field | No | A |

### Request Body

The request body should be a JSON object with the following structure:

```json
{
  "data": {
    "field1": "value1",
    "field2": "value2",
    "field3": "value3"
  }
}
```

Where `data` is an object with key-value pairs representing the row data. The API automatically maps field names to the correct column positions using the sheet's metadata structure.

## Response

### Success Response (Append Mode)

```json
{
  "success": true,
  "mode": "append",
  "updatedRange": "Sheet1!A5:C5",
  "updatedRows": 1
}
```

### Success Response (Update Mode)

```json
{
  "success": true,
  "mode": "update",
  "updatedRange": "Sheet1!A3:C3",
  "updatedRows": 1,
  "updatedCells": 3,
  "targetRow": 3
}
```

| Field | Description |
|-------|-------------|
| `success` | Boolean indicating successful operation |
| `mode` | Operation mode: "append" or "update" |
| `updatedRange` | Google Sheets range that was modified |
| `updatedRows` | Number of rows that were modified |
| `updatedCells` | Number of cells that were updated (update mode only) |
| `targetRow` | Row number that was updated (update mode only) |

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
  "error": "Invalid data format. Expected object."
}
```

```json
{
  "error": "Failed to retrieve Google credentials",
  "details": "No access token found",
  "action": "reconnect"
}
```

#### 404 Not Found

```json
{
  "error": "Sheet not found or access denied"
}
```

```json
{
  "error": "No row found with A = 'user123'"
}
```

## How It Works

### Column Structure Preservation
Both append and update modes use the sheet's `columns_metadata` to maintain proper column structure:
1. **Metadata Retrieval**: Gets column definitions from the database
2. **Column Ordering**: Sorts columns by `originalIndex` to match sheet structure
3. **Field Mapping**: Maps incoming field names to correct column positions
4. **Empty Value Preservation**: Maintains empty fields in their proper column locations

### Append Mode (Default)
1. **Authentication & Validation**: Validates user session and Google credentials
2. **Token Management**: Refreshes expired tokens automatically
3. **Column Mapping**: Uses metadata to order data according to sheet structure
4. **Google Sheets API**: Uses `append` method to add row to end of sheet
5. **Response**: Returns success with updated range information

### Update Mode (with updateId parameter)
1. **Authentication & Validation**: Same as append mode
2. **Row Search**: Queries the specified ID column to find matching row
3. **Row Location**: Identifies the exact row number containing the ID
4. **Column Mapping**: Uses metadata to maintain proper column order during update
5. **Data Update**: Uses `update` method to overwrite the specific row
6. **Response**: Returns success with target row and update details

### Error Handling
- **Authentication failures**: Token refresh or reconnection required
- **Sheet access**: Validates user owns the sheet connection
- **Row not found**: Returns 404 when updateId doesn't exist
- **API errors**: Detailed Google Sheets API error messages

## Example Usage

### Append Mode - Adding New Row

```javascript
const appendData = async (sheetId, rowData) => {
  try {
    const response = await fetch(`/api/sheets/${sheetId}/append`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          "row type": "job",
          "job id": "job-123",
          "job title": "Software Developer",
          "job description": "Build amazing apps",
          "full name": "",        // Empty fields are preserved in correct columns
          "email": "",
          "phone number": "",
          "active": true
        }
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to append data');
    }
    
    console.log('Appended to:', result.updatedRange);
    return result;
  } catch (error) {
    console.error('Error appending data:', error);
    throw error;
  }
};
```

### Update Mode - Updating Existing Row

```javascript
const updateData = async (sheetId, userId, updatedData) => {
  try {
    const response = await fetch(`/api/sheets/${sheetId}/append?updateId=${userId}&idColumn=A`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          id: userId,
          name: 'John Doe Updated',
          age: '31',
          email: 'john.updated@example.com'
        }
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update data');
    }
    
    console.log('Updated row:', result.targetRow);
    return result;
  } catch (error) {
    console.error('Error updating data:', error);
    throw error;
  }
};
```

### Complete Function with Mode Detection

```javascript
const saveToSheet = async (sheetId, data, options = {}) => {
  const { updateId, idColumn = 'A' } = options;
  
  // Build URL with query parameters for update mode
  let url = `/api/sheets/${sheetId}/append`;
  if (updateId) {
    url += `?updateId=${encodeURIComponent(updateId)}&idColumn=${idColumn}`;
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || `Failed to ${updateId ? 'update' : 'append'} data`);
    }
    
    return result;
  } catch (error) {
    console.error(`Error ${updateId ? 'updating' : 'appending'} data:`, error);
    throw error;
  }
};

// Usage examples:
// Append new row
await saveToSheet('sheet123', { name: 'John', email: 'john@example.com' });

// Update existing row
await saveToSheet('sheet123', { name: 'John Updated', email: 'john@example.com' }, { 
  updateId: 'user123', 
  idColumn: 'A' 
});
```

## API Function Parameters

### Required Parameters
- **sheetId**: Google Sheet identifier from your connected sheets
- **data**: Object containing the row data to save

### Optional Parameters (Update Mode)
- **updateId**: Value to search for in the ID column
- **idColumn**: Column letter containing the ID field (default: 'A')

### Response Fields
- **success**: Boolean indicating operation success
- **mode**: 'append' or 'update' 
- **updatedRange**: Google Sheets range that was modified
- **updatedRows**: Number of rows modified
- **updatedCells**: Number of cells updated (update mode only)
- **targetRow**: Row number updated (update mode only)

## Error Handling

The API includes comprehensive error handling for:

- **Authentication failures**: Session expired or invalid credentials
- **Token management**: Automatic refresh of expired Google tokens
- **Sheet access**: Validates user owns the sheet connection
- **Data validation**: Ensures proper request format
- **Row not found**: When updateId doesn't exist in the sheet
- **Google Sheets API errors**: Detailed error messages from Google

Each error response includes a descriptive message and, when appropriate, an action field indicating what the client should do (e.g., "reconnect" for authentication issues).

## Column Structure & Metadata

The API uses the `columns_metadata` field from the `google_sheets_connections` table to maintain proper column structure. This metadata contains:

- **Column names**: Exact field names as they appear in the sheet
- **Original index**: The position of each column in the sheet (0-based)
- **Field types**: Text, Email, Date, Boolean, etc.
- **Active status**: Whether the field is visible to users

### Example Metadata Structure

```json
[
  {
    "id": "custom-col-00",
    "name": "row type",
    "type": "Dropdown",
    "active": false,
    "options": ["job", "applicant"],
    "description": "Defines the type of row",
    "originalIndex": 0
  },
  {
    "id": "custom-col-01", 
    "name": "job id",
    "type": "Text",
    "active": false,
    "options": [],
    "description": "unique job ID",
    "originalIndex": 1
  }
]
```

### Field Mapping Process

1. **Sort by originalIndex**: Columns are ordered according to their position in the sheet
2. **Exact name matching**: Field names are matched exactly first
3. **Case-insensitive fallback**: If exact match fails, tries case-insensitive matching
4. **Empty value handling**: Missing or null values become empty strings in correct positions

This ensures that data sent with any field order will be correctly positioned in the sheet according to the original column structure.
