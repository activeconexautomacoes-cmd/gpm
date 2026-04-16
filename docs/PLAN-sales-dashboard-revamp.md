# Plan: Sales Dashboard Revamp

## 📋 Context
The user wants to transform the current "Vendas Avulsas" (One-time Sales) screen into a unified **"Vendas"** (Sales) dashboard. This new dashboard must consolidate **ALL** won opportunities (both Recurring/Contracts and One-time Sales) into a single view. The user also requests specific improvements to the table structure (product expansion, payment methods) and a detailed view when clicking on a sale.

## 🥅 Goal
Create a unified **Sales Dashboard** that lists all won opportunities, regardless of type (Recurring vs One-time), with enhanced visualization of products, values, and details.

## 🧭 Strategy

### 1. Data Source Unification
Instead of querying `one_time_sales` or `contracts` tables separately, we will query the **`opportunities`** table where `current_stage_id` corresponds to a "Won" stage.
- **Why?** The Opportunity is the single source of truth for the negotiation. It contains products, values, client info, and payment terms before they are split into Contracts or One-time sales records.
- **Key Joins**: `clients`, `opportunity_products`, `products`, `users` (SDR/Closer), `opportunity_stages`.

### 2. Frontend Architecture
- **Route**: Rename `/dashboard/sales/one-time` to `/dashboard/sales` (or keep and Alias).
- **Component**: Create `src/pages/sales/SalesDashboard.tsx`.
- **Table Component**: `SalesTable.tsx` with `Collapsible` rows for product details.

## 🏗️ Task Breakdown

### Phase 1: Data consolidation (Backend/Query)
- [ ] Create a robust Supabase query (or View) to fetch Won Opportunities with:
    - Client Name (Company)
    - Full Product List (Name + Price + Type)
    - Total Negotiated Value
    - Payment Method (from `custom_fields` or `negotiated_payment_method`)
    - Payment Status (from `payment_status` - Paid/Pending)
    - Dates (Won At)

### Phase 2: UI Implementation (Sales Table)
- [ ] **Rename Menu Item**: Change "Vendas Avulsas" to "Vendas" in `AppSidebar.tsx`.
- [ ] **Table Columns**:
    - **STATUS**: Icon/Badge (Paid/Pending).
    - **CLIENTE**: Company Name (Avatar + Text).
    - **TIPO**: Badge (Recorrente / Avulso / Misto).
        - Logic: If products contain 'monthly'/'yearly' -> Recurring. If 'one_time' -> One-time. Both -> Mixed.
    - **PRODUTOS**:
        - Main view: "X Produtos" or Top product name.
        - **Expansion**: Downward expansion showing list: `Product Name ..... R$ Value`.
    - **VALOR**: Total Value.
    - **MÉTODO**: Icon/Text (Pix, Cartão, Boleto) based on Pagar.me data or Negotiation data.
    - **DATA**: Sale Date (`won_at`).

### Phase 3: Sales Details (Drawer/Dialog)
- [ ] **Click Action**: Clicking a row opens a details sheet/dialog.
- [ ] **Content**:
    - **Header**: Sale ID, Date, Status.
    - **Client Section**: Name, Company, Contact Person, Email/Phone.
    - **Team Section**: SDR Name, Closer Name.
    - **Financial Section**: Payment Method, Terms (12x, etc), Status.
    - **Products Section**: Full list with individual values.
    - **Notes/Obs**: `loss_notes` or `description` or `custom_fields`.

## 🤖 Agent Assignments
- **`frontend-specialist`**: Implement `SalesDashboard.tsx`, `SalesTable.tsx` with collapsible rows, and `SaleDetails.tsx`.
- **`backend-specialist`** (if needed): Create SQL Views if Supabase client queries get too complex.

## ✅ Verification Checklist
- [ ] **Unified List**: Verify that a "Contract" sale (Assessoria) and a "One-time" sale (Multa/Impl) both appear in the table.
- [ ] **Product Expansion**: Verify clicking the row/icon expands to show product sub-items with correct values.
- [ ] **Type Logic**: Verify labels "Recorrente/Avulso" are correct based on product types.
- [ ] **Details View**: Verify all requested fields (SDR, Obs, Client) are visible in the details modal.
