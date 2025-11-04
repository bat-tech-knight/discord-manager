-- Create scheduled_messages table
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  saved_message_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  payload JSONB,
  send_at TIMESTAMP WITH TIME ZONE,
  recurrence_cron TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  max_runs INTEGER,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_schedule_type CHECK (
    (send_at IS NOT NULL AND recurrence_cron IS NULL) OR
    (send_at IS NULL AND recurrence_cron IS NOT NULL)
  ),
  CONSTRAINT check_message_source CHECK (
    saved_message_id IS NOT NULL OR payload IS NOT NULL
  )
);

-- Create scheduled_message_runs table (audit log)
CREATE TABLE IF NOT EXISTS scheduled_message_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_message_id UUID NOT NULL REFERENCES scheduled_messages(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finished_at TIMESTAMP WITH TIME ZONE,
  success BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  discord_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_workspace_id ON scheduled_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_channel_id ON scheduled_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_next_run_at ON scheduled_messages(next_run_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_created_by ON scheduled_messages(created_by);
CREATE INDEX IF NOT EXISTS idx_scheduled_message_runs_scheduled_message_id ON scheduled_message_runs(scheduled_message_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_message_runs_started_at ON scheduled_message_runs(started_at);

-- Enable Row Level Security
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_message_runs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create them
DROP POLICY IF EXISTS "Users can view scheduled messages in their workspaces" ON scheduled_messages;
CREATE POLICY "Users can view scheduled messages in their workspaces" ON scheduled_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = scheduled_messages.workspace_id
      AND workspaces.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create scheduled messages in their workspaces" ON scheduled_messages;
CREATE POLICY "Users can create scheduled messages in their workspaces" ON scheduled_messages
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = scheduled_messages.workspace_id
      AND workspaces.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update scheduled messages in their workspaces" ON scheduled_messages;
CREATE POLICY "Users can update scheduled messages in their workspaces" ON scheduled_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = scheduled_messages.workspace_id
      AND workspaces.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete scheduled messages in their workspaces" ON scheduled_messages;
CREATE POLICY "Users can delete scheduled messages in their workspaces" ON scheduled_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = scheduled_messages.workspace_id
      AND workspaces.user_id = auth.uid()
    )
  );

-- Create RLS policies for scheduled_message_runs (users can view runs for their scheduled messages)
DROP POLICY IF EXISTS "Users can view runs for their scheduled messages" ON scheduled_message_runs;
CREATE POLICY "Users can view runs for their scheduled messages" ON scheduled_message_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scheduled_messages
      JOIN workspaces ON workspaces.id = scheduled_messages.workspace_id
      WHERE scheduled_messages.id = scheduled_message_runs.scheduled_message_id
      AND workspaces.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scheduled_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scheduled_messages_updated_at ON scheduled_messages;
CREATE TRIGGER scheduled_messages_updated_at
  BEFORE UPDATE ON scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_messages_updated_at();
