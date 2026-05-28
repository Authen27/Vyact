-- Add budget period fields so budgets are stored server-side (TD-13)
-- Adds: period (text), period_start (date), period_end (date)

BEGIN;

ALTER TABLE budgets
  ADD COLUMN period text NOT NULL DEFAULT 'monthly',
  ADD COLUMN period_start date NULL,
  ADD COLUMN period_end date NULL;

ALTER TABLE budgets
  ADD CONSTRAINT budgets_period_check CHECK (period IN ('monthly','quarterly','half_yearly','annual','custom'));

COMMIT;
