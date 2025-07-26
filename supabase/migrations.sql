-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create secure schema for sensitive data
CREATE SCHEMA IF NOT EXISTS secure;

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  company TEXT,
  job_title TEXT,
  timezone TEXT,
  onboarded BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy to view own profile only
CREATE POLICY "Users can view own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

-- Policy to update own profile only
CREATE POLICY "Users can update own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Secure table for OAuth credentials
CREATE TABLE public.oauth_credentials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

-- Create RLS policies for OAuth credentials
ALTER TABLE secure.oauth_credentials ENABLE ROW LEVEL SECURITY;

-- No direct access to oauth_credentials table from client
-- These will be accessed via secure functions only

-- Specific table for Google Sheets integration
CREATE TABLE public.google_sheets_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sheet_id TEXT NOT NULL,
  sheet_name TEXT,
  description TEXT,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  columns_metadata JSONB DEFAULT '[]'::jsonb
);

-- Create RLS policies for Google Sheets connections
ALTER TABLE public.google_sheets_connections ENABLE ROW LEVEL SECURITY;

-- Policy to view own Google Sheets connections only
CREATE POLICY "Users can view own Google Sheets connections" 
  ON public.google_sheets_connections 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy to insert own Google Sheets connections
CREATE POLICY "Users can insert own Google Sheets connections" 
  ON public.google_sheets_connections 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy to update own Google Sheets connections
CREATE POLICY "Users can update own Google Sheets connections" 
  ON public.google_sheets_connections 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Policy to delete own Google Sheets connections
CREATE POLICY "Users can delete own Google Sheets connections" 
  ON public.google_sheets_connections 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create apps table to track app deployments
CREATE TABLE public.apps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  chat_id TEXT,
  v0_project_id TEXT,
  vercel_project_id TEXT,
  app_url TEXT,
  vercel_deployment_id TEXT,
  template_id UUID REFERENCES public.templates(id),
  google_sheet UUID REFERENCES public.google_sheets_connections(id),
  number_of_messages INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_apps_created_by ON public.apps(created_by);
CREATE INDEX idx_apps_google_sheet ON public.apps(google_sheet);
CREATE INDEX idx_apps_template_id ON public.apps(template_id);

-- Enable row level security
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;

-- Policy to view own apps only
CREATE POLICY "Users can view own apps" 
  ON public.apps 
  FOR SELECT 
  USING (auth.uid() = created_by);

-- Policy to insert own apps
CREATE POLICY "Users can insert own apps" 
  ON public.apps 
  FOR INSERT 
  WITH CHECK (auth.uid() = created_by);

-- Policy to update own apps
CREATE POLICY "Users can update own apps" 
  ON public.apps 
  FOR UPDATE 
  USING (auth.uid() = created_by);

-- Policy to delete own apps
CREATE POLICY "Users can delete own apps" 
  ON public.apps 
  FOR DELETE 
  USING (auth.uid() = created_by);

-- Function to create a new profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile after user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- Secure functions for OAuth operations

-- Store OAuth token securely
CREATE OR REPLACE FUNCTION public.store_oauth_token(
  p_user_id UUID,
  p_provider TEXT,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_token_type TEXT,
  p_expires_at TIMESTAMP WITH TIME ZONE,
  p_scope TEXT
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO secure.oauth_credentials(
    user_id, provider, access_token, refresh_token, 
    token_type, expires_at, scope
  ) 
  VALUES (
    p_user_id, p_provider, p_access_token, p_refresh_token, 
    p_token_type, p_expires_at, p_scope
  )
  ON CONFLICT (user_id, provider) DO UPDATE 
  SET 
    access_token = p_access_token,
    refresh_token = p_refresh_token,
    token_type = p_token_type,
    expires_at = p_expires_at,
    scope = p_scope,
    updated_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has valid Google token
CREATE OR REPLACE FUNCTION public.has_valid_google_token()
RETURNS BOOLEAN AS $$
DECLARE
  token_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.oauth_credentials 
    WHERE user_id = auth.uid() 
    AND provider = 'google_sheets' 
    AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO token_exists;
  
  RETURN token_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create templates table for app templates
CREATE TABLE public.templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  popular BOOLEAN DEFAULT false,
  time TEXT,
  features TEXT[] NOT NULL,
  base_prompt TEXT,
  apps_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_prompt text
);

