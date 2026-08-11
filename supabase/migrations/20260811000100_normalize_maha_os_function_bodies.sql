-- Production's three original Maha OS functions were created with CRLF line
-- endings before the migration workflow existed. PostgreSQL treats those line
-- endings as part of prosrc, while the reviewed baseline uses LF. Supabase's
-- pg-delta engine therefore emits behaviorally identical CREATE OR REPLACE
-- statements forever and prevents the post-apply convergence proof.
--
-- Recreate only those functions from the reviewed baseline. Signatures,
-- security mode, search paths, bodies, ownership, grants and trigger bindings
-- are unchanged; CREATE OR REPLACE preserves dependencies and privileges.

CREATE OR REPLACE FUNCTION public.handle_new_node()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  generated_node_id TEXT;
BEGIN
  -- Generate a random MAHA-XXXX ID
  generated_node_id := 'MAHA-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

  -- Insert basic identity
  INSERT INTO public.nodes (id, email, node_id)
  VALUES (NEW.id, NEW.email, generated_node_id);

  -- Insert blank biological ledger
  INSERT INTO public.ledgers (id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, email, tier)
  values (new.id, new.email, 'SOVEREIGN');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.join_fireteam(target_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Row-level lock: Locks this specific fireteam row during the transaction
  UPDATE fireteams
  SET current_slots = current_slots + 1
  WHERE id = target_id
    AND current_slots < max_slots
    AND is_locked = FALSE;

  IF FOUND THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$function$;
