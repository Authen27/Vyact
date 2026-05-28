-- TD-08: Populate activity_log from domain CRUD (transactions, budgets, goals, debts, assets, memberships)
-- Creates a trigger function that inserts an activity_log row on INSERT/UPDATE/DELETE.
--
-- Review correction (lead): the originally-submitted patch was missing
-- two things: (a) the `memberships` table from the trigger list (the
-- prompt explicitly listed it; multi-household member changes are exactly
-- the audit signal we need), and (b) `SET search_path = public, pg_temp`
-- on the SECURITY DEFINER function — without this, a malicious schema
-- on the caller's search path can shadow `activity_log` / `auth.uid()`
-- and exfiltrate or tamper with the audit trail. Both fixed inline.

BEGIN;

-- Safety: replace the function if it exists
CREATE OR REPLACE FUNCTION public.log_domain_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  h uuid;
  act text;
  ent text := TG_TABLE_NAME;
  ent_id uuid;
  ch jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    act := 'created';
    h := NEW.household_id;
    ent_id := NEW.id;
    ch := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    act := 'updated';
    h := NEW.household_id;
    ent_id := NEW.id;
    ch := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    act := 'deleted';
    h := OLD.household_id;
    ent_id := OLD.id;
    ch := to_jsonb(OLD);
  ELSE
    RETURN NULL;
  END IF;

  INSERT INTO activity_log (household_id, actor_id, action, entity_type, entity_id, changes)
  VALUES (h, auth.uid(), act, ent, ent_id, ch);

  RETURN NULL;
END;
$$;

-- Attach triggers for domain tables
DO $$
BEGIN
  -- transactions
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'activity_txn_trigger') THEN
    CREATE TRIGGER activity_txn_trigger
      AFTER INSERT OR UPDATE OR DELETE ON transactions
      FOR EACH ROW EXECUTE FUNCTION public.log_domain_activity();
  END IF;
  -- budgets
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'activity_budgets_trigger') THEN
    CREATE TRIGGER activity_budgets_trigger
      AFTER INSERT OR UPDATE OR DELETE ON budgets
      FOR EACH ROW EXECUTE FUNCTION public.log_domain_activity();
  END IF;
  -- goals
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'activity_goals_trigger') THEN
    CREATE TRIGGER activity_goals_trigger
      AFTER INSERT OR UPDATE OR DELETE ON goals
      FOR EACH ROW EXECUTE FUNCTION public.log_domain_activity();
  END IF;
  -- debts
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'activity_debts_trigger') THEN
    CREATE TRIGGER activity_debts_trigger
      AFTER INSERT OR UPDATE OR DELETE ON debts
      FOR EACH ROW EXECUTE FUNCTION public.log_domain_activity();
  END IF;
  -- assets
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'activity_assets_trigger') THEN
    CREATE TRIGGER activity_assets_trigger
      AFTER INSERT OR UPDATE OR DELETE ON assets
      FOR EACH ROW EXECUTE FUNCTION public.log_domain_activity();
  END IF;
  -- memberships (review-correction: was missing in submitted patch)
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'activity_memberships_trigger') THEN
    CREATE TRIGGER activity_memberships_trigger
      AFTER INSERT OR UPDATE OR DELETE ON memberships
      FOR EACH ROW EXECUTE FUNCTION public.log_domain_activity();
  END IF;
END$$;

COMMIT;
