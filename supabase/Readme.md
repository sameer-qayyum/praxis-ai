# Praxis AI - Supabase Database Documentation

## Schemas

- **public**: Contains general application tables accessible through RLS policies
- **secure**: Contains sensitive data like OAuth tokens with restricted access

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

#### `secure.oauth_credentials`

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

## Database Functions

### `public.handle_new_user()`

A trigger function that automatically creates a profile when a new user signs up.

- **Trigger**: Fires after INSERT on auth.users
- **Returns**: The new user record
- **Action**: Creates a new record in public.profiles with the user's ID

### `secure.store_oauth_token()`

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

## Relationships

- **profiles.id → auth.users.id**: One-to-one relationship between auth users and profiles
- **oauth_credentials.user_id → auth.users.id**: One-to-many relationship (user can have multiple OAuth providers)
- **google_sheets_connections.user_id → auth.users.id**: One-to-many relationship (user can connect multiple sheets)

## Secure Data Handling

OAuth tokens are stored in a separate `secure` schema and are never directly accessible from client applications. All access is mediated through secure functions that run with elevated privileges.