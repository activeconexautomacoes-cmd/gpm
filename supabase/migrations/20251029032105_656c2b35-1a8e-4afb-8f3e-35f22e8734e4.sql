-- Criar bucket para anexos de oportunidades
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'opportunity-attachments',
  'opportunity-attachments',
  false,
  5242880, -- 5MB limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
);

-- Política para visualizar anexos (membros do workspace da oportunidade)
CREATE POLICY "Users can view opportunity attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'opportunity-attachments' 
  AND EXISTS (
    SELECT 1
    FROM opportunities o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND is_sales_role(auth.uid(), o.workspace_id)
  )
);

-- Política para fazer upload de anexos
CREATE POLICY "Users can upload opportunity attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'opportunity-attachments'
  AND EXISTS (
    SELECT 1
    FROM opportunities o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND (
        get_user_role(auth.uid(), o.workspace_id) = ANY (ARRAY['owner'::workspace_role, 'admin'::workspace_role, 'sales_manager'::workspace_role])
        OR o.assigned_sdr = auth.uid()
        OR o.assigned_closer = auth.uid()
      )
  )
);

-- Política para deletar anexos
CREATE POLICY "Users can delete opportunity attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'opportunity-attachments'
  AND EXISTS (
    SELECT 1
    FROM opportunities o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND (
        get_user_role(auth.uid(), o.workspace_id) = ANY (ARRAY['owner'::workspace_role, 'admin'::workspace_role, 'sales_manager'::workspace_role])
        OR o.assigned_sdr = auth.uid()
        OR o.assigned_closer = auth.uid()
      )
  )
);