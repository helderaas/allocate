-- Tenants: one row per connected QBO company
CREATE TABLE tenants (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name              TEXT,
  qbo_realm_id              TEXT UNIQUE NOT NULL,
  qbo_access_token          TEXT NOT NULL,
  qbo_refresh_token         TEXT NOT NULL,
  qbo_token_expires_at      TIMESTAMPTZ NOT NULL,
  division_a_location_id    TEXT,
  division_a_location_name  TEXT,
  division_b_location_id    TEXT,
  division_b_location_name  TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Allocation rules: one row per account per tenant
CREATE TABLE allocation_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID REFERENCES tenants(id) ON DELETE CASCADE,
  qbo_account_id        TEXT NOT NULL,
  qbo_account_name      TEXT NOT NULL,
  rule_type             TEXT NOT NULL CHECK (rule_type IN ('revenue_pct', 'fixed_split')),
  fixed_pct_division_a  NUMERIC(5,2),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, qbo_account_id)
);

-- Allocation drafts: one row per month per tenant
CREATE TABLE allocation_drafts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID REFERENCES tenants(id) ON DELETE CASCADE,
  period                  TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','posted','rejected')),
  lines                   JSONB NOT NULL DEFAULT '[]',
  total_debits            NUMERIC(12,2) DEFAULT 0,
  total_credits           NUMERIC(12,2) DEFAULT 0,
  qbo_journal_entry_id    TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  approved_at             TIMESTAMPTZ,
  posted_at               TIMESTAMPTZ,
  UNIQUE(tenant_id, period)
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_drafts ENABLE ROW LEVEL SECURITY;
