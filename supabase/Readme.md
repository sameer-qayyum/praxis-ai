# Praxis AI - Supabase Database Documentation

## Schemas

- **public**: Contains general application tables accessible through RLS policies

## Data Model

### Tables

#### `public.profiles`

Stores user profile information, automatically created when a user signs up.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key, references auth.users(id) |
| full_name | TEXT | User's full name |
| display_name | TEXT | Name displayed in the UI |
| avatar_url | TEXT | URL to user's avatar image |
| company | TEXT | User's company name |
| job_title | TEXT | User's job title |
| timezone | TEXT | User's timezone |
| onboarded | BOOLEAN | Whether the user has completed onboarding (default: false) |
| created_at | TIMESTAMP WITH TIME ZONE | When the profile was created |
| updated_at | TIMESTAMP WITH TIME ZONE | When the profile was last updated |

#### `public.oauth_credentials`

Securely stores OAuth tokens for third-party integrations like Google.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users(id) |
| provider | TEXT | OAuth provider (e.g., 'google') |
| access_token | TEXT | OAuth access token |
| refresh_token | TEXT | OAuth refresh token |
| token_type | TEXT | Type of token (e.g., 'Bearer') |
| expires_at | TIMESTAMP WITH TIME ZONE | When the token expires |
| scope | TEXT | OAuth scopes granted |
| created_at | TIMESTAMP WITH TIME ZONE | When the credential was created |
| updated_at | TIMESTAMP WITH TIME ZONE | When the credential was last updated |

**Note**: This table has a unique constraint on (user_id, provider) to ensure one set of credentials per provider per user.

#### `public.google_sheets_connections`

Tracks user connections to specific Google Sheets.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users(id) |
| name | TEXT | Custom name for this connection |
| sheet_id | TEXT | Google Sheet ID |
| sheet_name | TEXT | Name of the specific sheet/tab |
| description | TEXT | User description of this sheet connection |
| last_synced | TIMESTAMP WITH TIME ZONE | When the sheet was last synced |
| created_at | TIMESTAMP WITH TIME ZONE | When the connection was created |
| updated_at | TIMESTAMP WITH TIME ZONE | When the connection was last updated |

#### `public.templates`

Stores application templates with metadata for the dashboard.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| title | TEXT | Display title of the template |
| description | TEXT | Short description of the template |
| category | TEXT | Category for filtering (e.g., 'Forms', 'Dashboards') |
| icon | TEXT | Icon name from Lucide React icons |
| color | TEXT | Tailwind CSS color class for the icon background |
| popular | BOOLEAN | Whether template is featured (default: false) |
| time | TEXT | Estimated setup time (e.g., '2 min setup') |
| features | TEXT[] | Array of feature descriptions |
| base_prompt | TEXT | Starting prompt for this template type |
| apps_count | INTEGER | Number of apps created from this template (default: 0) |
| created_at | TIMESTAMP WITH TIME ZONE | When the template was created |
| updated_at | TIMESTAMP WITH TIME ZONE | When the template was last updated |

#### `public.apps`

Tracks deployed applications and their associated resources.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| chat_id | TEXT | Chat or conversation ID associated with the app |
| v0_project_id | TEXT | V0 project identifier |
| vercel_project_id | TEXT | Vercel project identifier |
| app_url | TEXT | Deployed application URL |
| vercel_deployment_id | TEXT | Vercel deployment identifier |
| template_id | UUID | References templates(id) for the app template used |
| google_sheet | UUID | References google_sheets_connections(id) for data source |
| number_of_messages | INTEGER | Count of messages in the app (default: 0) |
| created_by | UUID | References auth.users(id) of app creator |
| updated_by | UUID | References auth.users(id) of last user to update |
| created_at | TIMESTAMP WITH TIME ZONE | When the app was created |
| updated_at | TIMESTAMP WITH TIME ZONE | When the app was last updated |

## Database Functions

### `public.handle_new_user()`

A trigger function that automatically creates a profile when a new user signs up.

- **Trigger**: Fires after INSERT on auth.users
- **Returns**: The new user record
- **Action**: Creates a new record in public.profiles with the user's ID

### `public.store_oauth_token()`

Securely stores or updates OAuth credentials.

- **Parameters**:
  - `p_user_id`: UUID - The user's ID
  - `p_provider`: TEXT - OAuth provider name (e.g., 'google')
  - `p_access_token`: TEXT - OAuth access token
  - `p_refresh_token`: TEXT - OAuth refresh token
  - `p_token_type`: TEXT - Token type
  - `p_expires_at`: TIMESTAMP WITH TIME ZONE - Token expiration
  - `p_scope`: TEXT - OAuth scopes
- **Returns**: UUID - The ID of the created/updated credential
- **Security**: SECURITY DEFINER - Runs with elevated privileges

### `public.has_valid_google_token()`

Checks if the current user has valid Google OAuth credentials.

- **Parameters**: None (uses auth.uid() internally)
- **Returns**: BOOLEAN - true if valid credentials exist
- **Security**: SECURITY DEFINER - Runs with elevated privileges

### `public.get_popular_templates(limit_count INTEGER)`

Retrieves the most popular templates based on usage count.

- **Parameters**: 
  - `limit_count`: INTEGER - Maximum number of templates to return (default: 5)
- **Returns**: SETOF templates - Collection of template records

### `public.get_templates_by_category(category_name TEXT)`

Retrieves templates filtered by category.

