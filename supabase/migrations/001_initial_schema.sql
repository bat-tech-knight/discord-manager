-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  avatar_url TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create channels table
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  webhook_username TEXT,
  webhook_avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT,
  embed_data JSONB,
  settings_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  content TEXT,
  embed_data JSONB,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_channels_workspace_id ON channels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);

-- Enable Row Level Security
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for workspaces
CREATE POLICY "Users can view their own workspaces" ON workspaces
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workspaces" ON workspaces
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workspaces" ON workspaces
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workspaces" ON workspaces
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for channels
CREATE POLICY "Users can view channels in their workspaces" ON channels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = channels.workspace_id
      AND workspaces.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create channels in their workspaces" ON channels
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = channels.workspace_id
      AND workspaces.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update channels in their workspaces" ON channels
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = channels.workspace_id
      AND workspaces.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete channels in their workspaces" ON channels
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = channels.workspace_id
      AND workspaces.user_id = auth.uid()
    )
  );

-- Create RLS policies for templates
CREATE POLICY "Users can view their own templates" ON templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates" ON templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" ON templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" ON templates
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for messages
CREATE POLICY "Users can view messages in their channels" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channels
      JOIN workspaces ON workspaces.id = channels.workspace_id
      WHERE channels.id = messages.channel_id
      AND workspaces.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their channels" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM channels
      JOIN workspaces ON workspaces.id = channels.workspace_id
      WHERE channels.id = messages.channel_id
      AND workspaces.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages in their channels" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM channels
      JOIN workspaces ON workspaces.id = channels.workspace_id
      WHERE channels.id = messages.channel_id
      AND workspaces.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in their channels" ON messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM channels
      JOIN workspaces ON workspaces.id = channels.workspace_id
      WHERE channels.id = messages.channel_id
      AND workspaces.user_id = auth.uid()
    )
  );


