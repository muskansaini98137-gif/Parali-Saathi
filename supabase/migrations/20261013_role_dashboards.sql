begin;

alter table public.parali_requests
  add column if not exists expected_price numeric(12, 2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'parali_requests_expected_price_check'
      and conrelid = 'public.parali_requests'::regclass
  ) then
    alter table public.parali_requests
      add constraint parali_requests_expected_price_check
      check (expected_price is null or expected_price >= 0);
  end if;
end;
$$;

alter table public.parali_organization_interests
  add column if not exists status text not null default 'pending',
  add column if not exists proposed_price numeric(12, 2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'parali_organization_interests_status_check'
      and conrelid = 'public.parali_organization_interests'::regclass
  ) then
    alter table public.parali_organization_interests
      add constraint parali_organization_interests_status_check
      check (status in ('pending', 'accepted', 'rejected', 'completed', 'cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'parali_organization_interests_price_check'
      and conrelid = 'public.parali_organization_interests'::regclass
  ) then
    alter table public.parali_organization_interests
      add constraint parali_organization_interests_price_check
      check (proposed_price is null or proposed_price >= 0);
  end if;
end;
$$;

create table if not exists public.service_offerings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  service_area text not null check (char_length(trim(service_area)) between 2 and 160),
  price numeric(12, 2) check (price is null or price >= 0),
  pricing_unit text not null default 'per trip'
    check (pricing_unit in ('per trip', 'per hour', 'per acre', 'per tonne', 'quote')),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 24),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  parali_request_id uuid not null references public.parali_requests(id) on delete cascade,
  offering_id uuid not null references public.service_offerings(id) on delete restrict,
  farmer_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (
    status in ('accepted', 'declined', 'in_progress', 'completed', 'cancelled')
  ),
  message text not null default '' check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parali_request_id, provider_id)
);

create index if not exists service_offerings_active_idx
  on public.service_offerings (is_active, created_at desc);
create index if not exists service_offerings_provider_idx
  on public.service_offerings (provider_id, created_at desc);
create index if not exists service_requests_provider_idx
  on public.service_requests (provider_id, status, created_at desc);
create index if not exists service_requests_farmer_idx
  on public.service_requests (farmer_id, created_at desc);
create unique index if not exists service_requests_one_active_provider_idx
  on public.service_requests (parali_request_id)
  where status in ('accepted', 'in_progress', 'completed');

create or replace function public.parali_request_has_service_assignment(request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.service_requests as service_request
    where service_request.parali_request_id = request_id
      and service_request.status in ('accepted', 'in_progress', 'completed')
  );
$$;

revoke all on function public.parali_request_has_service_assignment(uuid) from public, anon;
grant execute on function public.parali_request_has_service_assignment(uuid) to authenticated;

create or replace function public.guard_organization_interest_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text := public.current_profile_role();
  request_farmer uuid;
begin
  if tg_op = 'INSERT' then
    if actor_role <> 'organization'
      or new.organization_id <> (select auth.uid())
      or new.status <> 'pending'
    then
      raise exception 'Organizations may only create their own pending requests';
    end if;
    return new;
  end if;

  if new.request_id is distinct from old.request_id
    or new.organization_id is distinct from old.organization_id
  then
    raise exception 'Organization request ownership cannot be changed';
  end if;

  if actor_role = 'organization'
    and old.organization_id = (select auth.uid())
    and old.status = 'pending'
    and new.status = 'cancelled'
  then
    return new;
  end if;

  select request.farmer_id into request_farmer
  from public.parali_requests as request
  where request.id = old.request_id;

  if actor_role = 'farmer'
    and request_farmer = (select auth.uid())
    and ((old.status = 'pending' and new.status in ('accepted', 'rejected'))
      or (old.status = 'accepted' and new.status = 'completed'))
  then
    return new;
  end if;

  raise exception 'This organization request status transition is not allowed';
end;
$$;

create or replace function public.guard_service_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text := public.current_profile_role();
  request_farmer uuid;
  offering_provider uuid;
  offering_active boolean;
