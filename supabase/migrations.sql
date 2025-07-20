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
CREATE TABLE secure.oauth_credentials (
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
CREATE OR REPLACE FUNCTION secure.store_oauth_token(
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

-- Check if user has valid Google Sheets token
CREATE OR REPLACE FUNCTION public.has_valid_google_token()
RETURNS BOOLEAN AS $$
DECLARE
  token_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM secure.oauth_credentials 
    WHERE user_id = auth.uid() 
    AND provider = 'google' 
    AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO token_exists;
  
  RETURN token_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
