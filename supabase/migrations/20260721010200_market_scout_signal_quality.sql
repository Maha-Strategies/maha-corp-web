-- Market Scout signal quality: preserve whether an opportunity is a direct
-- buyer request, marketplace request, competitor content, or editorial context.
-- Existing rows predate classification and therefore default conservatively to
-- editorial content rather than being treated as buyer demand.

alter table public.market_opportunities
  add column if not exists signal_class text not null default 'editorial_content'
    check (signal_class in ('buyer_demand','competitor_content','marketplace_request','editorial_content'));

create index if not exists market_opportunities_signal_class_score_idx
  on public.market_opportunities (signal_class, score desc, created_at asc);

drop function if exists public.create_market_opportunity(text,text,text,text,text,text,text,jsonb,integer,integer,integer,integer,integer,integer,text,text,timestamptz);
create function public.create_market_opportunity(
  p_opportunity_id text, p_source text, p_signal_class text, p_source_reference text, p_title text, p_problem text, p_buyer text, p_proposed_solution text,
  p_evidence jsonb, p_demand_evidence integer, p_commercial_intent integer, p_capability_fit integer, p_speed_to_validate integer, p_risk_penalty integer, p_score integer,
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_existing public.market_opportunities%rowtype;
begin
  if p_opportunity_id !~ '^mapopp_[a-f0-9]{32}$' or p_source not in ('search_console','llm_query','freelance_market','manual_research','outbound_scout')
    or p_signal_class not in ('buyer_demand','competitor_content','marketplace_request','editorial_content')
    or char_length(p_source_reference) not between 3 and 200 or char_length(p_title) not between 8 and 180 or char_length(p_problem) not between 20 and 1500
    or char_length(p_buyer) not between 3 and 200 or char_length(p_proposed_solution) not between 20 and 1500
    or jsonb_typeof(p_evidence) <> 'array' or jsonb_array_length(p_evidence) not between 1 and 5
    or p_demand_evidence not between 0 and 30 or p_commercial_intent not between 0 and 25 or p_capability_fit not between 0 and 20 or p_speed_to_validate not between 0 and 15 or p_risk_penalty not between 0 and 20
    or p_score <> p_demand_evidence + p_commercial_intent + p_capability_fit + p_speed_to_validate - p_risk_penalty
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid market opportunity.' using errcode='22023'; end if;
  select * into v_existing from public.market_opportunities where source=p_source and source_reference=p_source_reference for update;
  if found then return jsonb_build_object('opportunityId',v_existing.public_id,'status',v_existing.status,'idempotentReplay',true); end if;
  insert into public.market_opportunities (public_id,source,signal_class,source_reference,title,problem,buyer,proposed_solution,evidence,demand_evidence,commercial_intent,capability_fit,speed_to_validate,risk_penalty,score,status,created_at,updated_at)
    values (p_opportunity_id,p_source,p_signal_class,p_source_reference,p_title,p_problem,p_buyer,p_proposed_solution,p_evidence,p_demand_evidence,p_commercial_intent,p_capability_fit,p_speed_to_validate,p_risk_penalty,p_score,'discovered',p_at,p_at);
  insert into public.market_opportunity_events (opportunity_id,action,idempotency_hash,actor_fingerprint,note,created_at)
    values (p_opportunity_id,'discovered',p_idempotency_hash,p_actor_fingerprint,'Evidence-backed opportunity recorded.',p_at);
  return jsonb_build_object('opportunityId',p_opportunity_id,'status','discovered','idempotentReplay',false);
end;
$$;
revoke all on function public.create_market_opportunity(text,text,text,text,text,text,text,text,jsonb,integer,integer,integer,integer,integer,integer,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.create_market_opportunity(text,text,text,text,text,text,text,text,jsonb,integer,integer,integer,integer,integer,integer,text,text,timestamptz) to service_role;
