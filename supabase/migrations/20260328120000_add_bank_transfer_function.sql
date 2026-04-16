CREATE OR REPLACE FUNCTION perform_bank_transfer(
  p_workspace_id UUID,
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount NUMERIC,
  p_date DATE,
  p_description TEXT DEFAULT 'Transferência entre Contas'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transfer_group_id UUID;
  v_from_tx_id UUID;
  v_to_tx_id UUID;
  v_from_account RECORD;
  v_to_account RECORD;
  v_new_from_balance NUMERIC;
  v_new_to_balance NUMERIC;
BEGIN
  -- Validate amount
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;

  -- Validate different accounts
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'As contas de origem e destino devem ser diferentes';
  END IF;

  -- Validate source account exists, belongs to workspace, and is active
  SELECT id, name, is_active, initial_balance INTO v_from_account
  FROM financial_bank_accounts
  WHERE id = p_from_account_id AND workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta de origem não encontrada neste workspace';
  END IF;

  IF v_from_account.is_active = false THEN
    RAISE EXCEPTION 'Conta de origem está inativa';
  END IF;

  -- Validate destination account exists, belongs to workspace, and is active
  SELECT id, name, is_active, initial_balance INTO v_to_account
  FROM financial_bank_accounts
  WHERE id = p_to_account_id AND workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta de destino não encontrada neste workspace';
  END IF;

  IF v_to_account.is_active = false THEN
    RAISE EXCEPTION 'Conta de destino está inativa';
  END IF;

  -- Generate transfer group ID
  v_transfer_group_id := gen_random_uuid();

  -- Insert outgoing transaction (source account)
  INSERT INTO financial_bank_transactions (
    workspace_id, bank_account_id, transaction_date, amount, description, status, fitid
  ) VALUES (
    p_workspace_id,
    p_from_account_id,
    p_date,
    -p_amount,
    '[Saída] ' || p_description,
    'reconciled',
    'TRF_OUT_' || v_transfer_group_id::TEXT
  )
  RETURNING id INTO v_from_tx_id;

  -- Insert incoming transaction (destination account)
  INSERT INTO financial_bank_transactions (
    workspace_id, bank_account_id, transaction_date, amount, description, status, fitid
  ) VALUES (
    p_workspace_id,
    p_to_account_id,
    p_date,
    p_amount,
    '[Entrada] ' || p_description,
    'reconciled',
    'TRF_IN_' || v_transfer_group_id::TEXT
  )
  RETURNING id INTO v_to_tx_id;

  -- Recalculate source balance from initial_balance + sum of all transactions (single source of truth)
  SELECT COALESCE(v_from_account.initial_balance, 0) + COALESCE(SUM(amount), 0)
  INTO v_new_from_balance
  FROM financial_bank_transactions
  WHERE bank_account_id = p_from_account_id;

  UPDATE financial_bank_accounts
  SET current_balance = v_new_from_balance
  WHERE id = p_from_account_id;

  -- Recalculate destination balance from initial_balance + sum of all transactions
  SELECT COALESCE(v_to_account.initial_balance, 0) + COALESCE(SUM(amount), 0)
  INTO v_new_to_balance
  FROM financial_bank_transactions
  WHERE bank_account_id = p_to_account_id;

  UPDATE financial_bank_accounts
  SET current_balance = v_new_to_balance
  WHERE id = p_to_account_id;

  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'transfer_group_id', v_transfer_group_id,
    'from_transaction_id', v_from_tx_id,
    'to_transaction_id', v_to_tx_id,
    'from_balance', v_new_from_balance,
    'to_balance', v_new_to_balance
  );
END;
$$;
