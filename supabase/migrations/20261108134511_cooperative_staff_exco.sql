begin;
create schema coop_private;
revoke all on schema coop_private from public, anon, authenticated;

create table coop_private.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('staff', 'exco')),
  display_name text not null check (length(btrim(display_name)) between 1 and 100)
);
create table coop_private.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  unit text not null,
  category text not null,
  price integer not null check (price between 1 and 1000000000),
  reorder integer not null default 0 check (reorder >= 0),
  on_hand integer not null default 0 check (on_hand >= 0)
);
create table coop_private.ledger (
  id uuid primary key,
  kind text not null check (kind in ('receipt', 'sale')),
  product uuid not null references coop_private.products(id),
  qty integer not null check (qty <> 0),
  amount bigint,
  note text,
  actor_id uuid not null,
  actor text not null,
  at timestamptz not null default clock_timestamp()
);
alter table coop_private.accounts enable row level security;
alter table coop_private.products enable row level security;
alter table coop_private.ledger enable row level security;
create index coop_ledger_actor_time on coop_private.ledger (actor_id, at);
create index coop_ledger_product on coop_private.ledger (product);

create function coop_private.snapshot() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  select a.role into v_role from coop_private.accounts a where a.user_id = v_uid;
  if v_role is null then
    raise exception 'Account is not authorised' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'role', v_role,
    'products', coalesce((select jsonb_agg(to_jsonb(p) order by p.name) from coop_private.products p), '[]'::jsonb),
    'members', '[]'::jsonb,
    'ledger', coalesce((
      select jsonb_agg((to_jsonb(l) - 'actor_id' - 'kind') || jsonb_build_object('type', l.kind) order by l.at, l.id)
      from coop_private.ledger l where v_role = 'exco' or l.actor_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

create function coop_private.post(p_request uuid, p_kind text, p_product uuid, p_qty integer, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_actor text;
  v_existing coop_private.ledger%rowtype;
  v_price integer;
  v_on_hand integer;
  v_delta integer;
  v_note text := nullif(btrim(p_note), '');
begin
  select a.display_name into v_actor from coop_private.accounts a where a.user_id = v_uid and a.role = 'staff';
  if v_actor is null then
    raise exception 'Staff permission required' using errcode = '42501';
  end if;
  if p_request is null or p_product is null or p_kind is null or p_kind not in ('receipt', 'sale')
    or p_qty is null or p_qty not between 1 and 1000000
    or (p_kind = 'receipt' and v_note is null) or length(v_note) > 120 then
    raise exception 'Invalid stock movement' using errcode = '22023';
  end if;
  v_delta := case when p_kind = 'sale' then -p_qty else p_qty end;
  perform pg_advisory_xact_lock(hashtextextended(p_request::text, 0));
  select * into v_existing from coop_private.ledger where id = p_request;
  if found then
    if v_existing.actor_id = v_uid and v_existing.kind = p_kind and v_existing.product = p_product
      and v_existing.qty = v_delta and v_existing.note is not distinct from v_note then
      return p_request;
    end if;
    raise exception 'Duplicate transaction reference' using errcode = '23505';
  end if;

  select price, on_hand into v_price, v_on_hand
  from coop_private.products where id = p_product for update;
  if not found then
    raise exception 'Unknown product' using errcode = '22023';
  end if;
  if v_on_hand + v_delta < 0 then
    raise exception 'Insufficient stock' using errcode = '23514';
  end if;
  update coop_private.products set on_hand = on_hand + v_delta where id = p_product;
  insert into coop_private.ledger (id, kind, product, qty, amount, note, actor_id, actor)
  values (p_request, p_kind, p_product, v_delta,
    case when p_kind = 'sale' then p_qty::bigint * v_price end, v_note, v_uid, v_actor);
  return p_request;
end;
$$;

create function public.coop_snapshot() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coop_private.snapshot()
$$;
create function public.coop_post(p_request uuid, p_kind text, p_product uuid, p_qty integer, p_note text)
returns uuid language sql security invoker set search_path = '' as $$
  select coop_private.post(p_request, p_kind, p_product, p_qty, p_note)
$$;

revoke all on all tables in schema coop_private from public, anon, authenticated;
revoke all on all functions in schema coop_private from public, anon, authenticated;
revoke all on function public.coop_snapshot(), public.coop_post(uuid,text,uuid,integer,text) from public, anon, authenticated;
grant usage on schema coop_private to authenticated;
grant execute on function coop_private.snapshot(), coop_private.post(uuid,text,uuid,integer,text),
  public.coop_snapshot(), public.coop_post(uuid,text,uuid,integer,text) to authenticated;
commit;