begin
  if tg_op = 'INSERT' then
    select request.farmer_id into request_farmer
    from public.parali_requests as request
    where request.id = new.parali_request_id
      and request.status = 'open';

    select offering.provider_id, offering.is_active
      into offering_provider, offering_active
    from public.service_offerings as offering
    where offering.id = new.offering_id;

    if actor_role <> 'services'
      or new.provider_id <> (select auth.uid())
      or new.status not in ('accepted', 'declined')
      or request_farmer is null
      or request_farmer <> new.farmer_id
      or offering_provider <> new.provider_id
      or offering_active is distinct from true
    then
      raise exception 'This service request is not eligible for this provider';
    end if;
    return new;
  end if;

  if new.parali_request_id is distinct from old.parali_request_id
    or new.offering_id is distinct from old.offering_id
    or new.farmer_id is distinct from old.farmer_id
    or new.provider_id is distinct from old.provider_id
  then
    raise exception 'Service request ownership cannot be changed';
  end if;

  if actor_role = 'services'
    and old.provider_id = (select auth.uid())
    and ((old.status = 'accepted' and new.status in ('in_progress', 'cancelled'))
      or (old.status = 'in_progress' and new.status = 'completed')
      or (old.status = 'declined' and new.status = 'accepted'))
  then
    return new;
  end if;

  raise exception 'This service request status transition is not allowed';
end;
$$;

create or replace function public.touch_service_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.guard_organization_interest_status() from public, anon, authenticated;
revoke all on function public.guard_service_request() from public, anon, authenticated;
revoke all on function public.touch_service_updated_at() from public, anon, authenticated;

drop trigger if exists organization_interest_status_guard on public.parali_organization_interests;
create trigger organization_interest_status_guard
before insert or update on public.parali_organization_interests
for each row execute function public.guard_organization_interest_status();

drop trigger if exists service_request_status_guard on public.service_requests;
create trigger service_request_status_guard
before insert or update on public.service_requests
for each row execute function public.guard_service_request();

drop trigger if exists service_offering_updated_at on public.service_offerings;
create trigger service_offering_updated_at
before update on public.service_offerings
for each row execute function public.touch_service_updated_at();

drop trigger if exists service_request_updated_at on public.service_requests;
create trigger service_request_updated_at
before update on public.service_requests
for each row execute function public.touch_service_updated_at();

alter table public.service_offerings enable row level security;
alter table public.service_requests enable row level security;

drop policy if exists "organizations read related interest" on public.parali_organization_interests;
create policy "organizations and farmers read related interest"
on public.parali_organization_interests for select to authenticated
using (
  organization_id = (select auth.uid())
  or exists (
    select 1 from public.parali_requests as request
    where request.id = request_id
      and request.farmer_id = (select auth.uid())
  )
);

drop policy if exists "organizations express own interest" on public.parali_organization_interests;
create policy "organizations create own pending interest"
on public.parali_organization_interests for insert to authenticated
with check (
  organization_id = (select auth.uid())
  and public.current_profile_role() = 'organization'
  and status = 'pending'
  and exists (
    select 1 from public.parali_requests as request
    where request.id = request_id and request.status = 'open'
  )
);

drop policy if exists "organizations cancel own pending interest" on public.parali_organization_interests;
create policy "organizations cancel own pending interest"
on public.parali_organization_interests for update to authenticated
using (
  organization_id = (select auth.uid())
  and public.current_profile_role() = 'organization'
  and status = 'pending'
)
with check (
  organization_id = (select auth.uid())
  and public.current_profile_role() = 'organization'
  and status = 'cancelled'
);

drop policy if exists "farmers respond to organization interest" on public.parali_organization_interests;
create policy "farmers respond to organization interest"
on public.parali_organization_interests for update to authenticated
using (
  public.current_profile_role() = 'farmer'
  and exists (
    select 1 from public.parali_requests as request
    where request.id = request_id and request.farmer_id = (select auth.uid())
  )
)
with check (
  public.current_profile_role() = 'farmer'
  and status in ('accepted', 'rejected', 'completed')
  and exists (
    select 1 from public.parali_requests as request
    where request.id = request_id and request.farmer_id = (select auth.uid())
  )
);

drop policy if exists "authenticated users read active service offerings" on public.service_offerings;
create policy "authenticated users read active service offerings"
on public.service_offerings for select to authenticated
using (is_active or provider_id = (select auth.uid()));

drop policy if exists "providers create own service offerings" on public.service_offerings;
create policy "providers create own service offerings"
on public.service_offerings for insert to authenticated
with check (
  provider_id = (select auth.uid())
  and public.current_profile_role() = 'services'
);

drop policy if exists "providers update own service offerings" on public.service_offerings;
create policy "providers update own service offerings"
on public.service_offerings for update to authenticated
using (
  provider_id = (select auth.uid())
  and public.current_profile_role() = 'services'
)
with check (
  provider_id = (select auth.uid())
  and public.current_profile_role() = 'services'
);

