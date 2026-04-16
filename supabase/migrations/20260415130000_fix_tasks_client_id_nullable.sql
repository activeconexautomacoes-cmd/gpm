-- Allow client_id to be null for checklist tasks (they come from opportunities, not clients)
ALTER TABLE tasks ALTER COLUMN client_id DROP NOT NULL;
