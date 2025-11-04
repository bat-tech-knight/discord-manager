-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Try to enable pg_net extension (used to call Edge Functions)
-- pg_net is more commonly available than http in Supabase
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
  GRANT USAGE ON SCHEMA net TO postgres;
  RAISE NOTICE 'pg_net extension enabled';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'pg_net extension not available: %. Please enable it in supabase/config.toml under [db.extensions] or use an external cron service.', SQLERRM;
END $$;

-- Grant necessary permissions for cron
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create a configuration table for Edge Function URL
CREATE TABLE IF NOT EXISTS cron_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default Edge Function URL (for local development)
-- Use host.docker.internal so the database container can reach the host machine
INSERT INTO cron_config (key, value, description) VALUES
  ('edge_function_url', 'http://host.docker.internal:54321/functions/v1/process-scheduled-messages', 'URL for the scheduled messages Edge Function')
ON CONFLICT (key) DO NOTHING;

-- Insert default auth key (local Supabase anon key - will be updated by sync script)
-- For production, run: npm run sync-cron-config (syncs from NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY)
-- Note: These are the same key, just different naming conventions
INSERT INTO cron_config (key, value, description) VALUES
  ('edge_function_auth_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0', 'Authorization key for Edge Function (Supabase anon/publishable key)')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT SELECT ON cron_config TO postgres;
ALTER TABLE cron_config ENABLE ROW LEVEL SECURITY;

-- Create policy for service role (cron jobs run as postgres)
DROP POLICY IF EXISTS "Service role can read cron config" ON cron_config;
CREATE POLICY "Service role can read cron config" ON cron_config
  FOR SELECT USING (true);

-- Drop existing cron job if it exists (in case we need to update it)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-messages') THEN
    PERFORM cron.unschedule('process-scheduled-messages');
  END IF;
END $$;

-- Create a function to call the Edge Function
CREATE OR REPLACE FUNCTION call_scheduled_messages_edge_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT;
  auth_key TEXT;
  net_request_id BIGINT;
  pg_net_available BOOLEAN;
BEGIN
  -- Check if pg_net is available
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') INTO pg_net_available;

  IF NOT pg_net_available THEN
    RAISE WARNING 'pg_net extension not available. Cannot call Edge Function. Please enable pg_net extension or use an external cron service to call the Edge Function.';
    RETURN;
  END IF;

  -- Get Edge Function URL from config
  SELECT value INTO edge_function_url
  FROM cron_config
  WHERE key = 'edge_function_url';
  
  -- Use default if not configured
  -- Use host.docker.internal so the database container can reach the host machine
  edge_function_url := COALESCE(edge_function_url, 'http://host.docker.internal:54321/functions/v1/process-scheduled-messages');

  -- Get authorization key (Supabase anon/publishable key) from config
  -- This is the NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY from your .env file
  -- Note: These are the same key, just different naming conventions
  -- For local: default key (doesn't expire in local dev)
  -- For production: must be set via sync-cron-config script
  SELECT value INTO auth_key
  FROM cron_config
  WHERE key = 'edge_function_auth_key';
  
  -- If not configured, use default local Supabase anon key (for local dev only)
  auth_key := COALESCE(auth_key, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0');

  -- Debug: log auth key status (first 20 chars for security)
  IF auth_key IS NULL THEN
    RAISE WARNING 'auth_key is NULL! Edge Function call will fail. Please set edge_function_auth_key in cron_config.';
  ELSE
    RAISE NOTICE 'Using auth key: %... (length: %)', LEFT(auth_key, 20), LENGTH(auth_key);
  END IF;

  -- Call Edge Function via pg_net
  BEGIN
    -- Build headers with auth
    DECLARE
      auth_header TEXT;
    BEGIN
      auth_header := 'Bearer ' || COALESCE(auth_key, '');
      IF auth_key IS NULL OR auth_key = '' THEN
        RAISE WARNING 'Cannot call Edge Function: auth_key is missing or empty';
        RETURN;
      END IF;
      
      -- Use Authorization header with Bearer token (Supabase Edge Functions require JWT)
      -- Also include x-apikey header as some Supabase clients use this
      SELECT net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', auth_header,
          'x-apikey', auth_key,
          'apikey', auth_key
        ),
        body := '{}'::jsonb
      ) INTO net_request_id;
      
      RAISE NOTICE 'Called Edge Function via pg_net (request_id: %, url: %, auth_header_length: %)', 
        net_request_id, edge_function_url, LENGTH(auth_header);
    END;
    
    -- Wait a bit for the request to complete and check status
    PERFORM pg_sleep(0.5);
    
    -- Check the request status (optional - for debugging)
    -- This will help identify if the Edge Function is responding
    DECLARE
      req_status TEXT;
    BEGIN
      SELECT status INTO req_status FROM net.http_request_queue WHERE id = net_request_id;
      IF req_status IS NOT NULL AND req_status != 'success' THEN
        RAISE WARNING 'Edge Function request status: % (request_id: %)', req_status, net_request_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- net.http_request_queue might not be available, ignore
        NULL;
    END;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Error calling Edge Function (url: %): %', edge_function_url, SQLERRM;
  END;
END;
$$;

-- Schedule the cron job to run every minute
SELECT cron.schedule(
  'process-scheduled-messages',
  '* * * * *', -- Every minute
  $$SELECT call_scheduled_messages_edge_function();$$
);

-- Grant execute permission
GRANT EXECUTE ON FUNCTION call_scheduled_messages_edge_function() TO postgres;

-- Helper function to update cron config
CREATE OR REPLACE FUNCTION update_cron_config(config_key TEXT, config_value TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO cron_config (key, value, updated_at)
  VALUES (config_key, config_value, NOW())
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION update_cron_config(TEXT, TEXT) TO postgres;

-- Instructions comment
COMMENT ON FUNCTION call_scheduled_messages_edge_function() IS 
'Calls the Supabase Edge Function to process scheduled messages. Uses pg_net extension to make HTTP requests. Configuration is stored in cron_config table.';

COMMENT ON TABLE cron_config IS 
$$Configuration for cron jobs. Update edge_function_url to match your environment:
- Local: http://host.docker.internal:54321/functions/v1/process-scheduled-messages
  (host.docker.internal allows database container to reach host machine)
- Production: https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-scheduled-messages

To update: SELECT update_cron_config('edge_function_url', 'your-url-here');$$;

COMMENT ON TABLE scheduled_messages IS 
'Scheduled messages are processed by a Supabase Edge Function called by pg_cron every minute. The Edge Function handles all message processing logic, including Discord webhook calls.';
