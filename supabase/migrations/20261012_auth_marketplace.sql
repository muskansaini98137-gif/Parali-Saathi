begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('farmer', 'organization', 'services')),
  full_name text,
  organization_name text,
  provider_name text,
  contact_person text,
  phone text,
  organization_type text,
  service_type text,
  address text,
  village text,
  district text,
  state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (role = 'farmer' and full_name is not null and phone is not null
      and village is not null and district is not null and state is not null)
    or (role = 'organization' and organization_name is not null
      and contact_person is not null and phone is not null
      and organization_type is not null and address is not null
      and village is not null and district is not null and state is not null)
    or (role = 'services' and provider_name is not null
      and contact_person is not null and phone is not null
      and service_type is not null and village is not null
      and district is not null and state is not null)
  )
);

create table if not exists public.parali_provider_directory (
  id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('organization', 'services')),
  display_name text not null,
  category text,
  village text,
  district text,
  state text,
  updated_at timestamptz not null default now()
);

create table if not exists public.parali_requests (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.profiles(id) on delete cascade,
  crop text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit text not null check (unit in ('quintal', 'tonne')),
  village text not null,
  district text not null,
  state text not null,
  pickup_location text not null,
  status text not null default 'open'
    check (status in ('open', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parali_organization_interests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.parali_requests(id) on delete cascade,
  organization_id uuid not null references public.profiles(id) on delete cascade,
  message text not null default '' check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  unique (request_id, organization_id)
);

create table if not exists public.parali_service_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.parali_requests(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  service_type text not null,
  message text not null default '' check (char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending', 'withdrawn')),
  created_at timestamptz not null default now(),
  unique (request_id, provider_id)
);

create index if not exists parali_requests_farmer_created_idx
  on public.parali_requests (farmer_id, created_at desc);
create index if not exists parali_requests_open_created_idx
  on public.parali_requests (status, created_at desc);
create index if not exists parali_interests_request_idx
  on public.parali_organization_interests (request_id);
create index if not exists parali_service_offers_request_idx
  on public.parali_service_offers (request_id);

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.profiles as profile
  where profile.id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.current_profile_role() from public, anon;
grant execute on function public.current_profile_role() to authenticated;

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'Profile role cannot be changed by the account owner';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_role text := new.raw_user_meta_data ->> 'role';
begin
  if signup_role is null or signup_role not in ('farmer', 'organization', 'services') then
    raise exception 'A valid Parali Saathi role is required';
  end if;

  if signup_role = 'farmer' and (
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'phone'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'village'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'district'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'state'), '') is null
  ) then
    raise exception 'Farmer profile fields are required';
  end if;

  if signup_role = 'organization' and (
    nullif(trim(new.raw_user_meta_data ->> 'organization_name'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'contact_person'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'phone'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'organization_type'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'address'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'village'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'district'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'state'), '') is null
  ) then
    raise exception 'Organization profile fields are required';
  end if;

  if signup_role = 'services' and (
    nullif(trim(new.raw_user_meta_data ->> 'provider_name'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'contact_person'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'phone'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'service_type'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'village'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'district'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'state'), '') is null
  ) then
    raise exception 'Service provider profile fields are required';
  end if;

  insert into public.profiles (
    id, email, role, full_name, organization_name, provider_name,
    contact_person, phone, organization_type, service_type, address,
    village, district, state
  ) values (
    new.id,
    new.email,
    signup_role,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'organization_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'provider_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'contact_person'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'organization_type'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'service_type'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'address'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'village'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'district'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'state'), '')
  );
  return new;
end;
$$;

create or replace function public.sync_provider_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'farmer' then
    delete from public.parali_provider_directory where id = new.id;
    return new;
  end if;

  insert into public.parali_provider_directory (
    id, role, display_name, category, village, district, state, updated_at
  ) values (
    new.id,
    new.role,
    case when new.role = 'organization'
      then coalesce(new.organization_name, 'Organization')
      else coalesce(new.provider_name, 'Service provider') end,
    case when new.role = 'organization'
      then new.organization_type else new.service_type end,
    new.village, new.district, new.state, now()
  )
  on conflict (id) do update set
    role = excluded.role,
    display_name = excluded.display_name,
    category = excluded.category,
    village = excluded.village,
    district = excluded.district,
    state = excluded.state,
    updated_at = now();
  return new;
end;
$$;

create or replace function public.touch_parali_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.prevent_profile_role_change() from public, anon, authenticated;
revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;
revoke all on function public.sync_provider_directory() from public, anon, authenticated;
revoke all on function public.touch_parali_request() from public, anon, authenticated;

drop trigger if exists parali_profile_role_guard on public.profiles;
create trigger parali_profile_role_guard
before update on public.profiles
for each row execute function public.prevent_profile_role_change();

drop trigger if exists parali_profile_directory_sync on public.profiles;
create trigger parali_profile_directory_sync
after insert or update of role, organization_name, provider_name,
  organization_type, service_type, village, district, state
on public.profiles
for each row execute function public.sync_provider_directory();

drop trigger if exists parali_auth_user_profile on auth.users;
create trigger parali_auth_user_profile
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

insert into public.profiles (
  id, email, role, full_name, organization_name, provider_name,
  contact_person, phone, organization_type, service_type, address,
  village, district, state
)
select
  account.id,
  account.email,
  account.raw_user_meta_data ->> 'role',
  nullif(trim(account.raw_user_meta_data ->> 'full_name'), ''),
  nullif(trim(account.raw_user_meta_data ->> 'organization_name'), ''),
  nullif(trim(account.raw_user_meta_data ->> 'provider_name'), ''),
  nullif(trim(account.raw_user_meta_data ->> 'contact_person'), ''),
  nullif(trim(account.raw_user_meta_data ->> 'phone'), ''),
  nullif(trim(account.raw_user_meta_data ->> 'organization_type'), ''),
  nullif(trim(account.raw_user_meta_data ->> 'service_type'), ''),
  nullif(trim(account.raw_user_meta_data ->> 'address'), ''),
  nullif(trim(account.raw_user_meta_data ->> 'village'), ''),
  nullif(trim(account.raw_user_meta_data ->> 'district'), ''),
  nullif(trim(account.raw_user_meta_data ->> 'state'), '')
