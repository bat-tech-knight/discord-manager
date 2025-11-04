/**
 * Script to sync cron configuration from .env to Supabase database
 * This updates the Edge Function URL used by pg_cron
 * Run: npx tsx scripts/sync-cron-config.ts
 */

import { createClient } from '@supabase/supabase-js';
// @ts-ignore - dotenv types may not be available
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncConfig() {
  // TypeScript knows supabaseUrl is defined here due to the check above
  if (!supabaseUrl) {
    throw new Error('supabaseUrl is not defined');
  }
  const url = supabaseUrl;
  
  // Extract project ref from Supabase URL (e.g., https://xyz.supabase.co -> xyz)
  const urlMatch = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  const projectRef = urlMatch ? urlMatch[1] : null;
  
  // Determine Edge Function URL
  // For local: http://host.docker.internal:54321/functions/v1/process-scheduled-messages
  //   (host.docker.internal allows database container to reach host machine)
  // For production: https://{project_ref}.supabase.co/functions/v1/process-scheduled-messages
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  const edgeFunctionUrl = isLocal
    ? 'http://host.docker.internal:54321/functions/v1/process-scheduled-messages'
    : projectRef
    ? `https://${projectRef}.supabase.co/functions/v1/process-scheduled-messages`
    : process.env.EDGE_FUNCTION_URL || 'http://host.docker.internal:54321/functions/v1/process-scheduled-messages';

  // Get auth key (anon key for Edge Functions)
  // Note: NEXT_PUBLIC_SUPABASE_ANON_KEY and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are the same thing
  // For local: use default local anon key
  // For production: use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY from .env
  const authKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
      || process.env.SUPABASE_ANON_KEY 
      || '';

  if (!authKey && !isLocal) {
    console.error('⚠️  Warning: Supabase anon key not found in .env.local');
    console.error('   Edge Functions require an auth key. Set one of these:');
    console.error('   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (used in this project)');
    console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY (alternative name, same key)');
  }

  console.log('Syncing cron configuration...');
  console.log(`Edge Function URL: ${edgeFunctionUrl}`);
  console.log(`Supabase URL: ${url}`);
  console.log(`Is Local: ${isLocal}`);
  if (authKey) {
    const envKeyName = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 
      ? 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' 
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
      ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
      : 'default';
    console.log(`Auth Key: ${authKey.substring(0, 20)}... (${isLocal ? 'local default' : `from ${envKeyName}`})`);
  }

  // Update edge_function_url
  const { error: urlError } = await supabase
    .from('cron_config')
    .upsert(
      { 
        key: 'edge_function_url', 
        value: edgeFunctionUrl,
        description: 'URL for the scheduled messages Edge Function'
      }, 
      { onConflict: 'key' }
    );

  if (urlError) {
    console.error('Error updating edge_function_url:', urlError);
    return;
  }

  // Update auth key
  if (authKey) {
    const { error: authError } = await supabase
      .from('cron_config')
      .upsert(
        { 
          key: 'edge_function_auth_key', 
          value: authKey,
          description: 'Authorization key for Edge Function (Supabase anon key)'
        }, 
        { onConflict: 'key' }
      );

    if (authError) {
      console.error('Error updating edge_function_auth_key:', authError);
      return;
    }
  }

  console.log('✓ Cron configuration synced successfully!');
  console.log('\nNote: Make sure your Edge Function is deployed:');
  console.log('  Local: supabase functions serve process-scheduled-messages');
  console.log('  Production: supabase functions deploy process-scheduled-messages');
}

syncConfig().catch(console.error);
