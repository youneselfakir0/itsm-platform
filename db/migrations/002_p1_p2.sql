-- 002_p1_p2.sql — cmdb, catalog, automation, events, reporting, ai
CREATE SCHEMA IF NOT EXISTS cmdb;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS automation;
CREATE SCHEMA IF NOT EXISTS events;
CREATE SCHEMA IF NOT EXISTS ai;

-- ===== CMDB =====
CREATE TABLE IF NOT EXISTS cmdb.ci_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,            -- server, vm, app, network_device, service...
  icon text,
  attributes_schema jsonb NOT NULL DEFAULT '{}',  -- JSON Schema des attributs
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cmdb.cis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES cmdb.ci_classes(id),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','retired')),
  environment text DEFAULT 'prod',
  attributes jsonb NOT NULL DEFAULT '{}',
  owner_id uuid,
  discovered_by text,                   -- manual | ad | vmware | zabbix
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, name)
);
CREATE INDEX IF NOT EXISTS idx_cis_attrs ON cmdb.cis USING gin (attributes);
CREATE INDEX IF NOT EXISTS idx_cis_class ON cmdb.cis (class_id);

CREATE TABLE IF NOT EXISTS cmdb.ci_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES cmdb.cis(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES cmdb.cis(id) ON DELETE CASCADE,
  relation text NOT NULL,               -- runs_on, depends_on, connected_to, hosts
  UNIQUE (source_id, target_id, relation)
);

CREATE TABLE IF NOT EXISTS cmdb.ci_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ci_id uuid NOT NULL,
  change jsonb NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION cmdb.audit_ci() RETURNS trigger AS $$
BEGIN
  INSERT INTO cmdb.ci_history (ci_id, change)
  VALUES (NEW.id, jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_audit_ci ON cmdb.cis;
CREATE TRIGGER trg_audit_ci BEFORE UPDATE ON cmdb.cis
FOR EACH ROW EXECUTE FUNCTION cmdb.audit_ci();

-- ===== CATALOG =====
CREATE TABLE IF NOT EXISTS catalog.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  category text,
  form_schema jsonb NOT NULL DEFAULT '[]',      -- champs dynamiques
  requires_approval boolean NOT NULL DEFAULT false,
  automation_runbook text,                       -- runbook déclenché après approbation
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES catalog.items(id),
  requester_id uuid NOT NULL,
  form_data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','pending_approval','approved','rejected','fulfilled','failed')),
  ticket_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON catalog.requests (status);

CREATE TABLE IF NOT EXISTS catalog.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES catalog.requests(id) ON DELETE CASCADE,
  approver_id uuid,
  decision text CHECK (decision IN ('approved','rejected')),
  comment text,
  decided_at timestamptz
);

-- ===== AUTOMATION =====
CREATE TABLE IF NOT EXISTS automation.runbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  connector text NOT NULL,             -- ad | azuread | vmware | hyperv | zabbix | smtp | shell
  action text NOT NULL,                -- reset_password, disable_user, create_vm...
  params_schema jsonb NOT NULL DEFAULT '{}',
  dry_run_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runbook_id uuid REFERENCES automation.runbooks(id),
  requested_by uuid NOT NULL,
  params jsonb NOT NULL DEFAULT '{}',
  dry_run boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  result jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON automation.jobs (status) WHERE status IN ('queued','running');

CREATE TABLE IF NOT EXISTS automation.job_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES automation.jobs(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);

-- ===== EVENTS =====
CREATE TABLE IF NOT EXISTS events.events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL,                -- zabbix, prometheus, internal, webhook
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  subject text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  ci_id uuid,
  ticket_id uuid,
  correlated boolean NOT NULL DEFAULT false,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_at ON events.events (at DESC);
CREATE INDEX IF NOT EXISTS idx_events_severity ON events.events (severity) WHERE NOT correlated;

-- ===== AI =====
CREATE TABLE IF NOT EXISTS ai.classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  suggested_category text,
  suggested_priority text,
  suggested_team text,
  confidence real,
  model text,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai.suggestions_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  suggestion text NOT NULL,
  helpful boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== SEEDS =====
INSERT INTO cmdb.ci_classes (name, attributes_schema) VALUES
  ('server', '{"cpu":"int","ram_gb":"int","os":"string","ip":"string"}'),
  ('vm', '{"host":"string","vcpu":"int","ram_gb":"int","os":"string"}'),
  ('application', '{"version":"string","url":"string","criticality":"string"}'),
  ('network_device', '{"model":"string","ip":"string","location":"string"}'),
  ('service', '{"sla":"string","owner_team":"string"}')
ON CONFLICT (name) DO NOTHING;

INSERT INTO automation.runbooks (name, description, connector, action, params_schema) VALUES
  ('ad-reset-password', 'Réinitialise le mot de passe AD d''un utilisateur', 'ad', 'reset_password', '{"sam":"string"}'),
  ('ad-disable-user', 'Désactive un compte AD', 'ad', 'disable_user', '{"sam":"string"}'),
  ('ad-unlock-user', 'Déverrouille un compte AD', 'ad', 'unlock_user', '{"sam":"string"}'),
  ('smtp-notify', 'Envoie un email de notification', 'smtp', 'send_mail', '{"to":"string","subject":"string","body":"string"}')
ON CONFLICT (name) DO NOTHING;

INSERT INTO catalog.items (name, description, category, form_schema, requires_approval, automation_runbook) VALUES
  ('Réinitialisation mot de passe', 'Reset du mot de passe AD', 'Comptes', '[{"name":"sam","label":"Identifiant","type":"text","required":true}]', false, 'ad-reset-password'),
  ('Demande de VM', 'Provisionnement d''une machine virtuelle', 'Infrastructure', '[{"name":"os","label":"OS","type":"select","options":["Windows Server 2022","Ubuntu 24.04"]},{"name":"ram_gb","label":"RAM (GB)","type":"number"}]', true, null),
  ('Accès application', 'Demande d''accès à une application', 'Accès', '[{"name":"app","label":"Application","type":"text","required":true}]', true, null)
ON CONFLICT (name) DO NOTHING;

-- permissions supplémentaires
INSERT INTO auth.permissions (code) VALUES
  ('ci:read'),('ci:write'),('catalog:read'),('catalog:request'),('catalog:approve'),
  ('automation:read'),('automation:execute'),('report:read'),('ai:use')
ON CONFLICT (code) DO NOTHING;

INSERT INTO auth.role_permissions
SELECT r.id, p.id FROM auth.roles r, auth.permissions p
WHERE (r.name='technician' AND p.code IN ('ci:read','ci:write','catalog:read','catalog:approve','automation:read','automation:execute','report:read','ai:use'))
   OR (r.name='user' AND p.code IN ('catalog:read','catalog:request','ai:use'))
ON CONFLICT DO NOTHING;
