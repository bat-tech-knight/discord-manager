-- Fix the foreign key constraint: drop the old one (if it references messages) and add one for templates
ALTER TABLE scheduled_messages
  DROP CONSTRAINT IF EXISTS scheduled_messages_saved_message_id_fkey;

-- Add foreign key constraint to templates table instead
DO $$
BEGIN
  -- Only add the constraint if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'scheduled_messages_saved_message_id_fkey'
  ) THEN
    ALTER TABLE scheduled_messages
      ADD CONSTRAINT scheduled_messages_saved_message_id_fkey
      FOREIGN KEY (saved_message_id) 
      REFERENCES templates(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

