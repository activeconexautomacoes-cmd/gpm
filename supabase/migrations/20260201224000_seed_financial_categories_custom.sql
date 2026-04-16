-- Migration: Seed financial categories based on Custom JSON Structure
-- Defines hierarchy for 'expense' categories with specific codes
CREATE OR REPLACE FUNCTION public.seed_default_financial_categories(target_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cat_4_01 UUID;
    v_cat_4_02 UUID;
    v_cat_4_03 UUID;
    v_cat_4_04 UUID;
    v_cat_4_05 UUID;
    v_cat_4_05_01 UUID;
    v_cat_4_06 UUID;
    v_cat_4_07 UUID;
    v_cat_4_09 UUID;
    v_cat_4_10 UUID;
    v_cat_4_11 UUID;
    v_cat_5_01 UUID;
    v_cat_5_02 UUID;
    v_cat_5_03 UUID;
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.financial_categories
        WHERE workspace_id = target_workspace_id
        AND type = 'expense'
        LIMIT 1
    ) INTO v_exists;

    -- If categories exist, we assume seeded. 
    -- (Note: The external DO block handles clearing/reseeding if needed)
    IF v_exists THEN
        RETURN;
    END IF;

    -- 4.01
    INSERT INTO public.financial_categories (workspace_id, name, type, code, parent_id, active, "order")
    VALUES (target_workspace_id, 'Impostos sobre Vendas e sobre Serviços', 'expense', '4.01', NULL, true, 10)
    RETURNING id INTO v_cat_4_01;
    
        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'ICMS ST sobre Vendas', 'expense', v_cat_4_01, true),
        (target_workspace_id, 'ISS sobre Faturamento', 'expense', v_cat_4_01, true),
        (target_workspace_id, 'MEI - DAS', 'expense', v_cat_4_01, true),
        (target_workspace_id, 'Simples Nacional - DAS', 'expense', v_cat_4_01, true);

    -- 4.02
    INSERT INTO public.financial_categories (workspace_id, name, type, code, parent_id, active, "order")
    VALUES (target_workspace_id, 'Despesas com Vendas e Serviços', 'expense', '4.02', NULL, true, 20)
    RETURNING id INTO v_cat_4_02;
    
        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'Bonificação por vendas', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Comissões de Vendedores', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Consulta API CPF (Receita Federal)', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Devolução de frete', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Devolução de Vendas', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Ferramentas de Produção', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Fornecedores de Produtos', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Frete', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Manutenção site', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Materiais Aplicados na Prestação de Serviços', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Materiais de Embalagem', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Materiais para Revenda', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Personalização', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Prestação de serviço', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Serviços de Terceiros - Comercial', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Serviços Operacionais', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Serviços Terceirizados', 'expense', v_cat_4_02, true),
        (target_workspace_id, 'Transporte de Mercadorias Vendidas', 'expense', v_cat_4_02, true);

    -- 4.03
    INSERT INTO public.financial_categories (workspace_id, name, type, code, parent_id, active, "order")
    VALUES (target_workspace_id, 'Despesas com Salários e Encargos', 'expense', '4.03', NULL, true, 30)
    RETURNING id INTO v_cat_4_03;
    
        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, '13º Salário - 1ª Parcela', 'expense', v_cat_4_03, true),
        (target_workspace_id, '13º Salário - 2ª Parcela', 'expense', v_cat_4_03, true),
        (target_workspace_id, 'Adiantamento Salarial', 'expense', v_cat_4_03, true),
        (target_workspace_id, 'Férias', 'expense', v_cat_4_03, true),
        (target_workspace_id, 'FGTS e Multa de FGTS', 'expense', v_cat_4_03, true),
        (target_workspace_id, 'INSS sobre Salários - GPS', 'expense', v_cat_4_03, true),
        (target_workspace_id, 'IRRF s/ Salários - DARF 0561', 'expense', v_cat_4_03, true),
        (target_workspace_id, 'PLR - Participação nos Lucros e Resultados', 'expense', v_cat_4_03, true),
        (target_workspace_id, 'Prêmio', 'expense', v_cat_4_03, true),
        (target_workspace_id, 'Remuneração de Autônomos', 'expense', v_cat_4_03, true),
        (target_workspace_id, 'Remuneração de Estagiários', 'expense', v_cat_4_03, true),
        (target_workspace_id, 'Rescisões', 'expense', v_cat_4_03, true),
        (target_workspace_id, 'Salários', 'expense', v_cat_4_03, true);

    -- 4.04
    INSERT INTO public.financial_categories (workspace_id, name, type, code, parent_id, active, "order")
    VALUES (target_workspace_id, 'Despesas com Colaboradores', 'expense', '4.04', NULL, true, 40)
    RETURNING id INTO v_cat_4_04;
    
        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'Adiantamento Bolsa de Estágio', 'expense', v_cat_4_04, true),
        (target_workspace_id, 'Auxilio Home Office', 'expense', v_cat_4_04, true),
        (target_workspace_id, 'Benefícios', 'expense', v_cat_4_04, true),
        (target_workspace_id, 'Bolsa de Estágio', 'expense', v_cat_4_04, true),
        (target_workspace_id, 'Confraternizações', 'expense', v_cat_4_04, true),
        (target_workspace_id, 'Contribuição Sindical', 'expense', v_cat_4_04, true),
        (target_workspace_id, 'Cursos e Treinamentos', 'expense', v_cat_4_04, true),
        (target_workspace_id, 'Exames Médicos', 'expense', v_cat_4_04, true),
        (target_workspace_id, 'Gratificações', 'expense', v_cat_4_04, true),
        (target_workspace_id, 'Plano de Saúde Colaboradores', 'expense', v_cat_4_04, true),
        (target_workspace_id, 'Plano Odontológico Colaboradores', 'expense', v_cat_4_04, true),
        (target_workspace_id, 'Seguro de Vida', 'expense', v_cat_4_04, true),
        (target_workspace_id, 'Uniformes', 'expense', v_cat_4_04, true),
        (target_workspace_id, 'Vale-Alimentação', 'expense', v_cat_4_04, true),
        (target_workspace_id, 'Vale-Transporte', 'expense', v_cat_4_04, true);

    -- 4.05
    INSERT INTO public.financial_categories (workspace_id, name, type, code, parent_id, active, "order")
    VALUES (target_workspace_id, 'Despesas Administrativas', 'expense', '4.05', NULL, true, 50)
    RETURNING id INTO v_cat_4_05;
    
        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'Ajuda de Custo a Terceiros', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Anúncio', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Assinaturas e Associações', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Bens de Pequeno Valor', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Cartório', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Copa e Cozinha', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Correios', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Despesas com Equipamento', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Despesas com Manutenção', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Despesas com Viagem', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Endereço fiscal', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Gasolina', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Honorários Advocatícios', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Honorários Consultoria', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Honorários Contábeis', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Honorários (outros)', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Hospedagem', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Hospedagem de Sites e Domínios', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Impostos e Taxas Municipais', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Lanches e Refeições', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Manutenção de Equipamentos', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Materiais de Escritório', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Materiais de Limpeza e de Higiene', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Multas Federais', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Outros Custos Administrativos', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Processos Judiciais', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Programação/Desenvolvimento', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Reembolso', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Retenção - Darf 1708 - IRRF', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Retenção - Darf 5952 - PIS/COFINS/CSLL', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Retenção - GPS 2631 - INSS', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Retenção - ISS Serviços Tomados', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Serviços de limpeza', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Sistemas', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Taxa de Licença para Funcionamento', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Taxas Junta Comercial', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Telefonia e Internet', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Telefonia Móvel', 'expense', v_cat_4_05, true),
        (target_workspace_id, 'Transporte Urbano (táxi, Uber)', 'expense', v_cat_4_05, true);

    -- 4.05.01 (Child of 4.05)
    INSERT INTO public.financial_categories (workspace_id, name, type, code, parent_id, active, "order")
    VALUES (target_workspace_id, 'Tributos Federais – Lucro Presumido', 'expense', '4.05.01', v_cat_4_05, true, 51)
    RETURNING id INTO v_cat_4_05_01;
    
        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'COFINS', 'expense', v_cat_4_05_01, true),
        (target_workspace_id, 'CSLL', 'expense', v_cat_4_05_01, true),
        (target_workspace_id, 'IRPJ', 'expense', v_cat_4_05_01, true),
        (target_workspace_id, 'PIS', 'expense', v_cat_4_05_01, true);

    -- 4.06
    INSERT INTO public.financial_categories (workspace_id, name, type, code, parent_id, active, "order")
    VALUES (target_workspace_id, 'Despesas Comerciais', 'expense', '4.06', NULL, true, 60)
    RETURNING id INTO v_cat_4_06;

        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'Brindes para Clientes', 'expense', v_cat_4_06, true),
        (target_workspace_id, 'Despesas com Evento de Marketing', 'expense', v_cat_4_06, true),
        (target_workspace_id, 'Despesas com Produção de Conteúdo', 'expense', v_cat_4_06, true),
        (target_workspace_id, 'Marketing e Publicidade', 'expense', v_cat_4_06, true),
        (target_workspace_id, 'Criação, Impressão e Distribuição de Panfletos', 'expense', v_cat_4_06, true),
        (target_workspace_id, 'Facebook Ads', 'expense', v_cat_4_06, true),
        (target_workspace_id, 'Google Ads', 'expense', v_cat_4_06, true),
        (target_workspace_id, 'Parceria Instagram', 'expense', v_cat_4_06, true),
        (target_workspace_id, 'Patrocinio', 'expense', v_cat_4_06, true),
        (target_workspace_id, 'Serviços – Marketing/Propaganda', 'expense', v_cat_4_06, true),
        (target_workspace_id, 'Social Media', 'expense', v_cat_4_06, true),
        (target_workspace_id, 'TikTok Ads', 'expense', v_cat_4_06, true),
        (target_workspace_id, 'Material de Evento', 'expense', v_cat_4_06, true),
        (target_workspace_id, 'Viagens e Representações', 'expense', v_cat_4_06, true);

    -- 4.07
    INSERT INTO public.financial_categories (workspace_id, name, type, code, parent_id, active, "order")
    VALUES (target_workspace_id, 'Despesas com Imóvel', 'expense', '4.07', NULL, true, 70)
    RETURNING id INTO v_cat_4_07;

        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'Água e Saneamento', 'expense', v_cat_4_07, true),
        (target_workspace_id, 'Aluguel', 'expense', v_cat_4_07, true),
        (target_workspace_id, 'Alvará de Funcionamento', 'expense', v_cat_4_07, true),
        (target_workspace_id, 'Condomínio', 'expense', v_cat_4_07, true),
        (target_workspace_id, 'Energia Elétrica', 'expense', v_cat_4_07, true),
        (target_workspace_id, 'IPTU', 'expense', v_cat_4_07, true),
        (target_workspace_id, 'Manutenção Predial', 'expense', v_cat_4_07, true),
        (target_workspace_id, 'Reformas e Manutenção de Imóvel', 'expense', v_cat_4_07, true),
        (target_workspace_id, 'Retenção - Darf 3208 - IRRF Aluguel', 'expense', v_cat_4_07, true),
        (target_workspace_id, 'Seguro de Imóveis', 'expense', v_cat_4_07, true),
        (target_workspace_id, 'Seguro Incêndio', 'expense', v_cat_4_07, true),
        (target_workspace_id, 'Taxa de Lixo', 'expense', v_cat_4_07, true),
        (target_workspace_id, 'Vigilância e Segurança Patrimonial', 'expense', v_cat_4_07, true);

    -- 4.09
    INSERT INTO public.financial_categories (workspace_id, name, type, code, parent_id, active, "order")
    VALUES (target_workspace_id, 'Despesas com Diretoria', 'expense', '4.09', NULL, true, 90)
    RETURNING id INTO v_cat_4_09;

        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'Antecipação de Lucros', 'expense', v_cat_4_09, true),
        (target_workspace_id, 'Despesas Pessoais dos Sócios', 'expense', v_cat_4_09, true),
        (target_workspace_id, 'INSS sobre Pró-labore - GPS', 'expense', v_cat_4_09, true),
        (target_workspace_id, 'IRRF sobre Pró-labore - Darf', 'expense', v_cat_4_09, true),
        (target_workspace_id, 'Plano de Saúde Sócios', 'expense', v_cat_4_09, true),
        (target_workspace_id, 'Plano Odontológico Sócios', 'expense', v_cat_4_09, true),
        (target_workspace_id, 'Pró-labore', 'expense', v_cat_4_09, true);

    -- 4.10
    INSERT INTO public.financial_categories (workspace_id, name, type, code, parent_id, active, "order")
    VALUES (target_workspace_id, 'Despesas Financeiras', 'expense', '4.10', NULL, true, 100)
    RETURNING id INTO v_cat_4_10;

        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'Ajuste de Saldo', 'expense', v_cat_4_10, true),
        (target_workspace_id, 'Antecipação de Limite de Cartão', 'expense', v_cat_4_10, true),
        (target_workspace_id, 'Impostos sobre Aplicações', 'expense', v_cat_4_10, true),
        (target_workspace_id, 'IOF sobre compras no cartão de crédito', 'expense', v_cat_4_10, true),
        (target_workspace_id, 'Tarifas Bancárias', 'expense', v_cat_4_10, true),
        (target_workspace_id, 'Tarifas de Boletos', 'expense', v_cat_4_10, true),
        (target_workspace_id, 'Tarifas de Cartões de Crédito', 'expense', v_cat_4_10, true),
        (target_workspace_id, 'Tarifas DOC / TED', 'expense', v_cat_4_10, true);

    -- 4.11
    INSERT INTO public.financial_categories (workspace_id, name, type, code, parent_id, active, "order")
    VALUES (target_workspace_id, 'Outras Despesas', 'expense', '4.11', NULL, true, 110)
    RETURNING id INTO v_cat_4_11;

        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'Aquisição de Participações Societárias', 'expense', v_cat_4_11, true),
        (target_workspace_id, 'Despesas a identificar', 'expense', v_cat_4_11, true),
        (target_workspace_id, 'Investimento', 'expense', v_cat_4_11, true),
        (target_workspace_id, 'Taxas Reembolsáveis de Cliente', 'expense', v_cat_4_11, true);

    -- 5.01
    INSERT INTO public.financial_categories (workspace_id, name, type, code, parent_id, active, "order")
    VALUES (target_workspace_id, 'Bens Imobilizados da Empresa', 'expense', '5.01', NULL, true, 120)
    RETURNING id INTO v_cat_5_01;

        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'Benfeitorias em Bens de Terceiros', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Computadores e Equipamentos', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Construções em Andamento - Imóvel Próprio', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Edifícios e Construções', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Leasing - Imóveis', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Leasing - Máquinas, Equipamentos e Instalações Industriais', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Leasing - Móveis, Utensílios e Instalações Administrativos', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Leasing - Móveis, Utensílios e Instalações Comerciais', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Leasing - Outras Imobilizações', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Leasing - Veículos', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Máquinas, Equipamentos e Instalações Industriais', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Móveis, Utensílios e Instalações Administrativos', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Móveis, Utensílios e Instalações Comerciais', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Outras Imobilizações por Aquisição', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Software / Licença de Uso', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Terrenos', 'expense', v_cat_5_01, true),
        (target_workspace_id, 'Veículos', 'expense', v_cat_5_01, true);

    -- 5.02
    INSERT INTO public.financial_categories (workspace_id, name, type, code, parent_id, active, "order")
    VALUES (target_workspace_id, 'Empréstimos e Financiamentos', 'expense', '5.02', NULL, true, 130)
    RETURNING id INTO v_cat_5_02;

        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'Empréstimos de Bancos', 'expense', v_cat_5_02, true),
        (target_workspace_id, 'Empréstimos de Outras Instituições', 'expense', v_cat_5_02, true),
        (target_workspace_id, 'Empréstimos de Sócios', 'expense', v_cat_5_02, true),
        (target_workspace_id, 'Juros Conta Garantida', 'expense', v_cat_5_02, true);

    -- 5.03
    INSERT INTO public.financial_categories (workspace_id, name, type, code, parent_id, active, "order")
    VALUES (target_workspace_id, 'Parcelamentos e Dívidas', 'expense', '5.03', NULL, true, 140)
    RETURNING id INTO v_cat_5_03;

        INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active) VALUES
        (target_workspace_id, 'Parcelamento Dívida Ativa', 'expense', v_cat_5_03, true),
        (target_workspace_id, 'Parcelamento do Simples Nacional', 'expense', v_cat_5_03, true),
        (target_workspace_id, 'Parcelamento ISS', 'expense', v_cat_5_03, true);

    -- Nivel Unico (Misc)
    INSERT INTO public.financial_categories (workspace_id, name, type, parent_id, active, "order") VALUES
    (target_workspace_id, 'Descontos financeiros concedidos', 'expense', NULL, true, 200),
    (target_workspace_id, 'Descontos incondicionais concedidos', 'expense', NULL, true, 201),
    (target_workspace_id, 'Fretes pagos', 'expense', NULL, true, 202),
    (target_workspace_id, 'Impostos retidos em vendas', 'expense', NULL, true, 203),
    (target_workspace_id, 'Juros pagos', 'expense', NULL, true, 204),
    (target_workspace_id, 'Multa - DARF', 'expense', NULL, true, 205),
    (target_workspace_id, 'Multas pagas', 'expense', NULL, true, 206),
    (target_workspace_id, 'Outros', 'expense', NULL, true, 207),
    (target_workspace_id, 'Perdas', 'expense', NULL, true, 208),
    (target_workspace_id, 'SERVIÇOS DE TERCEIROS - PJ', 'expense', NULL, true, 209),
    (target_workspace_id, 'Tarifas', 'expense', NULL, true, 210);

END;
$$;

-- Do block to clear previous default expenses for current workspaces (if possible) and seed new ones
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.workspaces LOOP
        BEGIN
            -- Attempt to delete ONLY expense categories to reset structure
            -- This is safe: if data exists, FK constraint stops it. 
            DELETE FROM public.financial_categories 
            WHERE workspace_id = r.id AND type = 'expense';
        EXCEPTION WHEN foreign_key_violation THEN
            -- If used, do nothing.
            NULL;
        WHEN OTHERS THEN
            NULL;
        END;

        PERFORM public.seed_default_financial_categories(r.id);
    END LOOP;
END;
$$;
