-- 004_ticket_details.sql — champs métier inspirés du template EUSD
ALTER TABLE ticketing.tickets
  ADD COLUMN IF NOT EXISTS is_existing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS related_ticket_number bigint,
  ADD COLUMN IF NOT EXISTS first_seen_on date,
  ADD COLUMN IF NOT EXISTS users_affected text,          -- '1','3','5','10+'
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS asset_tag text,               -- actif / n° série
  ADD COLUMN IF NOT EXISTS callback_number text,
  ADD COLUMN IF NOT EXISTS troubleshooting text,         -- étapes de dépannage
  ADD COLUMN IF NOT EXISTS root_cause text,
  ADD COLUMN IF NOT EXISTS resolution_notes text,        -- résolution / prochaines étapes
  ADD COLUMN IF NOT EXISTS kb_article text;
