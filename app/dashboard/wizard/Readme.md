# Praxis AI - API Route Prompts for AI Assistants

This document contains simple English prompts that describe what each API route in our system does. These prompts can be used when working with AI code assistants to build these routes.

## Sheet Data Retrieval API

```
Create an API route that gets data from a Google Sheet. The route should:
- Accept a sheet ID in the URL
- Support optional parameters for filtering, sorting, and pagination
- Handle both small and large sheets efficiently
- Return the data in a clean, structured format with column headers
- Use the user's stored Google access token securely
- Include proper error handling for cases like invalid tokens or sheet not found
```

## Sheet Column Information API

```
Create an API route that gets only the column information from a Google Sheet. The route should:
- Accept a sheet ID in the URL
- Fetch just the first row or header row from the sheet
- Optionally detect column types by examining a few rows of data
- Return a list of columns with their names and detected types
- Handle empty sheets gracefully by returning an empty column list
- Use the user's stored Google access token securely
```

## Sheet Data Append API

```
Create an API route that adds new rows of data to a Google Sheet. The route should:
- Accept a sheet ID in the URL
- Take row data as JSON in the request body
- Validate the data matches the sheet's column structure
- Append the data as new rows at the end of the sheet
- Require user authentication to prevent unauthorized access
- Return confirmation of the successful append operation
- Use the user's stored Google access token securely
```

## Public Form Submission API

```
Create an API route for public form submissions that write to a Google Sheet. The route should:
- Accept a form ID (not the actual sheet ID) in the URL for security
- Validate form data against expected fields
- Include spam protection measures like rate limiting
- Write the submission data to the correct Google Sheet
- Use the form owner's Google token (not the public submitter's)
- Return a success message or validation errors
- Log submission attempts for monitoring
```

## Sheet Data Aggregation API

```
Create an API route that provides pre-calculated aggregations of Google Sheet data for dashboards. The route should:
- Accept a sheet ID and desired metrics (sum, average, count, etc.)
- Support grouping by specific columns (like date, category)
- Filter data by date ranges or other criteria
- Calculate requested aggregations server-side for performance
- Format the response for easy chart/graph display
- Handle large datasets efficiently
- Use the user's stored Google access token securely
```
