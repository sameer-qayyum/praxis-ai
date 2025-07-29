-- SQL function to bypass RLS and fetch app_versions records for debugging
-- Run this in the Supabase SQL editor

CREATE OR REPLACE FUNCTION admin_get_app_versions(app_id_param TEXT)
RETURNS SETOF app_versions
LANGUAGE plpgsql
SECURITY DEFINER -- This means it will run with the privileges of the creator (i.e., bypass RLS)
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM app_versions
  WHERE app_id = app_id_param
  ORDER BY version_number DESC;
END;
$$;
