-- Maps Intuit SSO identity (sub) to Supabase user
CREATE TABLE IF NOT EXISTS intuit_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intuit_sub  TEXT UNIQUE NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS intuit_users_intuit_sub_idx ON intuit_users(intuit_sub);
CREATE INDEX IF NOT EXISTS intuit_users_user_id_idx ON intuit_users(user_id);

ALTER TABLE intuit_users ENABLE ROW LEVEL SECURITY;
