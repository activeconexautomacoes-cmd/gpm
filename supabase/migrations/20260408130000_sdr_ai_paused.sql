-- Flag para pausar a IA por lead
ALTER TABLE sdr_leads ADD COLUMN IF NOT EXISTS ai_paused boolean NOT NULL DEFAULT false;

-- Permitir que membros do workspace atualizem ai_paused
CREATE POLICY "Members can update ai_paused" ON sdr_leads
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
