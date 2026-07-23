-- 006_workflow_engine.sql — Workflow, SLA, approbations multi-niveaux, escalades
CREATE SCHEMA IF NOT EXISTS workflow;

CREATE TABLE IF NOT EXISTS workflow.sla_policies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  priority    text NOT NULL,
  response_mins  int NOT NULL,
  resolution_mins int NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow.workflows (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  entity        text NOT NULL DEFAULT 'request',          -- request | ticket
  trigger_event text NOT NULL DEFAULT 'on_create',
  approval_levels jsonb NOT NULL DEFAULT '[]',            -- [{level,kind,due_mins}]
  sla_policy_id uuid REFERENCES workflow.sla_policies(id),
  escalation     jsonb NOT NULL DEFAULT '{"on_response_breach":[],"on_resolution_breach":["reassign","notify"]}',
  active         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Extension de la table approvals existante (catalog)
ALTER TABLE catalog.approvals
  ADD COLUMN IF NOT EXISTS level int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'approval',
  ADD COLUMN IF NOT EXISTS due_at timestamptz;

ALTER TABLE catalog.requests
  ADD COLUMN IF NOT EXISTS workflow_id uuid,
  ADD COLUMN IF NOT EXISTS current_stage text NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz;

-- SLA sur tickets
ALTER TABLE ticketing.tickets
  ADD COLUMN IF NOT EXISTS sla_policy_id uuid,
  ADD COLUMN IF NOT EXISTS sla_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_resolution_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_status text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tickets_sla ON ticketing.tickets (sla_status, sla_resolution_due_at);
CREATE INDEX IF NOT EXISTS idx_requests_workflow ON catalog.requests (workflow_id);

-- Politiques SLA par défaut (ITIL-like)
INSERT INTO workflow.sla_policies (name, priority, response_mins, resolution_mins) VALUES
  ('P1 Critical', 'p1', 15,  240),
  ('P2 High',     'p2', 30,  480),
  ('P3 Medium',   'p3', 120, 1440),
  ('P4 Low',      'p4', 480, 4320)
ON CONFLICT (name) DO NOTHING;

-- Workflow catalogue par défaut (demande compte AD => 2 niveaux)
INSERT INTO workflow.workflows (name, entity, approval_levels, escalation)
VALUES ('Demande standard', 'request',
  '[{"level":1,"kind":"role:agent","due_mins":480},{"level":2,"kind":"role:admin","due_mins":1440}]'::jsonb,
  '{"on_response_breach":["notify"],"on_resolution_breach":["reassign","notify"]}'::jsonb)
ON CONFLICT (name) DO NOTHING;
