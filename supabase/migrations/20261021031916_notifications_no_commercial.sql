-- O sino interno não recebe eventos comerciais (vendas e reembolsos vão por Push via
-- financial_event_outbox). Mantém só o que exige atenção: contestação e premiação liberada.
create or replace function public.notify_payment_transaction() returns trigger
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_product text := coalesce(nullif(new.product_name_snapshot,''),nullif(new.product_name,''),'Produto');
 v_total bigint; v_before bigint; v_award record;
begin
 if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;
 if new.status='approved' and new.currency='BRL' then
  v_total := public.award_eligible_revenue_cents(new.user_id); v_before := v_total - new.amount_cents;
  for v_award in select id, public.award_target_cents(id) as target from unnest(array['10k','100k','500k','1m','5m']) as id loop
   if v_before < v_award.target and v_total >= v_award.target then
    perform public.notify_user(new.user_id,'achievement','Sistema','Nova premiação liberada','Você alcançou o marco Sphex '||upper(v_award.id)||'. Solicite sua plaquinha em Premiações.','/app/premiacoes','high','{"source":"backend"}'::jsonb,'award:'||v_award.id||':unlocked');
   end if;
  end loop;
 elsif new.status='chargeback' then
  perform public.notify_user(new.user_id,'payment','Financeiro','Contestação recebida',v_product||' · '||public.format_money_cents(new.amount_cents,new.currency)||'. Acompanhe a disputa na Stripe.','/app/vendas/'||new.transaction_id,'critical',
   jsonb_build_object('product',v_product,'amount',new.amount_cents/100.0,'currency',new.currency,'status','chargeback','source','backend'),'tx:'||new.transaction_id||':chargeback');
 end if;
 return new;
end $$;
revoke all on function public.notify_payment_transaction() from public, anon, authenticated;
