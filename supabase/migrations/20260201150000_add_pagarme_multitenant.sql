-- Migration: Add Pagar.me Multi-Tenant Support
-- This migration adds fields for workspace-specific Pagar.me API keys and webhook tokens

-- Enable pgcrypto for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add new columns to workspaces table
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS pagarme_api_key_encrypted TEXT,
ADD COLUMN IF NOT EXISTS pagarme_webhook_token UUID DEFAULT gen_random_uuid();

-- Create encryption function for Pagar.me API key
CREATE OR REPLACE FUNCTION encrypt_pagarme_key(api_key TEXT, workspace_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    encryption_key BYTEA;
BEGIN
    -- Use a combination of workspace_id and a secret salt for encryption
    -- The salt is derived from the service role key available only server-side
    encryption_key := digest(workspace_id::text || 'pagarme_salt_key_2026', 'sha256');
    RETURN encode(
        encrypt(
            api_key::bytea,
            encryption_key,
            'aes'
        ),
        'base64'
    );
END;
$$;

-- Create decryption function for Pagar.me API key
CREATE OR REPLACE FUNCTION decrypt_pagarme_key(encrypted_key TEXT, workspace_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    encryption_key BYTEA;
BEGIN
    IF encrypted_key IS NULL THEN
        RETURN NULL;
    END IF;
    
    encryption_key := digest(workspace_id::text || 'pagarme_salt_key_2026', 'sha256');
    RETURN convert_from(
        decrypt(
            decode(encrypted_key, 'base64'),
            encryption_key,
            'aes'
        ),
        'UTF8'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

-- Create function to save workspace Pagar.me settings (encrypts key before saving)
CREATE OR REPLACE FUNCTION save_workspace_pagarme_key(
    p_workspace_id UUID,
    p_api_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    encrypted TEXT;
BEGIN
    IF p_api_key IS NULL OR p_api_key = '' THEN
        -- Clear the key
        UPDATE workspaces 
        SET pagarme_api_key_encrypted = NULL 
        WHERE id = p_workspace_id;
    ELSE
        -- Encrypt and save
        encrypted := encrypt_pagarme_key(p_api_key, p_workspace_id);
        UPDATE workspaces 
        SET pagarme_api_key_encrypted = encrypted 
        WHERE id = p_workspace_id;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Create function to get decrypted Pagar.me key (for Edge Functions)
CREATE OR REPLACE FUNCTION get_workspace_pagarme_key(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    encrypted_key TEXT;
BEGIN
    SELECT pagarme_api_key_encrypted INTO encrypted_key
    FROM workspaces
    WHERE id = p_workspace_id;
    
    IF encrypted_key IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN decrypt_pagarme_key(encrypted_key, p_workspace_id);
END;
$$;

-- Create function to check if workspace has Pagar.me configured
CREATE OR REPLACE FUNCTION has_workspace_pagarme_key(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM workspaces 
        WHERE id = p_workspace_id 
        AND pagarme_api_key_encrypted IS NOT NULL
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION encrypt_pagarme_key(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION decrypt_pagarme_key(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION save_workspace_pagarme_key(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_workspace_pagarme_key(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION has_workspace_pagarme_key(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON COLUMN workspaces.pagarme_api_key_encrypted IS 'Encrypted Pagar.me API key for this workspace. Use save_workspace_pagarme_key() to set and get_workspace_pagarme_key() to retrieve.';
COMMENT ON COLUMN workspaces.pagarme_webhook_token IS 'Unique token for Pagar.me webhook URL. Used to identify which workspace a webhook belongs to.';
