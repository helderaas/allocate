ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_firm_company BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS tenants_is_firm_company_idx ON tenants(firm_id, is_firm_company);
