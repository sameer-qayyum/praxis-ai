# Google Sheets Integration in Praxis AI Dashboard

This document outlines the architecture and data flow for the Google Sheets integration in the Praxis AI dashboard app, focusing on how components interact with APIs and how data is fetched, processed, and displayed.

## Component Hierarchy

```
Dashboard App
└── App Page ([name])
    ├── GoogleSheetPanel
    │   ├── SheetDataView (displays sheet data with pagination)
    │   └── SheetFieldManager (manages column selection and configuration)
    └── Other app components...
```

## API Structure

The API follows a layered approach to ensure security and proper access control:

```
Frontend Components
    ↓
/api/dashboard/sheets/[sheetId]/data (Authenticated User API)
    ↓ (internal call with service role)
/api/sheets/[sheetId]/data (Internal Sheet Service API)
    ↓
Google Sheets API
```

### API Endpoints

#### Dashboard APIs (User-facing)

- **GET /api/dashboard/sheets/[sheetId]/data**
  - Parameters: page, pageSize, search
  - Performs user authentication and authorization
  - Proxies requests to the internal sheets API

- **GET /api/dashboard/sheets/[sheetId]/columns**
  - Retrieves and manages column metadata
  - Stores column configurations for apps

#### Internal APIs (Service-level)

- **GET /api/sheets/[sheetId]/data**
  - Fetches actual Google Sheet data with pagination
  - Handles Google OAuth token management
  
- **GET /api/sheets/[sheetId]/columns**
  - Analyzes sheet structure and infers column types

## Authentication Flow

1. Frontend requests authenticated via Next.js cookies and Supabase
2. Dashboard APIs verify user session via `supabase.auth.getUser()`
3. App ownership or permissions checked in database
4. Internal APIs use Supabase service role for Google OAuth token access
5. Google API calls made with refreshed OAuth tokens

## Data Flow

1. User navigates to app with Google Sheet connection
2. `SheetDataView` component initializes with React Query
3. API request flows through dashboard API → internal API → Google
4. Data returned and rendered in tabular view
5. Pagination and search controlled by component state

## Rate Limit Handling

To prevent Google Sheets API quota errors (429 status codes):

1. **Enhanced Caching**: React Query configured with:
   - 5-minute stale time
   - 10-minute cache time
   - Disabled refetching on window focus

2. **Smart Retry Strategy**:
   - Exponential backoff (doubles delay between retries)
   - Maximum of 3 retries for rate limit errors only
   - No retries for other error types

## Error Handling

1. **Authentication Errors**: Proper 401/403 responses with clear messages
2. **API Errors**: Structured error responses with details
3. **Rate Limits**: Graceful degradation with retries
4. **Token Refresh**: Automatic handling via Edge Function

## Recent Fixes and Improvements

1. Fixed API route parameter handling with proper Next.js App Router awaiting
2. Updated authentication to use more secure `getUser()` method
3. Enhanced React Query configuration to prevent rate limiting
4. Added comprehensive TypeScript interfaces for better type safety
5. Improved error logging and handling

## Development Notes

- When Google OAuth tokens expire, users need to reconnect their Google account
- Changes to column configuration are saved to the database for persistence
- API calls are proxied through the backend to protect sensitive credentials
- Rate limiting is handled through caching to minimize Google API calls