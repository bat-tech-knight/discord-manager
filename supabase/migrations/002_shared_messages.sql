-- Create shared_messages table
CREATE TABLE IF NOT EXISTS shared_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_shared_messages_user_id ON shared_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_messages_created_at ON shared_messages(created_at);

-- Enable Row Level Security
ALTER TABLE shared_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for shared_messages
CREATE POLICY "Users can view their own shared messages" ON shared_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own shared messages" ON shared_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shared messages" ON shared_messages
  FOR DELETE USING (auth.uid() = user_id);

-- Allow public read access for shared messages (for sharing functionality)
CREATE POLICY "Public can view shared messages" ON shared_messages
  FOR SELECT USING (true);

