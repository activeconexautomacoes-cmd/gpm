
-- Standard Categories Seeding (Simplified Version of Conta Azul)
DO $$
DECLARE
    ws_id UUID;
    v_parent_id UUID;
BEGIN
    -- Get the first workspace for now (in real scenario, this should be per workspace creation trigger)
    SELECT id INTO ws_id FROM workspaces LIMIT 1;
    
    IF ws_id IS NOT NULL THEN

        -- Clear existing (be careful in prod, but safe here per user request)
        -- DELETE FROM financial_categories WHERE workspace_id = ws_id;
        
        -- 1. RECEITAS
        INSERT INTO financial_categories (workspace_id, name, type, code, is_system, active)
        VALUES (ws_id, 'Receitas de Vendas e Serviços', 'income', '1.01', true, true)
        RETURNING id INTO v_parent_id;

        INSERT INTO financial_categories (workspace_id, name, type, parent_id, code, active) VALUES
        (ws_id, 'Receita de Vendas de Produtos', 'income', v_parent_id, '1.01.01', true),
        (ws_id, 'Receita de Serviços Prestados', 'income', v_parent_id, '1.01.02', true),
        (ws_id, 'Outras Receitas Operacionais', 'income', v_parent_id, '1.01.03', true);

        INSERT INTO financial_categories (workspace_id, name, type, code, is_system, active)
        VALUES (ws_id, 'Receitas Financeiras', 'income', '1.02', true, true)
        RETURNING id INTO v_parent_id;

        INSERT INTO financial_categories (workspace_id, name, type, parent_id, code, active) VALUES
        (ws_id, 'Juros Recebidos', 'income', v_parent_id, '1.02.01', true),
        (ws_id, 'Descontos Obtidos', 'income', v_parent_id, '1.02.02', true),
        (ws_id, 'Rendimentos de Aplicação', 'income', v_parent_id, '1.02.03', true);


        -- 2. DESPESAS
        INSERT INTO financial_categories (workspace_id, name, type, code, is_system, active)
        VALUES (ws_id, 'Despesas Operacionais', 'expense', '2.01', true, true)
        RETURNING id INTO v_parent_id;
        
        INSERT INTO financial_categories (workspace_id, name, type, parent_id, code, active) VALUES
        (ws_id, 'Aluguel e Condomínio', 'expense', v_parent_id, '2.01.01', true),
        (ws_id, 'Energia Elétrica', 'expense', v_parent_id, '2.01.02', true),
        (ws_id, 'Água e Esgoto', 'expense', v_parent_id, '2.01.03', true),
        (ws_id, 'Internet e Telefone', 'expense', v_parent_id, '2.01.04', true),
        (ws_id, 'Limpeza e Conservação', 'expense', v_parent_id, '2.01.05', true),
        (ws_id, 'Material de Escritório', 'expense', v_parent_id, '2.01.06', true);

        INSERT INTO financial_categories (workspace_id, name, type, code, is_system, active)
        VALUES (ws_id, 'Despesas com Pessoal', 'expense', '2.02', true, true)
        RETURNING id INTO v_parent_id;

        INSERT INTO financial_categories (workspace_id, name, type, parent_id, code, active) VALUES
        (ws_id, 'Salários e Ordenados', 'expense', v_parent_id, '2.02.01', true),
        (ws_id, 'Pró-Labore', 'expense', v_parent_id, '2.02.02', true),
        (ws_id, 'Vale Transporte', 'expense', v_parent_id, '2.02.03', true),
        (ws_id, 'Vale Refeição/Alimentação', 'expense', v_parent_id, '2.02.04', true),
        (ws_id, 'FGTS', 'expense', v_parent_id, '2.02.05', true),
        (ws_id, 'INSS', 'expense', v_parent_id, '2.02.06', true);

        INSERT INTO financial_categories (workspace_id, name, type, code, is_system, active)
        VALUES (ws_id, 'Despesas Financeiras', 'expense', '2.03', true, true)
        RETURNING id INTO v_parent_id;

        INSERT INTO financial_categories (workspace_id, name, type, parent_id, code, active) VALUES
        (ws_id, 'Juros Pagos', 'expense', v_parent_id, '2.03.01', true),
        (ws_id, 'Multas Pagas', 'expense', v_parent_id, '2.03.02', true),
        (ws_id, 'Tarifas Bancárias', 'expense', v_parent_id, '2.03.03', true),
        (ws_id, 'IOF', 'expense', v_parent_id, '2.03.04', true);

        INSERT INTO financial_categories (workspace_id, name, type, code, is_system, active)
        VALUES (ws_id, 'Impostos e Taxas', 'expense', '2.04', true, true)
        RETURNING id INTO v_parent_id;

        INSERT INTO financial_categories (workspace_id, name, type, parent_id, code, active) VALUES
        (ws_id, 'Simples Nacional', 'expense', v_parent_id, '2.04.01', true),
        (ws_id, 'ISS', 'expense', v_parent_id, '2.04.02', true),
        (ws_id, 'ICMS', 'expense', v_parent_id, '2.04.03', true),
        (ws_id, 'Taxas e Licenças', 'expense', v_parent_id, '2.04.04', true);
        
    END IF;
END $$;
