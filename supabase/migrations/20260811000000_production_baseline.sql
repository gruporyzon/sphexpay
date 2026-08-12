


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."dashboard_eligible_revenue"() RETURNS bigint
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select coalesce(sum(amount_cents),0)::bigint
  from public.payment_transactions
  where user_id=auth.uid() and status='approved';
$$;


ALTER FUNCTION "public"."dashboard_eligible_revenue"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_dashboard_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select coalesce(auth.jwt()->'app_metadata'->>'role','')='admin';
$$;


ALTER FUNCTION "public"."is_dashboard_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_payment_event"("input" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_provider text:=nullif(trim(input->>'provider'),'');
  v_event_id text:=nullif(trim(input->>'eventId'),'');
  v_external_id text:=nullif(trim(input->>'externalTransactionId'),'');
  v_event_type text:=nullif(trim(input->>'eventType'),'');
  v_status text:=nullif(trim(input->>'status'),'');
  v_product_id uuid;
  v_seller_id uuid;
  v_product public.products%rowtype;
  v_transaction public.payment_transactions%rowtype;
  v_previous_status text;
  v_occurred_at timestamptz:=coalesce(nullif(input->>'occurredAt','')::timestamptz,now());
  v_gross bigint:=coalesce((input->'amounts'->>'grossCents')::bigint,0);
  v_discount bigint:=coalesce((input->'amounts'->>'discountCents')::bigint,0);
  v_fee bigint:=coalesce((input->'amounts'->>'feeCents')::bigint,0);
  v_commission bigint:=coalesce((input->'amounts'->>'commissionCents')::bigint,0);
  v_final bigint:=coalesce((input->'amounts'->>'finalCents')::bigint,v_gross-v_discount);
  v_currency text:=upper(coalesce(input->>'currency',''));
  v_first_approval boolean:=false;
  v_outbox_type text;
begin
  if v_provider is null or v_event_id is null or v_external_id is null or v_event_type is null then
    raise exception using errcode='22023',message='INVALID_PAYMENT_EVENT';
  end if;
  if v_status not in ('approved','pending','declined','refunded','chargeback') then
    raise exception using errcode='22023',message='INVALID_PAYMENT_STATUS';
  end if;
  if exists(select 1 from public.payment_transaction_events where event_id=v_event_id) then
    select * into v_transaction from public.payment_transactions
      where provider=v_provider and external_transaction_id=v_external_id;
    return jsonb_build_object('duplicate',true,'transactionId',v_transaction.id,'approvedNow',false);
  end if;

  v_product_id:=(input->>'productId')::uuid;
  v_seller_id:=(input->>'sellerId')::uuid;
  select * into v_product from public.products where id=v_product_id and seller_id=v_seller_id and active;
  if not found then raise exception using errcode='22023',message='PRODUCT_NOT_AVAILABLE'; end if;
  if v_currency='' then v_currency:=v_product.currency; end if;
  if v_currency not in ('BRL','USD','EUR') or v_currency<>v_product.currency then
    raise exception using errcode='22023',message='INVALID_PAYMENT_CURRENCY';
  end if;
  if least(v_gross,v_discount,v_fee,v_commission,v_final)<0 or v_discount>v_gross or v_final<>v_gross-v_discount or v_fee>v_final then
    raise exception using errcode='22023',message='INVALID_PAYMENT_AMOUNTS';
  end if;

  select * into v_transaction from public.payment_transactions
    where provider=v_provider and external_transaction_id=v_external_id for update;
  if found then
    v_previous_status:=v_transaction.status;
    if v_transaction.user_id<>v_seller_id or v_transaction.product_id<>v_product_id then
      raise exception using errcode='22023',message='PAYMENT_IDENTITY_MISMATCH';
    end if;
    update public.payment_transactions set
      status=v_status,
      payment_method=coalesce(nullif(trim(input->>'paymentMethod'),''),payment_method),
      fee_cents=v_fee,
      net_amount_cents=greatest(0,v_final-v_fee),
      commission_cents=v_commission,
      customer_display_name=coalesce(nullif(trim(input->'customer'->>'displayName'),''),customer_display_name),
      customer_name=coalesce(nullif(trim(input->'customer'->>'displayName'),''),customer_name),
      approved_at=case when v_status='approved' then coalesce(approved_at,v_occurred_at) else approved_at end,
      refunded_at=case when v_status='refunded' then coalesce(refunded_at,v_occurred_at) else refunded_at end,
      chargeback_at=case when v_status='chargeback' then coalesce(chargeback_at,v_occurred_at) else chargeback_at end,
      updated_at=now(),
      metadata=metadata||coalesce(input->'rawMetadata','{}'::jsonb)
    where id=v_transaction.id returning * into v_transaction;
  else
    v_previous_status:=null;
    insert into public.payment_transactions(
      transaction_id,provider,external_transaction_id,user_id,product_id,
      product_name,product_name_snapshot,product_price_cents_snapshot,
      payment_method,status,amount_cents,gross_amount_cents,discount_cents,fee_cents,
      net_amount_cents,commission_cents,currency,customer_name,customer_display_name,
      occurred_at,approved_at,refunded_at,chargeback_at,updated_at,metadata
    ) values (
      v_provider||':'||v_external_id,v_provider,v_external_id,v_seller_id,v_product.id,
      v_product.name,v_product.name,v_product.price_cents,
      coalesce(nullif(trim(input->>'paymentMethod'),''),'unknown'),v_status,v_final,v_gross,v_discount,v_fee,
      greatest(0,v_final-v_fee),v_commission,v_currency,
      nullif(trim(input->'customer'->>'displayName'),''),nullif(trim(input->'customer'->>'displayName'),''),
      v_occurred_at,
      case when v_status='approved' then v_occurred_at end,
      case when v_status='refunded' then v_occurred_at end,
      case when v_status='chargeback' then v_occurred_at end,
      now(),coalesce(input->'rawMetadata','{}'::jsonb)
    ) returning * into v_transaction;
  end if;

  v_first_approval:=v_status='approved' and v_previous_status is distinct from 'approved'
    and not exists(select 1 from public.payment_transaction_events
      where transaction_id=v_transaction.id and status='approved');

  insert into public.payment_transaction_events(
    event_id,provider,external_transaction_id,transaction_id,user_id,event_type,
    previous_status,status,occurred_at,metadata
  ) values (
    v_event_id,v_provider,v_external_id,v_transaction.id,v_seller_id,v_event_type,
    v_previous_status,v_status,v_occurred_at,coalesce(input->'rawMetadata','{}'::jsonb)
  );

  v_outbox_type:=case
    when v_first_approval then 'sale_approved'
    when v_status='refunded' and v_previous_status is distinct from 'refunded' then 'refund_done'
    when v_status='chargeback' and v_previous_status is distinct from 'chargeback' then 'chargeback_received'
    else null
  end;
  if v_outbox_type is not null then
    insert into public.financial_event_outbox(event_id,transaction_id,user_id,event_type,payload)
    values (
      v_event_id||':'||v_outbox_type,v_transaction.id,v_seller_id,v_outbox_type,
      jsonb_build_object(
        'transactionId',v_transaction.transaction_id,'productId',v_product.id,
        'productName',v_transaction.product_name_snapshot,'currency',v_currency,
        'commissionCents',v_commission,'amountCents',v_final,
        'route','/app/transacoes/'||v_transaction.transaction_id
      )
    ) on conflict(event_id) do nothing;
  end if;

  return jsonb_build_object(
    'duplicate',false,'transactionId',v_transaction.id,
    'publicTransactionId',v_transaction.transaction_id,
    'productName',v_transaction.product_name_snapshot,
    'approvedNow',v_first_approval,'outboxEventType',v_outbox_type
  );
end;
$$;


ALTER FUNCTION "public"."process_payment_event"("input" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
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
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."dashboard_exchange_rates" (
    "base_currency" "text" NOT NULL,
    "quote_currency" "text" NOT NULL,
    "rate" numeric(20,10) NOT NULL,
    "source" "text" NOT NULL,
    "fetched_at" timestamp with time zone NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "dashboard_exchange_rates_base_currency_check" CHECK (("base_currency" = ANY (ARRAY['BRL'::"text", 'USD'::"text", 'EUR'::"text"]))),
    CONSTRAINT "dashboard_exchange_rates_check" CHECK (("base_currency" <> "quote_currency")),
    CONSTRAINT "dashboard_exchange_rates_quote_currency_check" CHECK (("quote_currency" = ANY (ARRAY['BRL'::"text", 'USD'::"text", 'EUR'::"text"]))),
    CONSTRAINT "dashboard_exchange_rates_rate_check" CHECK (("rate" > (0)::numeric)),
    CONSTRAINT "dashboard_exchange_rates_source_check" CHECK (("length"(TRIM(BOTH FROM "source")) > 0))
);


ALTER TABLE "public"."dashboard_exchange_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dashboard_scenarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'Planejamento'::"text" NOT NULL,
    "currency" "text" NOT NULL,
    "today_revenue_cents" bigint NOT NULL,
    "today_approved_sales" integer NOT NULL,
    "average_ticket_cents" bigint NOT NULL,
    "approval_rate" numeric(6,5) NOT NULL,
    "refund_rate" numeric(6,5) NOT NULL,
    "chargeback_rate" numeric(6,5) NOT NULL,
    "daily_growth_rate" numeric(8,6) NOT NULL,
    "weekday_factors" "jsonb" NOT NULL,
    "hourly_distribution" "jsonb" NOT NULL,
    "seed" integer DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dashboard_scenarios_approval_rate_check" CHECK ((("approval_rate" >= (0)::numeric) AND ("approval_rate" <= (1)::numeric))),
    CONSTRAINT "dashboard_scenarios_average_ticket_cents_check" CHECK (("average_ticket_cents" >= 0)),
    CONSTRAINT "dashboard_scenarios_chargeback_rate_check" CHECK ((("chargeback_rate" >= (0)::numeric) AND ("chargeback_rate" <= (1)::numeric))),
    CONSTRAINT "dashboard_scenarios_currency_check" CHECK (("currency" = ANY (ARRAY['BRL'::"text", 'USD'::"text", 'EUR'::"text"]))),
    CONSTRAINT "dashboard_scenarios_daily_growth_rate_check" CHECK ((("daily_growth_rate" >= ('-1'::integer)::numeric) AND ("daily_growth_rate" <= (10)::numeric))),
    CONSTRAINT "dashboard_scenarios_refund_rate_check" CHECK ((("refund_rate" >= (0)::numeric) AND ("refund_rate" <= (1)::numeric))),
    CONSTRAINT "dashboard_scenarios_today_approved_sales_check" CHECK (("today_approved_sales" >= 0)),
    CONSTRAINT "dashboard_scenarios_today_revenue_cents_check" CHECK (("today_revenue_cents" >= 0))
);


ALTER TABLE "public"."dashboard_scenarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_event_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "financial_event_outbox_attempts_check" CHECK (("attempts" >= 0)),
    CONSTRAINT "financial_event_outbox_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'processed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."financial_event_outbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_transaction_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "external_transaction_id" "text" NOT NULL,
    "transaction_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "previous_status" "text",
    "status" "text" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_transaction_events_status_check" CHECK (("status" = ANY (ARRAY['approved'::"text", 'pending'::"text", 'declined'::"text", 'refunded'::"text", 'chargeback'::"text"])))
);


