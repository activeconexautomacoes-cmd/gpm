-- Add unique constraint for clients email per workspace to enable UPSERT operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_workspace_email ON public.clients (workspace_id, email);
