-- 003_audit_actor.sql — l'audit applicatif porte l'acteur; le trigger ne
-- logge plus (doublon) et se contente de bump updated_at.
CREATE OR REPLACE FUNCTION ticketing.audit_ticket() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;
