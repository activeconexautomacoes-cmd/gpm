-- Enable pgcrypto for encryption if not already enabled
create extension if not exists "pgcrypto";

-- Create integrations table for storing OAuth tokens
create table if not exists public.integrations (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    provider text not null check (provider in ('google')),
    access_token text not null,
    refresh_token text, -- Can be encrypted
    expires_at timestamptz not null,
    email text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    
    constraint integrations_pkey primary key (id),
    constraint integrations_user_provider_unique unique (user_id, provider)
);

-- RLS for integrations
alter table public.integrations enable row level security;

create policy "Users can view their own integrations"
    on public.integrations for select
    using (auth.uid() = user_id);

create policy "Users can insert their own integrations"
    on public.integrations for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own integrations"
    on public.integrations for update
    using (auth.uid() = user_id);

create policy "Users can delete their own integrations"
    on public.integrations for delete
    using (auth.uid() = user_id);


-- Create availability_schedules table
create table if not exists public.availability_schedules (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    day_of_week integer not null check (day_of_week between 0 and 6), -- 0=Sunday, 6=Saturday
    start_time time not null,
    end_time time not null check (end_time > start_time),
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    
    constraint availability_schedules_pkey primary key (id),
    constraint availability_user_day_unique unique (user_id, day_of_week)
);

-- RLS for availability_schedules
alter table public.availability_schedules enable row level security;

create policy "Users can view their own availability"
    on public.availability_schedules for select
    using (auth.uid() = user_id);

create policy "Users can insert their own availability"
    on public.availability_schedules for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own availability"
    on public.availability_schedules for update
    using (auth.uid() = user_id);

create policy "Users can delete their own availability"
    on public.availability_schedules for delete
    using (auth.uid() = user_id);

-- Also allow public read access for availability (needed for the quiz scheduler functionality without authenticating as the user)
-- Ideally this should be restricted, but for the scheduler to work for anonymous leads, we might need a function or public read.
-- For now, let's keep it restricted and use a secure Edge Function with Service Role to fetch this data.


-- Create bookings table
create table if not exists public.bookings (
    id uuid not null default gen_random_uuid(),
    opportunity_id uuid references public.opportunities(id) on delete set null,
    closer_id uuid references auth.users(id) on delete set null,
    google_event_id text,
    meeting_link text,
    start_time timestamptz not null,
    end_time timestamptz not null check (end_time > start_time),
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    
    constraint bookings_pkey primary key (id)
);

-- RLS for bookings
alter table public.bookings enable row level security;

create policy "Users can view bookings assigned to them or in their workspace"
    on public.bookings for select
    using (
        auth.uid() = closer_id 
        or 
        exists (
            select 1 from public.opportunities o 
            where o.id = bookings.opportunity_id 
            and o.workspace_id in (
                select workspace_id from public.workspace_members where user_id = auth.uid()
            )
        )
    );

create policy "Users can insert bookings"
    on public.bookings for insert
    with check (
        -- Basic check, ensuring closer_id refers to a valid user if provided
        true
    );

create policy "Users can update bookings"
    on public.bookings for update
    using (
        auth.uid() = closer_id 
        or 
        exists (
            select 1 from public.opportunities o 
            where o.id = bookings.opportunity_id 
            and o.workspace_id in (
                select workspace_id from public.workspace_members where user_id = auth.uid()
            )
        )
    );