-- Create RLS policies for templates
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Policy to allow all authenticated users to view templates
CREATE POLICY "Authenticated users can view templates" 
  ON public.templates 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Function to get most popular templates
CREATE OR REPLACE FUNCTION public.get_popular_templates(limit_count INTEGER DEFAULT 5)
RETURNS SETOF public.templates AS $$
BEGIN
  RETURN QUERY
    SELECT * FROM public.templates
    ORDER BY apps_count DESC, created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get templates by category
CREATE OR REPLACE FUNCTION public.get_templates_by_category(category_name TEXT)
RETURNS SETOF public.templates AS $$
BEGIN
  RETURN QUERY
    SELECT * FROM public.templates
    WHERE category = category_name
    ORDER BY apps_count DESC, title ASC;
END;
$$ LANGUAGE plpgsql;

-- Insert initial template data
INSERT INTO public.templates (id, title, description, category, icon, color, popular, time, features, base_prompt, apps_count) VALUES
('feedback-form', 'Customer Feedback Form', 'Collect ratings, comments, and suggestions with automated follow-ups', 'Forms', 'MessageSquare', 'bg-blue-500', true, '2 min setup', ARRAY['Rating scales', 'File uploads', 'Email notifications', 'Analytics dashboard'], 'Create a customer feedback form with rating scales and comment fields', 24),
('sales-dashboard', 'Sales Dashboard', 'Track revenue, leads, and team performance with real-time charts', 'Dashboards', 'BarChart3', 'bg-green-500', true, '3 min setup', ARRAY['Revenue tracking', 'Lead pipeline', 'Team metrics', 'Goal tracking'], 'Build a sales dashboard with revenue charts and team performance metrics', 18),
('client-intake', 'Client Intake System', 'Streamline onboarding with forms, document collection, and workflows', 'Forms', 'FileText', 'bg-purple-500', false, '4 min setup', ARRAY['Multi-step forms', 'Document upload', 'Auto workflows', 'Client portal'], 'Create a client onboarding system with multi-step forms and document collection', 12),
('employee-directory', 'Employee Directory', 'Manage team contacts, roles, and organizational structure', 'Internal Tools', 'Users', 'bg-orange-500', false, '2 min setup', ARRAY['Contact management', 'Org chart', 'Search & filter', 'Role management'], 'Build an employee directory with search and organizational structure', 8),
('project-tracker', 'Project Tracker', 'Monitor project progress, tasks, and team collaboration', 'Internal Tools', 'Workflow', 'bg-teal-500', true, '5 min setup', ARRAY['Task management', 'Progress tracking', 'Team collaboration', 'Deadline alerts'], 'Create a project management tool with task tracking and team collaboration', 15),
('inventory-manager', 'Inventory Manager', 'Track stock levels, orders, and supplier information', 'Internal Tools', 'FolderOpen', 'bg-indigo-500', false, '3 min setup', ARRAY['Stock tracking', 'Low stock alerts', 'Supplier management', 'Order history'], 'Build an inventory management system with stock tracking and supplier information', 10),
('event-registration', 'Event Registration', 'Manage event signups, payments, and attendee communication', 'Forms', 'Users', 'bg-pink-500', false, '3 min setup', ARRAY['Registration forms', 'Payment processing', 'Email confirmations', 'Attendee list'], 'Create an event registration system with payment processing and attendee management', 9),
('expense-tracker', 'Expense Tracker', 'Track business expenses, receipts, and generate reports', 'Internal Tools', 'TrendingUp', 'bg-red-500', false, '2 min setup', ARRAY['Expense logging', 'Receipt upload', 'Category tracking', 'Monthly reports'], 'Build an expense tracking system with receipt uploads and reporting', 7);

-- Function to increment app count for a template
CREATE OR REPLACE FUNCTION public.increment_template_app_count(template_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.templates
  SET 
    apps_count = apps_count + 1,
    updated_at = NOW()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;
