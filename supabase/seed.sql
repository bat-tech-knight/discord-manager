-- Seed script to set cron configuration from environment
-- This runs after migrations
-- You can also manually update these values:
-- UPDATE cron_config SET value = 'your-value' WHERE key = 'runner_url';
-- UPDATE cron_config SET value = 'your-secret' WHERE key = 'cron_secret';

-- Note: Database functions can't directly access .env files
-- You need to manually update these or use Supabase secrets in production
-- For local development, update after running migrations:
-- UPDATE cron_config SET value = 'http://host.docker.internal:3000/api/schedules/runner' WHERE key = 'runner_url';
-- UPDATE cron_config SET value = 'your-cron-secret-from-env' WHERE key = 'cron_secret';