ALTER TABLE "public"."payment_transaction_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "customer_name" "text",
    "product_name" "text" NOT NULL,
    "payment_method" "text" NOT NULL,
    "status" "text" NOT NULL,
    "amount_cents" bigint NOT NULL,
    "fee_cents" bigint DEFAULT 0 NOT NULL,
    "currency" "text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_at" timestamp with time zone,
    "refunded_at" timestamp with time zone,
    "chargeback_at" timestamp with time zone,
    "financial_at" timestamp with time zone GENERATED ALWAYS AS (COALESCE("chargeback_at", "refunded_at", "approved_at", "occurred_at")) STORED,
    "persisted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "provider" "text",
    "external_transaction_id" "text",
    "product_id" "uuid",
    "product_name_snapshot" "text",
    "product_price_cents_snapshot" bigint,
    "gross_amount_cents" bigint,
    "discount_cents" bigint DEFAULT 0 NOT NULL,
    "net_amount_cents" bigint,
    "commission_cents" bigint DEFAULT 0 NOT NULL,
    "customer_display_name" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_transactions_amount_cents_check" CHECK (("amount_cents" >= 0)),
    CONSTRAINT "payment_transactions_check" CHECK ((("fee_cents" >= 0) AND ("fee_cents" <= "amount_cents"))),
    CONSTRAINT "payment_transactions_check1" CHECK ((("status" <> 'approved'::"text") OR ("approved_at" IS NOT NULL))),
    CONSTRAINT "payment_transactions_check2" CHECK ((("status" <> 'refunded'::"text") OR ("refunded_at" IS NOT NULL))),
    CONSTRAINT "payment_transactions_check3" CHECK ((("status" <> 'chargeback'::"text") OR ("chargeback_at" IS NOT NULL))),
    CONSTRAINT "payment_transactions_currency_check" CHECK (("currency" = ANY (ARRAY['BRL'::"text", 'USD'::"text", 'EUR'::"text"]))),
    CONSTRAINT "payment_transactions_status_check" CHECK (("status" = ANY (ARRAY['approved'::"text", 'pending'::"text", 'declined'::"text", 'refunded'::"text", 'chargeback'::"text"])))
);

