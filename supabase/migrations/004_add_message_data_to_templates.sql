-- Add message_data JSONB column to templates for storing full message payload
ALTER TABLE templates
ADD COLUMN IF NOT EXISTS message_data JSONB;

-- Optional: index if you plan to query by specific keys frequently
-- CREATE INDEX IF NOT EXISTS idx_templates_message_data ON templates USING GIN (message_data);


