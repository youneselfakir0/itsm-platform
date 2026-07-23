-- 005_identity_enterprise.sql — MFA TOTP + traçabilité provenance AD
ALTER TABLE auth.users_auth
  ADD COLUMN IF NOT EXISTS mfa_secret text,
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_dn text,          -- distinguishedName AD
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- department/titre remontés d'AD sur le profil users
ALTER TABLE users.users
  ADD COLUMN IF NOT EXISTS title text;

CREATE INDEX IF NOT EXISTS idx_users_auth_source ON auth.users_auth (source);
