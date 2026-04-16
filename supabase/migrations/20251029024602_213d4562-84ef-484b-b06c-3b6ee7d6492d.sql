-- ============================================
-- CRM KANBAN - PARTE 1: ENUMS E TABELAS BASE
-- ============================================

-- 1. CRIAR NOVOS ENUMS
-- ============================================

CREATE TYPE opportunity_status AS ENUM (
  'new_lead',
  'qualification',
  'session_scheduled',
  'in_negotiation',
  'proposal_sent',
  'closing',
  'won',
  'lost'
);

CREATE TYPE lead_source AS ENUM (
  'website',
  'referral',
  'cold_call',
  'social_media',
  'inlead',
  'other'
);

CREATE TYPE loss_reason AS ENUM (
  'high_price',
  'competitor',
  'no_budget',
  'bad_timing',
  'no_authority',
  'no_need',
  'no_response',
  'other'
);

CREATE TYPE product_type AS ENUM (
  'recurring',
  'one_time'
);

-- 2. ADICIONAR NOVOS VALORES AO ENUM WORKSPACE_ROLE
-- ============================================

ALTER TYPE workspace_role ADD VALUE IF NOT EXISTS 'sdr';
ALTER TYPE workspace_role ADD VALUE IF NOT EXISTS 'closer';
ALTER TYPE workspace_role ADD VALUE IF NOT EXISTS 'sales_manager';