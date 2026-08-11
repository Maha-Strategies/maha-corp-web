-- Reproducible, least-privilege baseline for Maha OS objects already present
-- in the intentionally unified Production project before infrastructure
-- migrations 20260809000300+.
--
-- Production records this version as applied through the reviewed baseline
-- workflow and does not execute it there. Clean and staging databases execute
-- it normally. Migration 20260809000251 applies the same hardened definitions
-- and privileges to the existing live objects.
--
-- Schema-only source evidence: Production dry-run 31474467637 at commit
-- bf41ab2611f2b4dee62d712a2795fb8b32acf0da. No customer data is included.

CREATE FUNCTION public.handle_new_node()
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
GRANT ALL ON FUNCTION public.handle_new_node() TO service_role;
CREATE FUNCTION public.handle_new_user()
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
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;
CREATE FUNCTION public.join_fireteam(target_id uuid)
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
GRANT ALL ON FUNCTION public.join_fireteam(uuid) TO service_role;
CREATE FUNCTION public.purge_node_data(target_uid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public', 'pg_catalog'
AS $function$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  delete from auth.users where id = target_uid;
end;
$function$;
GRANT ALL ON FUNCTION public.purge_node_data(uuid) TO service_role;
CREATE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;
CREATE TABLE public.fireteam_messages (id uuid DEFAULT gen_random_uuid() NOT NULL, fireteam_id uuid, sender_alias text NOT NULL, message_text text NOT NULL, created_at timestamp with time zone DEFAULT now());
ALTER TABLE public.fireteam_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fireteam_messages ADD CONSTRAINT fireteam_messages_pkey PRIMARY KEY (id);
GRANT ALL ON public.fireteam_messages TO service_role;
CREATE POLICY "Anyone can view messages" ON public.fireteam_messages FOR SELECT USING (true);
CREATE POLICY "Authenticated peers can send messages" ON public.fireteam_messages FOR INSERT WITH CHECK (true);
CREATE TABLE public.fireteam_waitlist (id uuid DEFAULT gen_random_uuid() NOT NULL, email text NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL);
ALTER TABLE public.fireteam_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fireteam_waitlist ADD CONSTRAINT fireteam_waitlist_email_key UNIQUE (email);
ALTER TABLE public.fireteam_waitlist ADD CONSTRAINT fireteam_waitlist_pkey PRIMARY KEY (id);
GRANT ALL ON public.fireteam_waitlist TO service_role;
CREATE POLICY "Allow public inserts" ON public.fireteam_waitlist FOR INSERT WITH CHECK (true);
CREATE TABLE public.fireteams (id uuid DEFAULT gen_random_uuid() NOT NULL, leader_alias text NOT NULL, activity_name text NOT NULL, max_slots integer DEFAULT 6, current_slots integer DEFAULT 1, is_locked boolean DEFAULT false, created_at timestamp with time zone DEFAULT now());
ALTER TABLE public.fireteams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fireteams ADD CONSTRAINT fireteams_pkey PRIMARY KEY (id);
ALTER TABLE public.fireteam_messages ADD CONSTRAINT fireteam_messages_fireteam_id_fkey FOREIGN KEY (fireteam_id) REFERENCES public.fireteams(id) ON DELETE CASCADE;
GRANT ALL ON public.fireteams TO service_role;
CREATE POLICY "Anyone can update fireteams" ON public.fireteams FOR UPDATE USING (true);
CREATE POLICY "Anyone can view active fireteams" ON public.fireteams FOR SELECT USING (true);
CREATE POLICY "Authenticated peers can create fireteams" ON public.fireteams FOR INSERT WITH CHECK (true);
CREATE TABLE public.gateway_sessions (sid text NOT NULL, node_id text NOT NULL, created_at timestamp with time zone DEFAULT now());
ALTER TABLE public.gateway_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_sessions ADD CONSTRAINT gateway_sessions_pkey PRIMARY KEY (sid);
GRANT ALL ON public.gateway_sessions TO service_role;
CREATE TABLE public.ios_vanguard_waitlist (id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL, email text NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL);
ALTER TABLE public.ios_vanguard_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ios_vanguard_waitlist ADD CONSTRAINT ios_vanguard_waitlist_email_key UNIQUE (email);
ALTER TABLE public.ios_vanguard_waitlist ADD CONSTRAINT ios_vanguard_waitlist_pkey PRIMARY KEY (id);
GRANT ALL ON public.ios_vanguard_waitlist TO service_role;
CREATE POLICY "Allow anonymous inserts" ON public.ios_vanguard_waitlist FOR INSERT TO anon WITH CHECK (true);
CREATE TABLE public.knowledge_network_gsc_connections (operator_email text NOT NULL, refresh_token text NOT NULL, connected_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.knowledge_network_gsc_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_network_gsc_connections ADD CONSTRAINT knowledge_network_gsc_connections_pkey PRIMARY KEY (operator_email);
GRANT ALL ON public.knowledge_network_gsc_connections TO service_role;
CREATE TABLE public.knowledge_network_gsc_snapshots (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, operator_email text NOT NULL, property text NOT NULL, period text NOT NULL, start_date date NOT NULL, end_date date NOT NULL, clicks numeric NOT NULL, impressions numeric NOT NULL, ctr numeric NOT NULL, average_position numeric NOT NULL, imported_at timestamp with time zone DEFAULT now() NOT NULL, source text NOT NULL, domain text NOT NULL, canonical_urls integer, indexed_urls integer, index_audit_status text, index_audited_at timestamp with time zone, index_audit_offset integer, index_audit_inspected integer);
ALTER TABLE public.knowledge_network_gsc_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_network_gsc_snapshots ADD CONSTRAINT knowledge_network_gsc_snapshots_operator_email_domain_period_ke UNIQUE (operator_email, domain, period);
ALTER TABLE public.knowledge_network_gsc_snapshots ADD CONSTRAINT knowledge_network_gsc_snapshots_period_check CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'::text);
ALTER TABLE public.knowledge_network_gsc_snapshots ADD CONSTRAINT knowledge_network_gsc_snapshots_pkey PRIMARY KEY (id);
GRANT ALL ON public.knowledge_network_gsc_snapshots TO service_role;
CREATE TABLE public.ledgers (id uuid NOT NULL, biometrics jsonb DEFAULT '{"hrv": 0, "rhr": 0, "grip": 0, "glucose": 0, "decisionVelocity": 0}'::jsonb, tasks jsonb DEFAULT '[]'::jsonb, inventory jsonb DEFAULT '[]'::jsonb, task_proofs jsonb DEFAULT '{}'::jsonb, verified_peers jsonb DEFAULT '[]'::jsonb, fidelity_score integer DEFAULT 0, readiness_score integer DEFAULT 0, updated_at timestamp with time zone DEFAULT now());
ALTER TABLE public.ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledgers ADD CONSTRAINT ledgers_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ledgers ADD CONSTRAINT ledgers_pkey PRIMARY KEY (id);
GRANT ALL ON public.ledgers TO service_role;
CREATE POLICY "Ledgers are strictly private" ON public.ledgers TO authenticated USING ((auth.uid() = id));
CREATE TABLE public.maha_dispatch_subscribers (id uuid DEFAULT gen_random_uuid() NOT NULL, email text NOT NULL, receive_weekly_reflection boolean DEFAULT false NOT NULL, receive_maha_dispatch boolean DEFAULT true NOT NULL, source text DEFAULT 'maha-os'::text NOT NULL, consent_at timestamp with time zone DEFAULT now() NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, confirmation_token_hash text, confirmed_at timestamp with time zone, confirmation_sent_at timestamp with time zone, unsubscribe_token_hash text, unsubscribed_at timestamp with time zone);
ALTER TABLE public.maha_dispatch_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maha_dispatch_subscribers ADD CONSTRAINT maha_dispatch_subscribers_email_check CHECK (POSITION(('@'::text) IN (email)) > 1);
ALTER TABLE public.maha_dispatch_subscribers ADD CONSTRAINT maha_dispatch_subscribers_email_key UNIQUE (email);
ALTER TABLE public.maha_dispatch_subscribers ADD CONSTRAINT maha_dispatch_subscribers_pkey PRIMARY KEY (id);
GRANT ALL ON public.maha_dispatch_subscribers TO service_role;
CREATE INDEX maha_dispatch_subscribers_confirmation_token_hash_idx ON public.maha_dispatch_subscribers (confirmation_token_hash) WHERE confirmation_token_hash IS NOT NULL;
CREATE TABLE public.nodal_feedback_ledger (id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL, category text NOT NULL, payload text NOT NULL, node_status text DEFAULT 'anonymous'::text, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL);
ALTER TABLE public.nodal_feedback_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodal_feedback_ledger ADD CONSTRAINT nodal_feedback_ledger_pkey PRIMARY KEY (id);
GRANT ALL ON public.nodal_feedback_ledger TO service_role;
CREATE POLICY "Allow anonymous feedback transmissions" ON public.nodal_feedback_ledger FOR INSERT TO anon WITH CHECK (true);
CREATE TABLE public.nodes (id uuid NOT NULL, node_id text NOT NULL, email text, tier text DEFAULT 'SOVEREIGN'::text, created_at timestamp with time zone DEFAULT now());
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ADD CONSTRAINT nodes_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.nodes ADD CONSTRAINT nodes_node_id_key UNIQUE (node_id);
ALTER TABLE public.nodes ADD CONSTRAINT nodes_pkey PRIMARY KEY (id);
GRANT ALL ON public.nodes TO service_role;
CREATE POLICY "Nodes are updatable by owner" ON public.nodes FOR UPDATE TO authenticated USING ((auth.uid() = id));
CREATE POLICY "Nodes are viewable by authenticated users" ON public.nodes FOR SELECT TO authenticated USING (true);
CREATE TABLE public.profiles (id uuid NOT NULL, email text, tier text DEFAULT 'SOVEREIGN'::text);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
GRANT ALL ON public.profiles TO service_role;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));
CREATE TABLE public.scan_ledger (id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL, node_id uuid NOT NULL, scan_date date DEFAULT CURRENT_DATE NOT NULL, scan_count integer DEFAULT 1);
ALTER TABLE public.scan_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_ledger ADD CONSTRAINT scan_ledger_node_id_fkey FOREIGN KEY (node_id) REFERENCES auth.users(id);
ALTER TABLE public.scan_ledger ADD CONSTRAINT scan_ledger_node_id_scan_date_key UNIQUE (node_id, scan_date);
ALTER TABLE public.scan_ledger ADD CONSTRAINT scan_ledger_pkey PRIMARY KEY (id);
GRANT ALL ON public.scan_ledger TO service_role;
CREATE TABLE public.ugc_reports (id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL, reporter_id uuid, reported_node_id uuid NOT NULL, message_id text NOT NULL, reason text, status text DEFAULT 'PENDING_REVIEW'::text, created_at timestamp with time zone DEFAULT now());
ALTER TABLE public.ugc_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ugc_reports ADD CONSTRAINT ugc_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.ugc_reports ADD CONSTRAINT ugc_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id);
GRANT ALL ON public.ugc_reports TO service_role;
CREATE TABLE public.vanguard_links (id uuid DEFAULT gen_random_uuid() NOT NULL, recruiter_id uuid, recruit_id uuid, created_at timestamp with time zone DEFAULT now());
ALTER TABLE public.vanguard_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_links ADD CONSTRAINT vanguard_links_pkey PRIMARY KEY (id);
ALTER TABLE public.vanguard_links ADD CONSTRAINT vanguard_links_recruit_id_fkey FOREIGN KEY (recruit_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.vanguard_links ADD CONSTRAINT vanguard_links_recruit_id_key UNIQUE (recruit_id);
ALTER TABLE public.vanguard_links ADD CONSTRAINT vanguard_links_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES auth.users(id) ON DELETE CASCADE;
GRANT ALL ON public.vanguard_links TO service_role;
CREATE POLICY "Recruits can establish uplinks" ON public.vanguard_links FOR INSERT TO authenticated WITH CHECK ((auth.uid() = recruit_id));
CREATE POLICY "Users can view their own Vanguard network" ON public.vanguard_links FOR SELECT TO authenticated USING (((auth.uid() = recruiter_id) OR (auth.uid() = recruit_id)));
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') EXECUTE FUNCTION public.rls_auto_enable();


REVOKE ALL ON FUNCTION public.handle_new_node() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_fireteam(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_node_data(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.fireteam_messages, public.fireteam_waitlist, public.fireteams,
  public.gateway_sessions, public.ios_vanguard_waitlist,
  public.knowledge_network_gsc_connections, public.knowledge_network_gsc_snapshots,
  public.ledgers, public.maha_dispatch_subscribers, public.nodal_feedback_ledger,
  public.nodes, public.profiles, public.scan_ledger, public.ugc_reports,
  public.vanguard_links
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_node() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.join_fireteam(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_node_data(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;

GRANT SELECT ON TABLE public.fireteam_messages TO anon, authenticated;
GRANT INSERT ON TABLE public.fireteam_messages TO authenticated;
GRANT INSERT ON TABLE public.fireteam_waitlist TO anon, authenticated;
GRANT SELECT ON TABLE public.fireteams TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.fireteams TO authenticated;
GRANT INSERT ON TABLE public.ios_vanguard_waitlist TO anon;
GRANT SELECT, UPDATE ON TABLE public.ledgers TO authenticated;
GRANT INSERT ON TABLE public.nodal_feedback_ledger TO anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.nodes TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT ON TABLE public.vanguard_links TO authenticated;

GRANT ALL ON TABLE public.fireteam_messages, public.fireteam_waitlist, public.fireteams,
  public.gateway_sessions, public.ios_vanguard_waitlist,
  public.knowledge_network_gsc_connections, public.knowledge_network_gsc_snapshots,
  public.ledgers, public.maha_dispatch_subscribers, public.nodal_feedback_ledger,
  public.nodes, public.profiles, public.scan_ledger, public.ugc_reports,
  public.vanguard_links
TO service_role;
