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

## Field Management System

### Component Structure

```
GoogleSheetPanel
└── SheetFieldManager
    ├── Field List (draggable interface)
    │   └── Field Items (individual fields with toggles)
    └── Edit Field Dialog
```

### State Management

| Component | State | Purpose |
|-----------|-------|--------|
| GoogleSheetPanel | modifiedFields | Tracks field changes from SheetFieldManager |
| GoogleSheetPanel | hasChanges | Controls visibility of save buttons |
| GoogleSheetPanel | fieldsVersion | Forces remount of `SheetFieldManager` after save to reset local state |
| SheetFieldManager | fields | Current field configuration |
| SheetFieldManager | originalFields | Initial field state for comparison |
| SheetFieldManager | isDirty | Tracks unsaved changes |
| SheetFieldManager | isEditing | Controls edit dialog visibility |
| SheetFieldManager | editedField | Field being edited in dialog |
| SheetFieldManager | customFieldCounter | Tracks last used index for IDs like `custom-N`; initialized from loaded fields |

### UI Elements

- **Toggle Switch**: Enables/disables field inclusion in app
- **Field changes detected (bottom bar)**: Single save surface in `GoogleSheetPanel` that appears when changes exist
- **Save Button (bottom bar)**: Saves current field configuration (no separate save within `SheetFieldManager`)
- **Refresh Button**: Reloads field data from API
- **Edit Button**: Opens field edit dialog
- **Drag Handles**: Allows reordering of fields
- **Edit Dialog**: Form for modifying field properties

#### Add Field Dialog (SheetFieldManager)

- Collects: `name`, `type`, `description`, `active`
- For `dropdown` and `checkbox` types, supports adding/removing `options`
- Validation: name required; options required for option types; confirms only when valid
- New fields get unique IDs like `custom-N` (we compute next available to avoid duplicates)

##### How updateGlobal is set when adding a field

- `SheetFieldManager` sets an internal `updateGlobalMetadata` flag to `true` when you confirm the Add Field dialog. This ensures intent to persist globally.
- However, the actual save is centralized in `GoogleSheetPanel`, which currently always sends `updateGlobal: true` in the request body. So, regardless of the internal flag, saves are treated as global.

### Data Persistence Flow

1. **Toggle Field**
   ```
   User toggles field → toggleFieldInclusion() → Update fields state → 
   setIsDirty(true) → onFieldChange callback → GoogleSheetPanel updates modifiedFields
   ```

2. **Edit Field**
   ```
   User clicks Edit → handleEditField() → Edit Dialog opens → 
   User modifies field → User clicks Save Changes → handleSaveEdit() → 
   Update fields state → setIsDirty(true) → onFieldChange callback
   ```

3. **Save Changes (metadata + write to Google Sheet)**
   ```
   User clicks Save Fields Only → handleSaveFieldsOnly() → saveFieldsMutation →
   PUT /api/dashboard/sheets/[appId]/columns { updateGlobal: true, columns } → metadata saved →
   resolve sheet_id from google_sheets_connections using app.google_sheet (connection id) →
   useGoogleSheets.writeSheetColumns(sheet_id, columns) → attempt to write to actual Google Sheet
   → on success: invalidate ["sheet-columns", app.id] and increment fieldsVersion (remount child) → bottom bar hides
   ```

#### Local vs Global behavior

- The `updateGlobal` boolean in the PUT body determines scope.
- Current behavior: `GoogleSheetPanel` always sets `updateGlobal: true` (global changes).
- If local-only behavior is desired, add a UI toggle in `GoogleSheetPanel` and pass `updateGlobal: false` accordingly.

4. **Regenerate App**
   ```
   User clicks Save & Regenerate App → saveFieldsMutation (same as above: metadata + writeSheetColumns) →
   POST /api/apps/[appId]/regenerate → API updates app and rebuilds
   ```

### Persistence to Google Sheet

- Connection resolution: `app.google_sheet` stores `google_sheets_connections.id`. We query that row to get `sheet_id`.
- Write call: `useGoogleSheets.writeSheetColumns(sheet_id, columns)` invokes an Edge Function to sync columns to the Sheet (e.g., add/rename/reorder depending on backend logic).
- If write fails, we log but do not block the metadata save; UI still resets and bottom bar hides.

### Edge Cases and Notes

- Reordering or toggling active triggers the same save flow (metadata + attempted Sheet write).
- Options are saved in metadata and sent to the write function; actual Sheet enforcement depends on backend implementation.
- After save: parent clears `hasChanges`/`modifiedFields`, invalidates React Query, and forces `SheetFieldManager` remount via `fieldsVersion` to reset local dirty/original state.
- New custom fields always use an unused `custom-N` id; we initialize `customFieldCounter` from loaded data and skip taken IDs.

### Database Schema

Fields are stored in the app's `data_model` column in the `apps` table:

```typescript
interface Field {
  id: string;       // Unique identifier
  name: string;     // Display name
  type: string;     // Data type (text, number, boolean, etc.)
  description: string;  // Field description
  active: boolean;  // Inclusion flag
  options?: any[];  // Type-specific options
  originalIndex?: number;  // Position tracking
  sampleData?: string[];  // Sample values from sheet
}
```

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
6. Centralized saving on `GoogleSheetPanel` bottom bar (removed local save in `SheetFieldManager`)
7. Added Add Field dialog with options for dropdown/checkbox types and validation
8. After saving, also write columns to Google Sheet by resolving `sheet_id` and calling `writeSheetColumns`
9. Fixed duplicate key issues by ensuring unique `custom-N` IDs for newly added fields
10. Ensured bottom bar hides reliably after save by invalidating queries and forcing child remount

## Development Notes

- When Google OAuth tokens expire, users need to reconnect their Google account
- Changes to column configuration are saved to the database for persistence
- API calls are proxied through the backend to protect sensitive credentials
- Rate limiting is handled through caching to minimize Google API calls