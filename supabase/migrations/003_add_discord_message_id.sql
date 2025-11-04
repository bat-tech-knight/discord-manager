-- Add discord_message_id column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS discord_message_id TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_messages_discord_message_id ON messages(discord_message_id);

