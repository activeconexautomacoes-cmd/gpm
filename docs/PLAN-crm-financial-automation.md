# PLAN-crm-financial-automation.md

> **Agent**: `project-planner`
> **Date**: 2026-01-25
> **Status**: DRAFT

## 1. Context Analysis & Socratic Gate

### User Request
- Automate "Won" stage logic in CRM.
- **Rule 1**: If product requires signature, Opportunity MUST be signed before moving to "Won".
- **Rule 2**: On "Won", if it's a **One-Time Sale** -> Create Sale + Financial Receivable + Reconcile (if paid).
- **Rule 3**: On "Won", if it's a **Recurring Service** -> Create Contract + Billings + Financial Receivables.

### Database Current State
- `products`: Missing `signature_required` flag.
- `opportunities`: Missing `contract_signed` status or flag.
- `products.type`: `USER-DEFINED`. Need to map values (e.g., 'subscription', 'one_time') to logic.
- `contracts`, `one_time_sales`, `financial_receivables`: Tables exist.

### Risks & Questions (Self-Answered based on audio)
- **Q**: How to handle payments made via Payment Link before "Won"?
- **A**: The system must check if a financial record already exists. If yes, link it. If not, create it.
- **Q**: Distinction between Recurring vs One-time?
- **A**: Based on Product Config.

---

## 2. Implementation Plan

### Phase 1: Database Schema Enhancements

#### 1.1 Products Table
- Add `signature_required` (BOOLEAN, Default: false).
- Add `recurrence_type` (ENUM: 'one_time', 'monthly', 'yearly', etc.) or rely on existing `type` + `default_period`.

#### 1.2 Opportunities Table
- Add `is_signed` (BOOLEAN, Default: false).
- Add `contract_url` (TEXT) or linked attachments.
- Add `signed_at` (TIMESTAMP).

#### 1.3 Trigger / Function Logic (The Core)
- Create `fn_validate_opportunity_won()`:
  - Trigger `BEFORE UPDATE` on `opportunities`.
  - IF `NEW.stage = 'WON'`:
    - Check all related `opportunity_products`.
    - IF any product has `signature_required = true` AND `NEW.is_signed = false`:
      - `RAISE EXCEPTION 'Oportunidade requer assinatura de contrato.'`.

### Phase 2: Automation Logic (Backend)

#### 2.1 "Won" Stage Automation
- Create `fn_automate_won_opportunity()`:
  - Trigger `AFTER UPDATE` on `opportunities`.
  - IF `NEW.stage = 'WON'` (and OLD.stage != 'WON'):
    - Iterate over `opportunity_items`.
    - **Case A: One-Time Product**:
      - Check if `one_time_sales` exists (via `opportunity_id`).
      - IF NOT EXISTS: Create `one_time_sales` + `financial_receivables`.
      - IF EXISTS: Ensure status is synced.
    - **Case B: Recurring Product**:
      - Create `contracts` record.
      - Generate first `contract_billings` (if applicable) or schedule based on `start_date`.

### Phase 3: Frontend Adjustments (CRM)

#### 3.1 Product Management
- Add "Exige Assinatura" switch in Product Form.

#### 3.2 Opportunity Kanban/Details
- Add "Contrato Assinado" checkbox/upload field.
- Handle "Error" state when dragging to "Won" (show toast error if validation fails).

---

## 3. Verification Plan

### Automated Tests (Manual Run via SQL/UI)
1. **Validation Test**:
   - Create Product with `signature_required = true`.
   - Create Opportunity with this product.
   - Try to move to "Won" without `is_signed`.
   - **Expected**: Error/Block.

2. **Success Test (One-Time)**:
   - Mark `is_signed = true`.
   - Move to "Won".
   - **Expected**: `one_time_sales` created, `financial_receivables` created.

3. **Success Test (Recurring)**:
   - Create Product (Recurring).
   - Move to "Won".
   - **Expected**: `contracts` created.

---
**Next Steps**: Use `/create` to start Phase 1.
