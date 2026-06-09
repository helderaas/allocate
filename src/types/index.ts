export interface QBOTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
}

export interface QBOAccount {
  Id: string;
  Name: string;
  FullyQualifiedName: string;
  AccountType: string;
  AccountSubType: string;
  Active: boolean;
  SubAccount: boolean;
  ParentRef?: { value: string; name: string };
}

export interface QBOLocation {
  Id: string;
  Name: string;
  Active: boolean;
}

export type RuleType = "revenue_pct" | "fixed_split";

export interface AllocationRule {
  id: string;
  tenant_id: string;
  qbo_account_id: string;
  qbo_account_name: string;
  rule_type: RuleType;
  division_a_location_id: string;
  division_b_location_id: string;
  fixed_pct_division_a?: number;
  fixed_pct_map?: Record<string, number>;
  account_type?: string;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  company_name: string;
  qbo_realm_id: string;
  qbo_access_token: string;
  qbo_refresh_token: string;
  qbo_token_expires_at: string;
  division_a_location_id: string;
  division_a_location_name: string;
  division_b_location_id: string;
  division_b_location_name: string;
  created_at: string;
}

export interface AllocationLine {
  account_id: string;
  account_name: string;
  account_type?: string;        // QBO account type (Income, Expense, etc.)
  rule_type: RuleType;
  division_a_pct: number;
  division_b_pct: number;
  // GL breakdown — what's already tagged vs what's being allocated
  total_amount: number;
  already_tagged_a: number;
  already_tagged_b: number;
  untagged_amount: number;
  division_a_amount: number;
  division_b_amount: number;
  division_amounts?: Record<string, number>; // N-division amounts
}

export interface AllocationDraft {
  id: string;
  tenant_id: string;
  period: string;
  status: "draft" | "approved" | "posted" | "rejected" | "voided";
  lines: AllocationLine[];
  total_debits: number;
  total_credits: number;
  qbo_journal_entry_id?: string;
  created_at: string;
  approved_at?: string;
  posted_at?: string;
  voided_at?: string;
  locked_at?: string;
}

