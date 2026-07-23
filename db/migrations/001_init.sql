-- 001_init.sql — P0: auth + users + ticketing
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS ticketing;

-- ===== AUTH =====
CREATE TABLE IF NOT EXISTS auth.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL  -- e.g. ticket:read, ticket:write, admin:*
);

CREATE TABLE IF NOT EXISTS auth.role_permissions (
  role_id uuid REFERENCES auth.roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES auth.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS auth.users_auth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE NOT NULL,
  password_hash text,
  source text NOT NULL DEFAULT 'local',  -- local | ad | azuread
  role_id uuid REFERENCES auth.roles(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_auth_email ON auth.users_auth (email);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users_auth(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON auth.refresh_tokens (user_id) WHERE NOT revoked;

-- ===== USERS =====
CREATE TABLE IF NOT EXISTS users.users (
  id uuid PRIMARY KEY,             -- same id as auth.users_auth
  email citext UNIQUE NOT NULL,
  display_name text NOT NULL,
  department text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users.team_members (
  team_id uuid REFERENCES users.teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users.users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

-- ===== TICKETING =====
CREATE TABLE IF NOT EXISTS ticketing.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint GENERATED ALWAYS AS IDENTITY,
  type text NOT NULL DEFAULT 'incident' CHECK (type IN ('incident','request','problem','change')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','assigned','in_progress','pending','resolved','closed','cancelled')),
  priority text NOT NULL DEFAULT 'p3' CHECK (priority IN ('p1','p2','p3','p4')),
  category text,
  requester_id uuid NOT NULL,
  assignee_id uuid,
  team_id uuid,
  sla_due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_number ON ticketing.tickets (number);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON ticketing.tickets (status) WHERE status NOT IN ('closed','cancelled');
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON ticketing.tickets (assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON ticketing.tickets (requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON ticketing.tickets (created_at DESC);

CREATE TABLE IF NOT EXISTS ticketing.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES ticketing.tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_ticket ON ticketing.ticket_comments (ticket_id, created_at);

CREATE TABLE IF NOT EXISTS ticketing.ticket_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id uuid NOT NULL,
  actor_id uuid,
  field text NOT NULL,
  old_value text,
  new_value text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_history_ticket ON ticketing.ticket_history (ticket_id, at);

-- audit trigger
CREATE OR REPLACE FUNCTION ticketing.audit_ticket() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO ticketing.ticket_history (ticket_id, field, old_value, new_value)
    VALUES (NEW.id, 'status', OLD.status, NEW.status);
  END IF;
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    INSERT INTO ticketing.ticket_history (ticket_id, field, old_value, new_value)
    VALUES (NEW.id, 'assignee_id', OLD.assignee_id::text, NEW.assignee_id::text);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_ticket ON ticketing.tickets;
CREATE TRIGGER trg_audit_ticket BEFORE UPDATE ON ticketing.tickets
FOR EACH ROW EXECUTE FUNCTION ticketing.audit_ticket();

-- ===== SEED RBAC =====
INSERT INTO auth.roles (name, description) VALUES
  ('admin','Full access'),
  ('technician','Handle tickets'),
  ('user','End user portal')
ON CONFLICT (name) DO NOTHING;

INSERT INTO auth.permissions (code) VALUES
  ('ticket:read'),('ticket:write'),('ticket:assign'),
  ('user:read'),('user:write'),('admin:*')
ON CONFLICT (code) DO NOTHING;

INSERT INTO auth.role_permissions
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE (r.name='admin')
   OR (r.name='technician' AND p.code IN ('ticket:read','ticket:write','ticket:assign','user:read'))
   OR (r.name='user' AND p.code IN ('ticket:read','ticket:write'))
ON CONFLICT DO NOTHING;
