-- Add sheet_api_access column to templates table
ALTER TABLE public.templates
ADD COLUMN IF NOT EXISTS sheet_api_access TEXT NOT NULL DEFAULT 'write_only' CHECK (sheet_api_access IN ('read_only', 'write_only', 'read_write'));

-- Add comment to column
COMMENT ON COLUMN public.templates.sheet_api_access IS 'Specifies the type of Google Sheet API access needed: read_only, write_only, or read_write';

-- Update existing templates to have appropriate values based on template purpose
-- This is just an example; you would need to update this based on your actual templates
UPDATE public.templates 
SET sheet_api_access = 'read_write'
WHERE name ILIKE '%dashboard%' OR name ILIKE '%admin%';

UPDATE public.templates 
SET sheet_api_access = 'write_only'
WHERE name ILIKE '%form%' OR name ILIKE '%survey%';

UPDATE public.templates 
SET sheet_api_access = 'read_only'
WHERE name ILIKE '%report%' OR name ILIKE '%view%';
