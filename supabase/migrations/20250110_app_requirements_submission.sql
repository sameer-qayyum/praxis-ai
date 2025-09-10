-- Create table for capturing user app requirements
CREATE TABLE public.app_requirements_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    app_requirements TEXT NOT NULL,
    sheet_column_names TEXT[], -- Array of column names from their Google Sheet
    sample_data JSONB, -- Store sample data as JSON for flexibility
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Add constraints
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT app_requirements_length CHECK (char_length(app_requirements) >= 10),
    CONSTRAINT app_requirements_length_max CHECK (char_length(app_requirements) <= 5000)
);

-- Enable Row Level Security
ALTER TABLE public.app_requirements_submissions ENABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX idx_app_requirements_created_at ON public.app_requirements_submissions(created_at DESC);
CREATE INDEX idx_app_requirements_email ON public.app_requirements_submissions(email);

-- RLS Policies

-- 1. Allow anonymous users to INSERT their submissions (public form submission)
CREATE POLICY "Allow anonymous insert" ON public.app_requirements_submissions
    FOR INSERT 
    TO anon 
    WITH CHECK (true);

-- 2. Allow authenticated users to INSERT their submissions
CREATE POLICY "Allow authenticated insert" ON public.app_requirements_submissions
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- 3. Prevent public SELECT access (only admins should see submissions)
-- No public SELECT policy means no one can read unless explicitly granted

-- 4. Allow service role full access (for admin dashboard)
CREATE POLICY "Service role full access" ON public.app_requirements_submissions
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- 5. Optional: Allow authenticated users to view only their own submissions
-- Uncomment if you want users to see their own submissions
/*
CREATE POLICY "Users can view own submissions" ON public.app_requirements_submissions
    FOR SELECT 
    TO authenticated 
    USING (email = auth.jwt() ->> 'email');
*/

-- Grant necessary permissions
GRANT INSERT ON public.app_requirements_submissions TO anon;
GRANT INSERT ON public.app_requirements_submissions TO authenticated;
GRANT ALL ON public.app_requirements_submissions TO service_role;

-- Add helpful comments
COMMENT ON TABLE public.app_requirements_submissions IS 'Stores user submissions for custom app requirements from the landing page';
COMMENT ON COLUMN public.app_requirements_submissions.email IS 'User email address for contact';
COMMENT ON COLUMN public.app_requirements_submissions.app_requirements IS 'Description of what app they want built';
COMMENT ON COLUMN public.app_requirements_submissions.sheet_column_names IS 'Array of column names from their Google Sheet';
COMMENT ON COLUMN public.app_requirements_submissions.sample_data IS 'Sample data from their sheet stored as JSON';