- **Parameters**: 
  - `category_name`: TEXT - Category name to filter by
- **Returns**: SETOF templates - Collection of template records

### `public.increment_template_app_count(template_id TEXT)`

Increments the app count for a template when a new app is created from it.

- **Parameters**: 
  - `template_id`: TEXT - ID of the template used
- **Returns**: void

## Row Level Security (RLS) Policies

### profiles

- **Users can view own profile**: Allows users to select only their own profile
- **Users can update own profile**: Allows users to update only their own profile

### oauth_credentials

- No direct RLS policies - accessed via secure functions only

### google_sheets_connections

- **Users can view own Google Sheets connections**: Restricts SELECT to user's own connections
- **Users can insert own Google Sheets connections**: Restricts INSERT to user's own connections
- **Users can update own Google Sheets connections**: Restricts UPDATE to user's own connections
- **Users can delete own Google Sheets connections**: Restricts DELETE to user's own connections

### templates

- **Authenticated users can view templates**: Allows any authenticated user to view template records

## Relationships

- **profiles.id → auth.users.id**: One-to-one relationship between auth users and profiles
- **oauth_credentials.user_id → auth.users.id**: One-to-many relationship (user can have multiple OAuth providers)
- **google_sheets_connections.user_id → auth.users.id**: One-to-many relationship (user can connect multiple sheets)
- **No foreign keys in templates**: Templates are standalone reference data accessible to all authenticated users

## Secure Data Handling

OAuth tokens are stored in a separate `secure` schema and are never directly accessible from client applications. All access is mediated through secure functions that run with elevated privileges.

## Edge Functions

### `refresh-google-token`

Automatically refreshes expired Google OAuth tokens.

- **Endpoint**: `https://yhfvwlptgkczsvemjlqr.supabase.co/functions/v1/refresh-google-token`
- **Method**: POST
- **Authentication**: Requires a valid Supabase JWT token
- **Request Body**:
  - `refreshToken`: STRING - The refresh token to use
  - `userId`: UUID - The user's ID
- **Response**:
  - Success (200): `{ success: true, access_token: string, expires_at: string }`
  - Error (400-500): `{ error: string, message?: string }`
- **Description**: Securely handles the token refresh process with Google's OAuth API using environment variables for client credentials. Updates the database with the new access token and returns the refreshed token data. Includes CORS support for requests from allowed origins.
- **Environment Variables Required**:
  - `GOOGLE_CLIENT_ID`: Google OAuth client ID
  - `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
  - `SUPABASE_URL`: Supabase project URL
  - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

### `list-google-sheets`

Retrieves a list of Google Sheets accessible by the user.

- **Endpoint**: `https://yhfvwlptgkczsvemjlqr.supabase.co/functions/v1/list-google-sheets`
- **Method**: POST
- **Authentication**: Requires a valid Supabase JWT token
- **Request Body**:
  - `userId`: UUID - The user's ID
- **Response**:
  - Success (200): `{ success: true, sheets: Array<{ id: string, name: string, lastModified: string, url: string }> }`
  - Error (400-500): `{ error: string, message?: string, expired?: boolean }`
- **Description**: Uses the user's Google OAuth credentials to fetch all Google Sheets documents available to them. Handles token expiration checks and returns a formatted list of sheets. Includes CORS support for requests from allowed origins.
- **Environment Variables Required**:
  - `SUPABASE_URL`: Supabase project URL
  - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

### `create-google-sheet`

Creates a new Google Sheet for the user.

- **Endpoint**: `https://yhfvwlptgkczsvemjlqr.supabase.co/functions/v1/create-google-sheet`
- **Method**: POST
- **Authentication**: Requires a valid Supabase JWT token
- **Request Body**:
  - `userId`: UUID - The user's ID
  - `sheetName`: STRING - Name for the new Google Sheet
- **Response**:
  - Success (200): `{ success: true, sheet: { id: string, name: string, lastModified: string, url: string } }`
  - Error (400-500): `{ error: string, message?: string, expired?: boolean }`
- **Description**: Creates a new Google Sheet with the specified name using the user's Google OAuth credentials. Returns the details of the newly created sheet including its ID and URL. Handles token expiration checks and includes CORS support for requests from allowed origins.
- **Environment Variables Required**:
  - `SUPABASE_URL`: Supabase project URL
  - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

### `write-sheet-columns`

Updates a Google Sheet with column headers.

- **Endpoint**: `https://yhfvwlptgkczsvemjlqr.supabase.co/functions/v1/write-sheet-columns`
- **Method**: POST
- **Authentication**: Requires a valid Supabase JWT token
- **Request Body**:
  - `userId`: UUID - The user's ID
  - `sheetId`: string - The Google Sheet ID to update
  - `columns`: Array<{ id: string, name: string, type: string, description: string, options?: string[] }> - Column metadata (only names are written to sheet)
- **Response**:
  - Success (200): `{ success: true, updatedRange: string, updatedRows: number, updatedColumns: number }`
  - Error (400-500): `{ error: string, message?: string }`
- **Description**: Updates the target Google Sheet with column headers (row 1 only). Preserves existing columns while adding new ones. Supports unlimited columns beyond the 26-column A-Z limit. Automatically handles token validation and refreshes expired tokens.
- **Limitations**:
  - Maximum fetch limit of 500 existing columns (can be increased if needed)
  - Column names should be unique to avoid conflicts
- **Environment Variables Required**:
  - `SUPABASE_URL`: Supabase project URL
  - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key