-- Add path_secret column to the apps table for URL-based authentication
ALTER TABLE public.apps
ADD COLUMN IF NOT EXISTS path_secret TEXT;

-- Create function to generate a secure path secret
CREATE OR REPLACE FUNCTION public.generate_path_secret() 
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  -- Generate a 32-character random string
  FOR i IN 1..32 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a trigger to automatically generate path_secret for new apps
CREATE OR REPLACE FUNCTION public.set_app_path_secret()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.path_secret IS NULL THEN
    NEW.path_secret := public.generate_path_secret();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add the trigger to the apps table
DROP TRIGGER IF EXISTS set_app_path_secret_trigger ON public.apps;
CREATE TRIGGER set_app_path_secret_trigger
  BEFORE INSERT ON public.apps
  FOR EACH ROW
  EXECUTE FUNCTION public.set_app_path_secret();

-- Function to regenerate path_secret for an existing app
CREATE OR REPLACE FUNCTION public.regenerate_app_secret(p_app_id UUID) 
RETURNS TEXT AS $$
DECLARE
  new_secret TEXT;
BEGIN
  -- Check if the user has permission to update this app
  IF NOT EXISTS (SELECT 1 FROM public.apps WHERE id = p_app_id AND created_by = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to update this app';
  END IF;
  
  -- Generate a secure random path secret
  new_secret := public.generate_path_secret();
  
  -- Update the app with the new secret
  UPDATE public.apps
  SET path_secret = new_secret
  WHERE id = p_app_id;
  
  RETURN new_secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a simple tracking table for form submissions
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  rows_added INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  client_ip TEXT,
  user_agent TEXT
);

-- Add RLS policies
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Users can see only submissions for their own apps
CREATE POLICY form_submissions_select_policy ON public.form_submissions
  FOR SELECT USING (
    app_id IN (SELECT id FROM public.apps WHERE created_by = auth.uid())
  );
