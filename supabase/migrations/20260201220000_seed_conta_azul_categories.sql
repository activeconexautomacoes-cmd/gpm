-- Migration: Seed standard financial categories (Conta Azul model 2024 hierarchy)
-- This migration creates a function to seed a workspace with standard "Despesas" categories
-- It automatically runs for NEW workspaces via a trigger
-- It runs immediately for EXISTING workspaces (via DO block)

CREATE OR REPLACE FUNCTION public.seed_default_financial_categories(target_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- IDs for Parent Categories
    v_op_id UUID;
    v_adm_id UUID;
    v_pes_id UUID;
    v_com_id UUID;
    v_fin_id UUID;
    v_trib_id UUID;
    v_cost_id UUID;
    v_inv_id UUID;
    v_exists BOOLEAN;
BEGIN
    -- Check if 'expense' categories already exist for this workspace
    -- If they do, we assume the user has already set up their chart of accounts.
    -- We skip to avoid duplicating or messing up existing data.
    SELECT EXISTS (
        SELECT 1 FROM public.financial_categories
        WHERE workspace_id = target_workspace_id
        AND type = 'expense'
        LIMIT 1
    ) INTO v_exists;

    IF v_exists THEN
        RETURN;
    END IF;

    -------------------------------------------------------
    -- 1. Despesas Operacionais (Root)
    -------------------------------------------------------
    INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active, "order")
    VALUES (target_workspace_id, 'Despesas Operacionais', 'expense', NULL, true, 10)
    RETURNING id INTO v_op_id;

        -- 1.1 Despesas Administrativas
        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active, "order")
        VALUES (target_workspace_id, 'Despesas Administrativas', 'expense', v_op_id, true, 11)
        RETURNING id INTO v_adm_id;

            INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
            (target_workspace_id, 'Água e Esgoto', 'expense', v_adm_id, true),
            (target_workspace_id, 'Aluguel e Condomínio', 'expense', v_adm_id, true),
            (target_workspace_id, 'Consultoria e Serviços de Terceiros', 'expense', v_adm_id, true),
            (target_workspace_id, 'Correios e Entregas', 'expense', v_adm_id, true),
            (target_workspace_id, 'Energia Elétrica', 'expense', v_adm_id, true),
            (target_workspace_id, 'Internet e Telefone', 'expense', v_adm_id, true),
            (target_workspace_id, 'Limpeza e Conservação', 'expense', v_adm_id, true),
            (target_workspace_id, 'Manutenção e Reparos', 'expense', v_adm_id, true),
            (target_workspace_id, 'Material de Escritório', 'expense', v_adm_id, true),
            (target_workspace_id, 'Seguros', 'expense', v_adm_id, true),
            (target_workspace_id, 'Viagens e Estadias', 'expense', v_adm_id, true);

        -- 1.2 Despesas com Pessoal
        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active, "order")
        VALUES (target_workspace_id, 'Despesas com Pessoal', 'expense', v_op_id, true, 12)
        RETURNING id INTO v_pes_id;

            INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
            (target_workspace_id, 'Salários e Ordenados', 'expense', v_pes_id, true),
            (target_workspace_id, 'Pró-labore', 'expense', v_pes_id, true),
            (target_workspace_id, 'Encargos Sociais (FGTS, INSS)', 'expense', v_pes_id, true),
            (target_workspace_id, 'Vale Refeição / Alimentação', 'expense', v_pes_id, true),
            (target_workspace_id, 'Vale Transporte', 'expense', v_pes_id, true),
            (target_workspace_id, 'Comissões e Prêmios', 'expense', v_pes_id, true),
            (target_workspace_id, 'Treinamento e Desenvolvimento', 'expense', v_pes_id, true);

        -- 1.3 Despesas de Comercialização e Vendas
        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active, "order")
        VALUES (target_workspace_id, 'Despesas de Comercialização e Vendas', 'expense', v_op_id, true, 13)
        RETURNING id INTO v_com_id;

            INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
            (target_workspace_id, 'Publicidade e Propaganda', 'expense', v_com_id, true),
            (target_workspace_id, 'Marketing Digital e Eventos', 'expense', v_com_id, true),
            (target_workspace_id, 'Brindes e Bonificações', 'expense', v_com_id, true),
            (target_workspace_id, 'Fretes sobre Vendas', 'expense', v_com_id, true),
            (target_workspace_id, 'Taxas de Meios de Pagamento', 'expense', v_com_id, true);

    -------------------------------------------------------
    -- 2. Despesas Financeiras
    -------------------------------------------------------
    INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active, "order")
    VALUES (target_workspace_id, 'Despesas Financeiras', 'expense', NULL, true, 20)
    RETURNING id INTO v_fin_id;

        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'Tarifas Bancárias', 'expense', v_fin_id, true),
        (target_workspace_id, 'Juros e Multas Pagos', 'expense', v_fin_id, true),
        (target_workspace_id, 'IOF', 'expense', v_fin_id, true),
        (target_workspace_id, 'Juros sobre Empréstimos e Financiamentos', 'expense', v_fin_id, true);

    -------------------------------------------------------
    -- 3. Despesas Tributárias
    -------------------------------------------------------
    INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active, "order")
    VALUES (target_workspace_id, 'Despesas Tributárias', 'expense', NULL, true, 30)
    RETURNING id INTO v_trib_id;

        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'Impostos sobre Faturamento (Simples Nacional/DAS, ISS, ICMS)', 'expense', v_trib_id, true),
        (target_workspace_id, 'Impostos sobre o Lucro (IRPJ e CSLL)', 'expense', v_trib_id, true),
        (target_workspace_id, 'Taxas e Contribuições (IPTU, Alvarás, Taxas Municipais)', 'expense', v_trib_id, true);

    -------------------------------------------------------
    -- 4. Investimentos
    -------------------------------------------------------
    INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active, "order")
    VALUES (target_workspace_id, 'Investimentos', 'expense', NULL, true, 40)
    RETURNING id INTO v_inv_id;

        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'Compra de Máquinas e Equipamentos', 'expense', v_inv_id, true),
        (target_workspace_id, 'Móveis e Utensílios', 'expense', v_inv_id, true),
        (target_workspace_id, 'Reformas e Benfeitorias', 'expense', v_inv_id, true),
        (target_workspace_id, 'Softwares e Licenças', 'expense', v_inv_id, true);

    -------------------------------------------------------
    -- 5. Custo das Vendas
    -------------------------------------------------------
    INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active, "order")
    VALUES (target_workspace_id, 'Custo das Vendas', 'expense', NULL, true, 50)
    RETURNING id INTO v_cost_id;

        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'Custo de Mercadorias Vendidas', 'expense', v_cost_id, true),
        (target_workspace_id, 'Custo de Materiais e Insumos', 'expense', v_cost_id, true),
        (target_workspace_id, 'Subcontratação de Serviços', 'expense', v_cost_id, true);

END;
$$;

-- Create/Update Trigger Logic
CREATE OR REPLACE FUNCTION public.trigger_seed_financial_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM public.seed_default_financial_categories(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_seed_financial_categories ON public.workspaces;

CREATE TRIGGER trigger_seed_financial_categories
AFTER INSERT ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.trigger_seed_financial_categories();

-- Execute for all existing workspaces
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.workspaces LOOP
        PERFORM public.seed_default_financial_categories(r.id);
    END LOOP;
END;
$$;
