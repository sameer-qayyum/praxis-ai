# Praxis AI Wizard Component

This document provides a comprehensive guide to the wizard component used in the Praxis AI dashboard.

## Overview

The wizard provides a step-by-step interface for users to create applications by:
1. Connecting to Google Sheets (optional if already connected)
2. Uploading or selecting a form
3. Reviewing extracted fields
4. Configuring app access permissions

## Component Structure

```
WizardContainer
├── WizardProgress (displays progress bar and step indicators)
└── Step Content (conditional rendering based on currentStep)
    ├── ConnectGoogleSheets
    │   └── ConnectGoogleSheetsButton
    ├── UploadForm
    │   └── Google Sheets selection/creation UI
    ├── ReviewFields
    └── ConfigureAppAccess
```

## Key Types

### WizardContainerProps

```typescript
interface WizardContainerProps {
  title: string        // Title displayed at the top of the wizard
  description: string  // Description text below the title
  templateId?: string  // ID of the template being used (optional for custom apps)
  customPrompt?: string  // Custom prompt for non-template apps
  customPromptId?: string | null  // Custom prompt ID for tracking
  isCustomApp?: boolean  // Flag for custom vs template apps
}
```

### Wizard Step

```typescript
type Step = {
  number: number               // Step number in sequence
  id: string                   // Unique identifier for the step
  title: string                // Display title
  description: string          // Short description
  status: "current" | "complete" | "upcoming"  // Visual status for progress indicator
}
```

## State Management

### Local State

- `currentStep: number` - Tracks the active step (1-3)
- `initialCheckComplete: boolean` - Indicates if the Google connection check is complete
- `columnChanges: ColumnSyncResult | null` - Stores detected sheet column changes (added, removed, reordered)

### Context Usage

- `GoogleSheetsContext` - Manages Google Sheets integration state:
  - `isConnected` - Whether user has a valid Google connection
  - `isLoading` - Loading state during connection checks
  - `checkConnectionStatus()` - Validates and refreshes Google tokens
  - `sheets`, `loadingSheets` - For the UploadForm component
  - `createSheet()`, `listSheets()` - For sheets operations

## Wizard Flow

1. **Initialization**:
   - Checks if user has a valid Google connection
   - If connected, skips step 1 and starts at step 2
   - Shows loading indicator during this check

2. **Step Rendering**:
   - Dynamic step content based on `currentStep` value
   - Different flows for connected vs non-connected users

3. **Navigation**:
   - "Previous" button - Decrements `currentStep`
   - "Next" button - Increments `currentStep`
   - "Finish" button - Only shown on final step (Configure App Access)

4. **Progress Calculation**:
   - Adjusts progress based on total visible steps
   - For connected users: 3 total steps (Upload, Review, and Configure Access)
   - For non-connected users: 4 total steps (Connect, Upload, Review, Configure Access)

## Step Components

### ConnectGoogleSheets

Manages Google OAuth connection process:
- Displays connection status
- Provides button to initiate OAuth flow
- Shows success/error messages from URL params after OAuth redirect

### UploadForm

Allows users to:
- List existing Google Sheets
- Create new Google Sheets
- Select a sheet for use
- Detect changes in sheet column structure (added, removed, reordered columns)
- Show toast notifications when changes are detected

### ReviewFields

Enables users to:
- View columns from the selected Google Sheet
- **Template Suggestions**: Load recommended fields from `templates.new_sheet_columns_metadata` when sheet is empty
- Customize field properties (name, type, description)
- Include/exclude fields for the final app (respects template `active` field)
- Add custom fields if needed
- **ScrollArea**: Fields contained in scrollable area (60vh) to keep navigation buttons accessible
- See visual indicators for column changes:
  - Red border/badge for columns removed from Google Sheet
  - Green border/badge for columns newly added to Google Sheet
  - Amber border/badge for columns reordered in Google Sheet
- Auto-exclude removed columns (defaults to unchecked "Include")
- **Info Messages**: Different messages for template suggestions vs detected fields

### ConfigureAppAccess

Allows users to:
- Choose whether authentication is required to access the generated app
- See visual indicators for access settings
- Understand the security implications of their choice
- Default setting is public access (requires_authentication = false)

## Data Saving Process

### Functions and Data Flow

1. **Key Functions**:
   - `saveSheetConnection(name, description, columnsMetadata)` - Located in `GoogleSheetsContext.tsx`
   - `handleFinish()` - Located in `WizardContainer.tsx`

2. **Data Storage**:
   - Target Table: `google_sheets_connections`
   - Key Columns: 
     - `user_id` (from authenticated session)
     - `sheet_id` (from selected sheet)
     - `name` (from sheet name)
     - `columns_metadata` (JSONB column storing field configurations)

### Finish Button Flow

When the user clicks the Finish button:

1. **Validation**:
   - Checks if a sheet is selected (`selectedSheet?.id`)
   - Verifies at least one field is included (`selectedFieldsCount > 0`)
   - Disables button during submission (`isSubmitting` state)

2. **Data Preparation**:
   - Maps all fields to `columnsMetadata` format with `active: !!field.include`
   - Creates filtered `activeColumnsMetadata` for app generation
   - Stores complete field structure (preserves inactive fields)
   - Format: `{id, name, type, description, options, active, originalIndex}`

3. **Database Operation**:
   - Calls `saveSheetConnection()` with formatted data
   - Function checks if connection already exists (for update vs. insert)
   - Performs upsert operation in the `google_sheets_connections` table
   - Creates app record in `apps` table with `data_model` field
   - Sets `requires_authentication` and `path_secret` fields
   - Creates `app_permissions` record for admin access
   - Updates `user_custom_prompts.app_id` for custom apps

4. **User Feedback**:
   - Shows success toast if operation completes successfully
   - Shows error toast if any issues occur
   - Resets submission state when complete

## Template Suggestions Feature

### How It Works
1. **Empty Sheet Detection**: When `data.isEmpty` is true and no existing connection metadata
2. **Template Fetch**: Queries `templates.new_sheet_columns_metadata` using `templateId`
3. **Field Processing**: Converts template data to ReviewFields format:
   ```typescript
   {
     id: col.id || `template-${index}`,
     name: col.name,
     type: col.type,
     description: col.description || "",
     include: !!col.active, // Respects template's active field
     sampleData: [],
     options: col.options || [],
     originalIndex: col.originalIndex || index
   }
   ```
4. **UI Display**: Shows green info message explaining these are recommended fields
5. **Fallback**: If no template suggestions, shows standard "add custom fields" flow

### Benefits
- **No Prompt Anxiety**: Users get pre-configured field suggestions
- **Customizable**: All fields can be modified (name, type, description, options)
- **Selective**: Users can include/exclude suggested fields
- **Auto-Integration**: Selected fields automatically added to Google Sheet

## Key Integrations

1. **Google Sheets API** (via Supabase Edge Functions)
   - OAuth authentication
   - Sheet listing and creation
   - Token refresh mechanism
   - Write new custom column headers to sheet

2. **Database Tables**
   - `templates.new_sheet_columns_metadata` - Template field suggestions
   - `google_sheets_connections.columns_metadata` - Saved field configurations
   - `apps.data_model` - App-specific field metadata
   - `user_custom_prompts` - Custom app prompts

3. **Styling**
   - Tailwind CSS for responsive design
   - Shadcn UI components for consistent UI
   - ScrollArea for field list containment

## Best Practices

- **Conditional Rendering**: Different UI based on connection state
- **Loading States**: Clear indicators during async operations
- **Error Handling**: Graceful error display and recovery
- **Progress Tracking**: Visual feedback on wizard position