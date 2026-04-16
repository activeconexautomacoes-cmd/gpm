-- 1. Alterar tabela PRODUCTS
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS signature_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_type TEXT CHECK (recurrence_type IN ('one_time', 'monthly', 'yearly', 'custom'));

-- 2. Alterar tabela OPPORTUNITIES
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS is_signed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS contract_url TEXT,
ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE;

-- 3. Função de Validação (Obriga assinatura se necessário)
CREATE OR REPLACE FUNCTION public.fn_validate_opportunity_won()
RETURNS TRIGGER AS $$
DECLARE
    v_stage_name text;
    v_has_required_signature boolean;
BEGIN
    SELECT name INTO v_stage_name FROM public.opportunity_stages WHERE id = NEW.current_stage_id;
    
    IF v_stage_name ILIKE '%Ganho%' OR v_stage_name ILIKE '%Won%' THEN
        SELECT EXISTS (
            SELECT 1 
            FROM public.opportunity_products op
            JOIN public.products p ON p.id = op.product_id
            WHERE op.opportunity_id = NEW.id
            AND p.signature_required = true
        ) INTO v_has_required_signature;

        IF v_has_required_signature AND NEW.is_signed = false AND (NEW.contract_signature_status IS DISTINCT FROM 'signed') THEN
            RAISE EXCEPTION 'Ação bloqueada: É necessário ter o contrato assinado para marcar como Ganho.';
        END IF;

        IF (NEW.is_signed = true OR NEW.contract_signature_status = 'signed') AND NEW.signed_at IS NULL THEN
            NEW.signed_at = NOW();
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_opportunity_won ON public.opportunities;
CREATE TRIGGER tr_validate_opportunity_won
    BEFORE UPDATE ON public.opportunities
    FOR EACH ROW
    WHEN (OLD.current_stage_id IS DISTINCT FROM NEW.current_stage_id)
    EXECUTE FUNCTION public.fn_validate_opportunity_won();

-- 4. Função de Automação Financeira (v5 - Security Definer)
CREATE OR REPLACE FUNCTION public.fn_automate_won_opportunity()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stage_name text;
    v_item RECORD;
    v_contract_id uuid;
    v_one_time_id uuid;
    v_pagarme_account_id uuid;
    v_title text;
    v_current_date date;
    v_price numeric;
BEGIN
    -- Configs
    v_current_date := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
    v_title := COALESCE(NEW.lead_company, NEW.lead_name, 'Lead Sem Nome');

    SELECT name INTO v_stage_name FROM public.opportunity_stages WHERE id = NEW.current_stage_id;

    -- Só executa se for Ganho e mudou de estágio
    IF (v_stage_name ILIKE '%Ganho%' OR v_stage_name ILIKE '%Won%') AND (OLD.current_stage_id IS DISTINCT FROM NEW.current_stage_id) THEN
        
        -- Idempotência
        IF EXISTS (SELECT 1 FROM public.contracts WHERE opportunity_id = NEW.id) THEN
            RETURN NEW;
        END IF;

        SELECT id INTO v_pagarme_account_id FROM public.financial_bank_accounts 
        WHERE workspace_id = NEW.workspace_id AND name ILIKE '%Pagar.me%' LIMIT 1;

        FOR v_item IN 
            SELECT op.*, p.name as product_name, p.recurrence_type, p.type as p_type
            FROM public.opportunity_products op
            JOIN public.products p ON p.id = op.product_id
            WHERE op.opportunity_id = NEW.id
        LOOP
            -- Garantir valor numérico
            v_price := COALESCE(v_item.negotiated_price, 0);

            -- Lógica Recorrente
            IF v_item.recurrence_type IN ('monthly', 'yearly', 'custom') OR v_item.p_type::text = 'service' THEN
                
                INSERT INTO public.contracts (
                    workspace_id, client_id, name, value, status, start_date, opportunity_id
                ) VALUES (
                    NEW.workspace_id, NEW.converted_client_id, 
                    'Contrato: ' || v_title, 
                    v_price, 
                    'active', 
                    v_current_date, 
                    NEW.id
                ) RETURNING id INTO v_contract_id;

                INSERT INTO public.contract_billings (
                    workspace_id, contract_id, due_date, amount, final_amount, status
                ) VALUES (
                    NEW.workspace_id, v_contract_id, 
                    v_current_date, 
                    v_price, v_price, 
                    COALESCE(NEW.payment_status, 'pending')
                );
                
                IF NEW.payment_status = 'paid' THEN
                    INSERT INTO public.financial_receivables (
                        workspace_id, title, description, amount, total_amount, due_date, status, payment_date, contract_id, client_id, bank_account_id
                    ) VALUES (
                        NEW.workspace_id, 
                        'Mensalidade Inicial - ' || v_title, 
                        'Pagamento inicial contrato', 
                        v_price, v_price, 
                        v_current_date, 
                        'paid', 
                        v_current_date, 
                        v_contract_id, NEW.converted_client_id, v_pagarme_account_id
                    );
                END IF;

            ELSE
                -- Venda Avulsa
                SELECT id INTO v_one_time_id FROM public.one_time_sales 
                WHERE opportunity_id = NEW.id LIMIT 1;

                IF v_one_time_id IS NULL THEN
                    INSERT INTO public.one_time_sales (
                        workspace_id, client_id, opportunity_id, description, amount, status, sale_date
                    ) VALUES (
                        NEW.workspace_id, NEW.converted_client_id, NEW.id, 
                        'Venda: ' || v_title, v_price, 
                        COALESCE(NEW.payment_status, 'pending'),
                        v_current_date
                    ) RETURNING id INTO v_one_time_id;
                ELSE
                    IF NEW.payment_status = 'paid' THEN
                        UPDATE public.one_time_sales 
                        SET status = 'paid', payment_date = v_current_date 
                        WHERE id = v_one_time_id;
                    END IF;
                END IF;

                IF NEW.payment_status = 'paid' THEN
                     INSERT INTO public.financial_receivables (
                            workspace_id, title, description, amount, total_amount, due_date, status, payment_date, one_time_sale_id, client_id, bank_account_id
                        ) VALUES (
                            NEW.workspace_id, 'Venda Avulsa - ' || v_title, 'Recebimento Venda', 
                            v_price, v_price, 
                            v_current_date, 'paid', v_current_date, 
                            v_one_time_id, NEW.converted_client_id, v_pagarme_account_id
                        )
                        ON CONFLICT (one_time_sale_id) DO UPDATE SET 
                            status = 'paid', 
                            payment_date = v_current_date, 
                            bank_account_id = v_pagarme_account_id;
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
