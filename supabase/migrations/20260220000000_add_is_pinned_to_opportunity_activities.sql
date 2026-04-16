ALTER TABLE opportunity_notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE opportunity_attachments ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