drop policy if exists "providers delete own service offerings" on public.service_offerings;
create policy "providers delete own service offerings"
on public.service_offerings for delete to authenticated
using (
  provider_id = (select auth.uid())
  and public.current_profile_role() = 'services'
);

drop policy if exists "farmers and providers read related service requests" on public.service_requests;
create policy "farmers and providers read related service requests"
on public.service_requests for select to authenticated
using (
  provider_id = (select auth.uid())
  or farmer_id = (select auth.uid())
);

drop policy if exists "providers respond to open service requests" on public.service_requests;
create policy "providers respond to open service requests"
on public.service_requests for insert to authenticated
with check (
  provider_id = (select auth.uid())
  and public.current_profile_role() = 'services'
  and status in ('accepted', 'declined')
  and exists (
    select 1 from public.parali_requests as request
    where request.id = parali_request_id
      and request.farmer_id = farmer_id
      and request.status = 'open'
  )
  and exists (
    select 1 from public.service_offerings as offering
    where offering.id = offering_id
      and offering.provider_id = (select auth.uid())
      and offering.is_active
  )
);

drop policy if exists "providers update own service assignments" on public.service_requests;
create policy "providers update own service assignments"
on public.service_requests for update to authenticated
using (
  provider_id = (select auth.uid())
  and public.current_profile_role() = 'services'
)
with check (
  provider_id = (select auth.uid())
  and public.current_profile_role() = 'services'
  and status in ('accepted', 'declined', 'in_progress', 'completed', 'cancelled')
);

drop policy if exists "farmers and providers read relevant requests" on public.parali_requests;
create policy "farmers and providers read relevant requests"
on public.parali_requests for select to authenticated
using (
  farmer_id = (select auth.uid())
  or (status = 'open' and public.current_profile_role() = 'organization')
  or (
    status = 'open'
    and public.current_profile_role() = 'services'
    and not public.parali_request_has_service_assignment(id)
  )
  or exists (
    select 1 from public.service_requests as service_request
    where service_request.parali_request_id = id
      and service_request.provider_id = (select auth.uid())
  )
);

drop policy if exists "farmers and providers read relevant requests" on public.parali_requests;
create policy "farmers and providers read relevant requests"
on public.parali_requests for select to authenticated
using (
  farmer_id = (select auth.uid())
  or (
    status = 'open'
    and (
      public.current_profile_role() = 'organization'
      or (
        public.current_profile_role() = 'services'
        and not public.parali_request_has_service_assignment(id)
      )
    )
  )
  or exists (
    select 1 from public.service_requests as service_request
    where service_request.parali_request_id = id
      and service_request.provider_id = (select auth.uid())
  )
);

drop policy if exists "service providers can read assigned farmer contact" on public.profiles;
create policy "service providers can read assigned farmer contact"
on public.profiles for select to authenticated
using (
  role = 'farmer'
  and exists (
    select 1 from public.service_requests as service_request
    where service_request.farmer_id = profiles.id
      and service_request.provider_id = (select auth.uid())
      and service_request.status in ('accepted', 'in_progress', 'completed')
  )
);

drop policy if exists "organizations can read accepted farmer contact" on public.profiles;
create policy "organizations can read accepted farmer contact"
on public.profiles for select to authenticated
using (
  role = 'farmer'
  and exists (
    select 1
    from public.parali_organization_interests as interest
    join public.parali_requests as request on request.id = interest.request_id
    where request.farmer_id = profiles.id
      and interest.organization_id = (select auth.uid())
      and interest.status in ('accepted', 'completed')
  )
);

revoke all on public.parali_organization_interests,
  public.service_offerings,
  public.service_requests
from anon, authenticated;

grant select on public.parali_organization_interests to authenticated;
grant insert (request_id, organization_id, message, proposed_price)
  on public.parali_organization_interests to authenticated;
grant update (status, proposed_price)
  on public.parali_organization_interests to authenticated;
grant update (expected_price) on public.parali_requests to authenticated;

grant select on public.service_offerings to authenticated;
grant insert (
  provider_id, name, description, service_area, price, pricing_unit, contact_phone, is_active
) on public.service_offerings to authenticated;
grant update (
  name, description, service_area, price, pricing_unit, contact_phone, is_active
) on public.service_offerings to authenticated;
grant delete on public.service_offerings to authenticated;

grant select on public.service_requests to authenticated;
grant insert (
  parali_request_id, offering_id, farmer_id, provider_id, status, message
) on public.service_requests to authenticated;
grant update (status) on public.service_requests to authenticated;

commit;