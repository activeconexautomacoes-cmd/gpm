-- EXECUTION SCRIPT: DELETE 'DELWIN' DATA
-- WARNING: THIS SCRIPT PERMANENTLY DELETES DATA.
-- EXECUTE WITHIN A TRANSACTION BLOCK.

BEGIN;

-- 1. Identify Target IDs using CTEs
WITH target_opps AS (
    SELECT id FROM opportunities WHERE lead_name ILIKE '%DELWIN%'
),
target_contracts AS (
    SELECT id FROM contracts WHERE opportunity_id IN (SELECT id FROM target_opps)
),
target_ots AS (
    SELECT id FROM one_time_sales WHERE opportunity_id IN (SELECT id FROM target_opps)
),
target_billings AS (
    SELECT id FROM contract_billings WHERE contract_id IN (SELECT id FROM target_contracts)
),
target_receivables AS (
    SELECT id FROM financial_receivables 
    WHERE contract_billing_id IN (SELECT id FROM target_billings)
       OR one_time_sale_id IN (SELECT id FROM target_ots)
),
target_transactions AS (
    SELECT id FROM financial_bank_transactions 
    WHERE matched_receivable_id IN (SELECT id FROM target_receivables)
)

-- 2. Delete Execution (Bottom-Up)

-- Level 3: Transactions
DELETE FROM financial_bank_transactions 
WHERE id IN (SELECT id FROM financial_bank_transactions 
             WHERE matched_receivable_id IN (SELECT id FROM target_receivables));

-- Level 2: Receivables
DELETE FROM financial_receivables 
WHERE id IN (SELECT id FROM target_receivables);

-- Level 2b: Billings & One Time Sales
DELETE FROM contract_billings 
WHERE id IN (SELECT id FROM target_billings);

DELETE FROM one_time_sales 
WHERE id IN (SELECT id FROM target_ots);

-- Level 1: Contracts & Products & Dependents
DELETE FROM contracts 
WHERE id IN (SELECT id FROM target_contracts);

DELETE FROM opportunity_products 
WHERE opportunity_id IN (SELECT id FROM target_opps);

DELETE FROM opportunity_tag_assignments 
WHERE opportunity_id IN (SELECT id FROM target_opps);

DELETE FROM opportunity_notes 
WHERE opportunity_id IN (SELECT id FROM target_opps);

DELETE FROM opportunity_attachments 
WHERE opportunity_id IN (SELECT id FROM target_opps);

-- Level 0: Opportunities
DELETE FROM opportunities 
WHERE id IN (SELECT id FROM target_opps);

-- Level -1: Clients (Optional - Only if not linked to other opps)
-- Removing clients named DELWIN that have NO remaining opportunities
DELETE FROM clients 
WHERE name ILIKE '%DELWIN%'
AND id NOT IN (SELECT client_id FROM opportunities);

COMMIT;

-- Verification (Should return 0)
SELECT COUNT(*) as remaining_delwin_opportunities FROM opportunities WHERE lead_name ILIKE '%DELWIN%';
