# Plano de Limpeza de Dados de Teste ("DELWIN")

Este documento detalha o procedimento seguro para remoção de todos os dados gerados durante os testes "DELWIN TESTE 1" a "26", garantindo integridade referencial e preservação dos dados reais.

## 1. Análise de Dependências

A exclusão deve ocorrer na ordem "Bottom-Up" (de baixo para cima) para evitar erros de Foreign Key, ou via CASCADE controlado.

### Cadeia de Dependência
1.  **Nível 0 (Raiz):** `opportunities` (Filtro: `lead_name ILIKE '%DELWIN%'`)
2.  **Nível 1 (Diretos):**
    *   `contracts` (via `opportunity_id`)
    *   `one_time_sales` (via `opportunity_id`)
    *   `clients` (via `name ILIKE '%DELWIN%'` ou vinculado apenas a estas ops)
    *   `opportunity_products` (via `opportunity_id`)
    *   `opportunity_logs`, `opportunity_notes`, `opportunity_tag_assignments` (via `opportunity_id`)
3.  **Nível 2 (Financeiro/Operacional):**
    *   `contract_billings` (via `contract_id`)
    *   `financial_receivables` (via `contract_billing_id` OU `one_time_sale_id`)
4.  **Nível 3 (Bancário):**
    *   `financial_bank_transactions` (via `matched_receivable_id`)

## 2. Estratégia de Identificação

Utilizaremos CTEs (Common Table Expressions) para identificar todos os IDs antes de deletar.

```sql
-- Exemplo da lógica de identificação
targets AS (
    SELECT id FROM opportunities WHERE lead_name ILIKE '%DELWIN%'
)
```

## 3. Plano de Execução (SQL Script)

O script será executado em uma única transação para garantir atomicidade.

### Passo 1: Backup (Recomendado)
Recomendo exportar as tabelas antes da execução ou rodar o script de "Dry Run" primeiro.

### Passo 2: Script de Exclusão (Estrutura)

1.  **Identificar Alvos (CTEs):**
    *   `target_opps`: IDs das oportunidades "DELWIN".
    *   `target_contracts`: IDs dos contratos ligados a `target_opps`.
    *   `target_ots`: IDs das vendas avulsas ligadas a `target_opps`.
    *   `target_billings`: IDs das cobranças ligadas a `target_contracts`.
    *   `target_receivables`: IDs dos recebíveis ligados a `target_billings` OU `target_ots`.
    *   `target_transactions`: IDs das transações ligadas a `target_receivables`.

2.  **Remover Transações Bancárias:**
    *   `DELETE FROM financial_bank_transactions WHERE id IN (SELECT id FROM target_transactions);`

3.  **Remover Contas a Receber:**
    *   `DELETE FROM financial_receivables WHERE id IN (SELECT id FROM target_receivables);`

4.  **Remover Cobranças e Vendas:**
    *   `DELETE FROM contract_billings WHERE id IN (SELECT id FROM target_billings);`
    *   `DELETE FROM one_time_sales WHERE id IN (SELECT id FROM target_ots);`

5.  **Remover Contratos e Produtos:**
    *   `DELETE FROM contracts WHERE id IN (SELECT id FROM target_contracts);`
    *   `DELETE FROM opportunity_products WHERE opportunity_id IN (SELECT id FROM target_opps);`
    *   `DELETE FROM opportunity_tag_assignments WHERE opportunity_id IN (SELECT id FROM target_opps);`
    *   `DELETE FROM opportunity_notes, logs, etc...`

6.  **Remover Oportunidades:**
    *   `DELETE FROM opportunities WHERE id IN (SELECT id FROM target_opps);`

7.  **Remover Clientes (Opcional):**
    *   `DELETE FROM clients WHERE name ILIKE '%DELWIN%' AND id NOT IN (SELECT client_id FROM opportunities WHERE id NOT IN (SELECT id FROM target_opps));`

## 4. Critérios de Validação

Antes de comitar a transação, rodar queries de verificação:
*   [ ] Contagem de `opportunities` com nome "DELWIN" deve ser 0.
*   [ ] Contagem de `financial_receivables` com descrição "DELWIN" deve ser 0.
*   [ ] Contagem de transações bancárias vinculadas deve ser 0.

---

**Aprovação:**
Se este plano estiver correto, procederei com a criação dos Scripts SQL:
1. `dry_run_delwin_cleanup.sql` (Apenas SELECTs/Counts para confirmar o que será deletado).
2. `execute_delwin_cleanup.sql` (O DELETE real).
