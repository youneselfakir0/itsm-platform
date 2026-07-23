-- 007_cmdb_discovery.sql — audit des découvertes + correlation events->CI
CREATE SCHEMA IF NOT EXISTS discovery;

CREATE TABLE IF NOT EXISTS discovery.runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source      text NOT NULL DEFAULT 'ad',
  status      text NOT NULL DEFAULT 'running',
  found       int NOT NULL DEFAULT 0,
  created     int NOT NULL DEFAULT 0,
  updated     int NOT NULL DEFAULT 0,
  errors      jsonb NOT NULL DEFAULT '[]',
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_discovery_started ON discovery.runs (started_at DESC);