ALTER TABLE ONLY "public"."payment_transactions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."payment_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "price_cents" bigint NOT NULL,
    "currency" "text" DEFAULT 'BRL'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "products_currency_check" CHECK (("currency" = ANY (ARRAY['BRL'::"text", 'USD'::"text", 'EUR'::"text"]))),
    CONSTRAINT "products_name_check" CHECK ((("length"(TRIM(BOTH FROM "name")) >= 2) AND ("length"(TRIM(BOTH FROM "name")) <= 160))),
    CONSTRAINT "products_price_cents_check" CHECK (("price_cents" >= 0))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_delivery_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "event_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "delivered_at" timestamp with time zone,
    CONSTRAINT "push_delivery_log_status_check" CHECK (("status" = ANY (ARRAY['sending'::"text", 'delivered'::"text", 'failed'::"text"])))
);

ALTER TABLE ONLY "public"."push_delivery_log" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_delivery_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "device_name" "text",
    "platform" "text",
    "browser" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_error" "text",
    "last_success_at" timestamp with time zone,
    "device_id" "uuid" NOT NULL,
    "automatic_name" "text",
    "endpoint_hash" "text" NOT NULL,
    "operating_system" "text",
    "display_mode" "text",
    "locale" "text",
    "timezone" "text",
    "last_failure_at" timestamp with time zone,
    "failure_count" integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY "public"."push_subscriptions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."dashboard_exchange_rates"
    ADD CONSTRAINT "dashboard_exchange_rates_pkey" PRIMARY KEY ("base_currency", "quote_currency");



