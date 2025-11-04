/**
 * Debug script to check scheduled messages setup
 * Run: npx tsx scripts/debug-scheduled-messages.ts
 */

import { createClient } from '@supabase/supabase-js';
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

async function debug() {
  console.log('🔍 Debugging Scheduled Messages Setup\n');
  
  // 1. Check cron_config
  console.log('1. Checking cron_config...');
  const { data: config, error: configError } = await supabase
    .from('cron_config')
    .select('*');
  
  if (configError) {
    console.log(`   ❌ Error: ${configError.message}`);
  } else if (config && config.length > 0) {
    console.log('   ✅ cron_config found:');
    config.forEach((item: any) => {
      if (item.key === 'edge_function_auth_key') {
        // Mask the auth key for security
        const masked = item.value ? `${item.value.substring(0, 20)}... (${item.value.length} chars)` : 'not set';
        console.log(`      ${item.key}: ${masked}`);
      } else {
        console.log(`      ${item.key}: ${item.value}`);
      }
    });
    
    // Check if auth key is configured
    const authKey = config.find((item: any) => item.key === 'edge_function_auth_key');
    if (!authKey || !authKey.value) {
      console.log('   ⚠️  edge_function_auth_key not configured!');
      console.log('   💡 Run: npm run sync-cron-config');
    } else {
      // Check if it's the default local key or a production key
      const isDefaultLocal = authKey.value === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
      if (isDefaultLocal) {
        console.log('   ℹ️  Using default local anon key (OK for local dev)');
      } else {
        console.log('   ✅ Using custom anon key (from .env)');
      }
    }
  } else {
    console.log('   ⚠️  No cron_config entries found');
    console.log('   💡 Run: npm run sync-cron-config');
  }
  console.log();

  // 2. Check scheduled messages
  console.log('2. Checking scheduled messages...');
  const now = new Date().toISOString();
  const { data: schedules, error: schedulesError } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('status', 'active')
    .order('next_run_at', { ascending: true })
    .limit(10);
  
  if (schedulesError) {
    console.log(`   ❌ Error: ${schedulesError.message}`);
  } else if (schedules && schedules.length > 0) {
    console.log(`   ✅ Found ${schedules.length} active scheduled messages:`);
    schedules.forEach((schedule: any) => {
      const nextRun = schedule.next_run_at ? new Date(schedule.next_run_at) : null;
      const isDue = nextRun && nextRun <= new Date();
      const status = isDue ? '🟢 DUE' : '⏳ Pending';
      console.log(`      ${status} - ID: ${schedule.id}, Name: ${schedule.name || 'N/A'}`);
      console.log(`         Next run: ${schedule.next_run_at || 'N/A'}`);
      console.log(`         Status: ${schedule.status}`);
      if (schedule.last_error) {
        console.log(`         ❌ Last error: ${schedule.last_error}`);
      }
    });
    
    const dueSchedules = schedules.filter((s: any) => 
      s.next_run_at && new Date(s.next_run_at) <= new Date()
    );
    if (dueSchedules.length === 0) {
      console.log('   ⚠️  No messages are due yet');
    } else {
      console.log(`   ✅ ${dueSchedules.length} message(s) are due`);
    }
  } else {
    console.log('   ⚠️  No active scheduled messages found');
  }
  console.log();

  // 3. Check Edge Function availability
  console.log('3. Checking Edge Function URL and Auth...');
  const { data: edgeUrl } = await supabase
    .from('cron_config')
    .select('value')
    .eq('key', 'edge_function_url')
    .single();
  
  const { data: authKey } = await supabase
    .from('cron_config')
    .select('value')
    .eq('key', 'edge_function_auth_key')
    .single();
  
  if (edgeUrl) {
    console.log(`   ✅ Edge Function URL: ${edgeUrl.value}`);
    if (authKey && authKey.value) {
      console.log(`   ✅ Auth Key: ${authKey.value.substring(0, 20)}... (configured)`);
    } else {
      console.log(`   ⚠️  Auth Key: Not configured`);
      console.log(`   💡 Run: npm run sync-cron-config`);
    }
    console.log('   💡 Make sure the Edge Function is running:');
    console.log('      supabase functions serve process-scheduled-messages');
    console.log();
    
    // Try to call the Edge Function
    console.log('   Testing Edge Function connectivity...');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      
      // Add auth header if available
      if (authKey && authKey.value) {
        headers['Authorization'] = `Bearer ${authKey.value}`;
        console.log('   📤 Calling with Authorization header...');
      } else {
        console.log('   ⚠️  Calling without Authorization header (may fail)');
      }
      
      const response = await fetch(edgeUrl.value, {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`   ✅ Edge Function is accessible! Response:`, result);
      } else {
        console.log(`   ⚠️  Edge Function returned status ${response.status}`);
        const text = await response.text();
        console.log(`   Response: ${text.substring(0, 200)}`);
        if (response.status === 401) {
          console.log('   💡 This looks like an auth error - check edge_function_auth_key in cron_config');
        }
      }
    } catch (error) {
      console.log(`   ❌ Cannot reach Edge Function: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('   💡 Start it with: supabase functions serve process-scheduled-messages');
    }
  } else {
    console.log('   ⚠️  Edge Function URL not configured');
    console.log('   💡 Run: npm run sync-cron-config');
  }
  console.log();

  // 4. SQL queries to run manually
  console.log('📋 Run these SQL queries in Supabase SQL Editor for more details:\n');
  console.log('   -- Check pg_net extension:');
  console.log('   SELECT * FROM pg_extension WHERE extname = \'pg_net\';\n');
  console.log('   -- Check cron job:');
  console.log('   SELECT * FROM cron.job WHERE jobname = \'process-scheduled-messages\';\n');
  console.log('   -- Check recent cron runs:');
  console.log('   SELECT * FROM cron.job_run_details WHERE jobid = 1 ORDER BY start_time DESC LIMIT 10;\n');
  console.log('   -- Check messages due now:');
  console.log('   SELECT id, name, next_run_at, NOW() as current_time,');
  console.log('          (next_run_at <= NOW()) as is_due');
  console.log('   FROM scheduled_messages');
  console.log('   WHERE status = \'active\'');
  console.log('   ORDER BY next_run_at ASC;\n');

  console.log('📋 Summary:');
  console.log('   Most common issues:');
  console.log('   1. ❌ Edge Function not running → Start: supabase functions serve process-scheduled-messages');
  console.log('   2. ❌ Edge Function URL not configured → Run: npm run sync-cron-config');
  console.log('   3. ❌ Auth key not configured → Run: npm run sync-cron-config (syncs from NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  console.log('   4. ❌ pg_net extension not enabled → Check migration ran successfully');
  console.log('   5. ⚠️  No messages are due yet → Check next_run_at times');
  console.log('   6. ❌ Messages have errors → Check last_error column');
}

debug().catch(console.error);
