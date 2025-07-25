# Google Sheets Data Retrieval API

This API route allows you to retrieve data from a Google Sheet that a user has connected through the Praxis AI platform, with support for pagination, filtering, and sorting.

## Endpoint

```
GET /api/sheets/:sheetId/data
```

## Authentication

This endpoint requires authentication. The user must have an active session with Supabase, and they must be the owner of the sheet connection.

## Request

### URL Parameters

| Parameter | Description |
|-----------|-------------|
| `sheetId` | The ID of the Google Sheet to retrieve data from |

### Query Parameters

#### Pagination

| Parameter | Description | Default |
|-----------|-------------|---------|
| `page` | Page number (1-indexed) | 1 |
| `pageSize` | Number of rows per page (max 1000) | 50 |

#### Filtering

Filter by column values using the syntax:

```
?filter[columnName]=value
```

Multiple filters can be applied and work with AND logic:

```
?filter[name]=john&filter[age]=30
```

#### Sorting

Sort results by a column in ascending or descending order:

```
?sort=columnName:asc
```

Or:

```
?sort=columnName:desc
```

#### Metadata

Include column metadata in the response:

```
?includeMetadata=true
```

## Response

### Success Response

```json
{
  "headers": ["Name", "Email", "Age"],
  "rows": [
    {"Name": "John Doe", "Email": "john@example.com", "Age": "30"},
    {"Name": "Jane Smith", "Email": "jane@example.com", "Age": "25"}
  ],
  "totalRows": 100,
  "filteredRows": 2,
  "page": 1,
  "pageSize": 50,
  "totalPages": 2,
  "metadata": [
    {
      "name": "Name",
      "type": "text",
      "description": "Full name of the person"
    },
    {
      "name": "Email",
      "type": "email",
      "description": "Contact email address"
    },
    {
      "name": "Age",
      "type": "number",
      "description": "Age in years"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `headers` | Array of column headers from the sheet |
| `rows` | Array of objects with column headers as keys |
| `totalRows` | Total number of rows in the sheet (excluding header) |
| `filteredRows` | Number of rows after filtering (only present if filters were applied) |
| `page` | Current page number |
| `pageSize` | Number of rows per page |
| `totalPages` | Total number of pages available |
| `metadata` | Column metadata including types and descriptions (only if includeMetadata=true) |

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
  "error": "Failed to retrieve Google credentials",
  "details": "No access token found",
  "action": "reconnect"
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

3. **Sheet Information**:
   - Retrieves sheet headers to understand the column structure
   - Gets sheet properties to determine total row count

4. **Data Retrieval**:
   - Calculates the appropriate range based on pagination parameters
   - Fetches data for the requested page
   - Converts raw data into structured objects with column headers as keys

5. **Data Processing**:
   - Applies filtering based on query parameters
   - Sorts data if requested
   - Formats response with pagination information

6. **Response Generation**:
   - Returns data with pagination information
   - Includes column metadata if requested

## Example Usage

```javascript
// Example: Getting data from a sheet with filtering and pagination
const fetchSheetData = async (sheetId) => {
  try {
    const response = await fetch(`/api/sheets/${sheetId}/data?page=1&pageSize=10&filter[Status]=Active&sort=Name:asc&includeMetadata=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to retrieve data');
    }
    
    return result;
  } catch (error) {
    console.error('Error retrieving data:', error);
    throw error;
  }
};
```

## Error Handling

The API includes comprehensive error handling for:

- Authentication failures
- Token refresh issues
- Invalid sheet IDs
- Google Sheets API errors
- Pagination out of bounds

Each error response includes a descriptive message and appropriate HTTP status code.