ALTER TABLE ONLY "public"."dashboard_scenarios"
    ADD CONSTRAINT "dashboard_scenarios_owner_id_name_key" UNIQUE ("owner_id", "name");



ALTER TABLE ONLY "public"."dashboard_scenarios"
    ADD CONSTRAINT "dashboard_scenarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_event_outbox"
    ADD CONSTRAINT "financial_event_outbox_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."financial_event_outbox"
    ADD CONSTRAINT "financial_event_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_transaction_events"
    ADD CONSTRAINT "payment_transaction_events_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."payment_transaction_events"
    ADD CONSTRAINT "payment_transaction_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_transaction_id_key" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_delivery_log"
    ADD CONSTRAINT "push_delivery_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_delivery_log"
    ADD CONSTRAINT "push_delivery_log_subscription_id_event_id_key" UNIQUE ("subscription_id", "event_id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



CREATE INDEX "financial_event_outbox_status_idx" ON "public"."financial_event_outbox" USING "btree" ("status", "created_at");



CREATE INDEX "payment_transaction_events_transaction_idx" ON "public"."payment_transaction_events" USING "btree" ("transaction_id", "created_at");



CREATE INDEX "payment_transactions_product_idx" ON "public"."payment_transactions" USING "btree" ("product_id");



CREATE UNIQUE INDEX "payment_transactions_provider_external_idx" ON "public"."payment_transactions" USING "btree" ("provider", "external_transaction_id") WHERE (("provider" IS NOT NULL) AND ("external_transaction_id" IS NOT NULL));



CREATE INDEX "payment_transactions_user_time_idx" ON "public"."payment_transactions" USING "btree" ("user_id", "financial_at" DESC);



CREATE INDEX "payment_transactions_user_updated_idx" ON "public"."payment_transactions" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "products_seller_active_idx" ON "public"."products" USING "btree" ("seller_id", "active");



CREATE INDEX "push_delivery_log_user_id_idx" ON "public"."push_delivery_log" USING "btree" ("user_id");



CREATE INDEX "push_subscriptions_active_user_idx" ON "public"."push_subscriptions" USING "btree" ("user_id", "enabled", "last_seen_at" DESC);



CREATE UNIQUE INDEX "push_subscriptions_endpoint_hash_unique_idx" ON "public"."push_subscriptions" USING "btree" ("endpoint_hash");



CREATE UNIQUE INDEX "push_subscriptions_endpoint_unique_idx" ON "public"."push_subscriptions" USING "btree" ("endpoint");



CREATE UNIQUE INDEX "push_subscriptions_user_device_unique_idx" ON "public"."push_subscriptions" USING "btree" ("user_id", "device_id");



CREATE INDEX "push_subscriptions_user_enabled_seen_idx" ON "public"."push_subscriptions" USING "btree" ("user_id", "enabled", "last_seen_at" DESC);



CREATE INDEX "push_subscriptions_user_id_idx" ON "public"."push_subscriptions" USING "btree" ("user_id");



ALTER TABLE ONLY "public"."dashboard_exchange_rates"
    ADD CONSTRAINT "dashboard_exchange_rates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."dashboard_scenarios"
    ADD CONSTRAINT "dashboard_scenarios_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_event_outbox"
    ADD CONSTRAINT "financial_event_outbox_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_event_outbox"
    ADD CONSTRAINT "financial_event_outbox_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_transaction_events"
    ADD CONSTRAINT "payment_transaction_events_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_transaction_events"
    ADD CONSTRAINT "payment_transaction_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_delivery_log"
    ADD CONSTRAINT "push_delivery_log_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_delivery_log"
    ADD CONSTRAINT "push_delivery_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."dashboard_exchange_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dashboard_exchange_rates_admin_write" ON "public"."dashboard_exchange_rates" TO "authenticated" USING ("public"."is_dashboard_admin"()) WITH CHECK (("public"."is_dashboard_admin"() AND ("updated_by" = "auth"."uid"())));



CREATE POLICY "dashboard_exchange_rates_authenticated_read" ON "public"."dashboard_exchange_rates" FOR SELECT TO "authenticated" USING ("enabled");



ALTER TABLE "public"."dashboard_scenarios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dashboard_scenarios_admin_delete" ON "public"."dashboard_scenarios" FOR DELETE TO "authenticated" USING ((("owner_id" = "auth"."uid"()) AND "public"."is_dashboard_admin"()));



CREATE POLICY "dashboard_scenarios_admin_insert" ON "public"."dashboard_scenarios" FOR INSERT TO "authenticated" WITH CHECK ((("owner_id" = "auth"."uid"()) AND "public"."is_dashboard_admin"()));



CREATE POLICY "dashboard_scenarios_admin_read" ON "public"."dashboard_scenarios" FOR SELECT TO "authenticated" USING ((("owner_id" = "auth"."uid"()) AND "public"."is_dashboard_admin"()));



CREATE POLICY "dashboard_scenarios_admin_update" ON "public"."dashboard_scenarios" FOR UPDATE TO "authenticated" USING ((("owner_id" = "auth"."uid"()) AND "public"."is_dashboard_admin"())) WITH CHECK ((("owner_id" = "auth"."uid"()) AND "public"."is_dashboard_admin"()));



ALTER TABLE "public"."financial_event_outbox" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_event_outbox_own_read" ON "public"."financial_event_outbox" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."payment_transaction_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_transaction_events_own_read" ON "public"."payment_transaction_events" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."payment_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_transactions_own_read" ON "public"."payment_transactions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_own_delete" ON "public"."products" FOR DELETE TO "authenticated" USING (("seller_id" = "auth"."uid"()));



CREATE POLICY "products_own_insert" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK (("seller_id" = "auth"."uid"()));



CREATE POLICY "products_own_read" ON "public"."products" FOR SELECT TO "authenticated" USING (("seller_id" = "auth"."uid"()));



CREATE POLICY "products_own_update" ON "public"."products" FOR UPDATE TO "authenticated" USING (("seller_id" = "auth"."uid"())) WITH CHECK (("seller_id" = "auth"."uid"()));



ALTER TABLE "public"."push_delivery_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_delivery_log_select_own" ON "public"."push_delivery_log" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_subscriptions_delete_own" ON "public"."push_subscriptions" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "push_subscriptions_insert_own" ON "public"."push_subscriptions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "push_subscriptions_select_own" ON "public"."push_subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "push_subscriptions_update_own" ON "public"."push_subscriptions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."dashboard_eligible_revenue"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_eligible_revenue"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_eligible_revenue"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_dashboard_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_dashboard_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_dashboard_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."process_payment_event"("input" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_payment_event"("input" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_exchange_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_exchange_rates" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_scenarios" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_scenarios" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."financial_event_outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_event_outbox" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payment_transaction_events" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_transaction_events" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payment_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."push_delivery_log" TO "authenticated";
GRANT ALL ON TABLE "public"."push_delivery_log" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("user_id") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("updated_at"),UPDATE("updated_at") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("device_name"),UPDATE("device_name") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("platform") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("browser") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("enabled"),UPDATE("enabled") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("last_seen_at") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("last_success_at") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("device_id") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("automatic_name") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("operating_system") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("display_mode") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("locale") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("timezone") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("last_failure_at") ON TABLE "public"."push_subscriptions" TO "authenticated";



GRANT SELECT("failure_count") ON TABLE "public"."push_subscriptions" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