from auth.users as account
where account.email is not null
  and account.raw_user_meta_data ->> 'role' in ('farmer', 'organization', 'services')
  and case account.raw_user_meta_data ->> 'role'
    when 'farmer' then
      nullif(trim(account.raw_user_meta_data ->> 'full_name'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'phone'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'village'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'district'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'state'), '') is not null
    when 'organization' then
      nullif(trim(account.raw_user_meta_data ->> 'organization_name'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'contact_person'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'phone'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'organization_type'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'address'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'village'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'district'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'state'), '') is not null
    when 'services' then
      nullif(trim(account.raw_user_meta_data ->> 'provider_name'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'contact_person'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'phone'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'service_type'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'village'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'district'), '') is not null
      and nullif(trim(account.raw_user_meta_data ->> 'state'), '') is not null
    else false
  end
on conflict (id) do nothing;

drop trigger if exists parali_request_updated_at on public.parali_requests;
create trigger parali_request_updated_at
before update on public.parali_requests
for each row execute function public.touch_parali_request();

alter table public.profiles enable row level security;
alter table public.parali_provider_directory enable row level security;
alter table public.parali_requests enable row level security;
alter table public.parali_organization_interests enable row level security;
alter table public.parali_service_offers enable row level security;

drop policy if exists "profile owner can read profile" on public.profiles;
create policy "profile owner can read profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

drop policy if exists "profile owner can update profile" on public.profiles;
create policy "profile owner can update profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "authenticated users can read provider directory" on public.parali_provider_directory;
create policy "authenticated users can read provider directory"
on public.parali_provider_directory for select to authenticated
using (true);

drop policy if exists "farmers and providers can read relevant requests" on public.parali_requests;
create policy "farmers and providers can read relevant requests"
on public.parali_requests for select to authenticated
using (
  farmer_id = (select auth.uid())
  or (status = 'open' and public.current_profile_role() in ('organization', 'services'))
);

drop policy if exists "farmers can create own requests" on public.parali_requests;
create policy "farmers can create own requests"
on public.parali_requests for insert to authenticated
with check (
  farmer_id = (select auth.uid())
  and public.current_profile_role() = 'farmer'
  and status = 'open'
);

drop policy if exists "farmers can update own requests" on public.parali_requests;
create policy "farmers can update own requests"
on public.parali_requests for update to authenticated
using (
  farmer_id = (select auth.uid())
  and public.current_profile_role() = 'farmer'
)
with check (
  farmer_id = (select auth.uid())
  and public.current_profile_role() = 'farmer'
  and status in ('open', 'cancelled')
);

drop policy if exists "organizations read related interest" on public.parali_organization_interests;
create policy "organizations read related interest"
on public.parali_organization_interests for select to authenticated
using (
  organization_id = (select auth.uid())
  or exists (
    select 1 from public.parali_requests as request
    where request.id = request_id and request.farmer_id = (select auth.uid())
  )
);

drop policy if exists "organizations express own interest" on public.parali_organization_interests;
create policy "organizations express own interest"
on public.parali_organization_interests for insert to authenticated
with check (
  organization_id = (select auth.uid())
  and public.current_profile_role() = 'organization'
  and exists (
    select 1 from public.parali_requests as request
    where request.id = request_id and request.status = 'open'
  )
);

drop policy if exists "providers read related service offers" on public.parali_service_offers;
create policy "providers read related service offers"
on public.parali_service_offers for select to authenticated
using (
  provider_id = (select auth.uid())
  or exists (
    select 1 from public.parali_requests as request
    where request.id = request_id and request.farmer_id = (select auth.uid())
  )
);

drop policy if exists "service providers offer on open requests" on public.parali_service_offers;
create policy "service providers offer on open requests"
on public.parali_service_offers for insert to authenticated
with check (
  provider_id = (select auth.uid())
  and public.current_profile_role() = 'services'
  and exists (
    select 1 from public.parali_requests as request
    where request.id = request_id and request.status = 'open'
  )
);

drop policy if exists "service providers update own offers" on public.parali_service_offers;
create policy "service providers update own offers"
on public.parali_service_offers for update to authenticated
using (
  provider_id = (select auth.uid())
  and public.current_profile_role() = 'services'
)
with check (
  provider_id = (select auth.uid())
  and public.current_profile_role() = 'services'
  and status in ('pending', 'withdrawn')
);

revoke all on public.profiles,
  public.parali_provider_directory,
  public.parali_requests,
  public.parali_organization_interests,
  public.parali_service_offers
from anon, authenticated;

grant select on public.profiles to authenticated;
grant usage on schema public to authenticated;
grant update (
  full_name, organization_name, provider_name, contact_person, phone,
  organization_type, service_type, address, village, district, state
) on public.profiles to authenticated;

grant select on public.parali_provider_directory to authenticated;
grant select, insert on public.parali_requests to authenticated;
grant update (crop, quantity, unit, village, district, state, pickup_location, status)
  on public.parali_requests to authenticated;
grant select, insert on public.parali_organization_interests to authenticated;
grant select, insert on public.parali_service_offers to authenticated;
grant update (status) on public.parali_service_offers to authenticated;

commit;