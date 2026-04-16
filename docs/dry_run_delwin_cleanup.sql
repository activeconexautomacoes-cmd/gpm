-- Dry Run Script: Count records to be deleted for 'DELWIN'
-- This script does NOT delete data. It only selects and counts.

WITH target_opps AS (
    SELECT id, lead_name FROM opportunities 
    WHERE lead_name ILIKE '%DELWIN%'
),
target_contracts AS (
    SELECT id, name FROM contracts 
    WHERE opportunity_id IN (SELECT id FROM target_opps)
),
target_ots AS (
    SELECT id, description FROM one_time_sales 
    WHERE opportunity_id IN (SELECT id FROM target_opps)
),
target_billings AS (
    SELECT id, amount FROM contract_billings 
    WHERE contract_id IN (SELECT id FROM target_contracts)
),
target_receivables AS (
    SELECT id, title FROM financial_receivables 
    WHERE contract_billing_id IN (SELECT id FROM target_billings)
       OR one_time_sale_id IN (SELECT id FROM target_ots)
),
target_transactions AS (
    SELECT id, description FROM financial_bank_transactions 
    WHERE matched_receivable_id IN (SELECT id FROM target_receivables)
)
SELECT 
    (SELECT COUNT(*) FROM target_opps) AS opportunities_to_delete,
    (SELECT COUNT(*) FROM target_contracts) AS contracts_to_delete,
    (SELECT COUNT(*) FROM target_ots) AS one_time_sales_to_delete,
    (SELECT COUNT(*) FROM target_billings) AS billings_to_delete,
    (SELECT COUNT(*) FROM target_receivables) AS receivables_to_delete,
    (SELECT COUNT(*) FROM target_transactions) AS transactions_to_delete;

-- Detailed List (Limit 5 per category to verify)
WITH target_opps AS (
    SELECT id, lead_name FROM opportunities WHERE lead_name ILIKE '%DELWIN%'
)
SELECT 'Opportunity' as type, lead_name as info FROM target_opps LIMIT 5;
