-- הרצה חד-פעמית: Supabase Dashboard -> SQL Editor -> הדביקו והריצו.

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('hotel','transport','tickets','activity','note')),
  title text not null check (char_length(title) between 1 and 120),
  day text not null check (char_length(day) <= 20),
  day_end text check (day_end is null or char_length(day_end) <= 20),
  details text check (char_length(details) <= 240),
  price text check (char_length(price) <= 40),
  link text check (char_length(link) <= 500),
  added_by text check (char_length(added_by) <= 40),
  created_at timestamptz not null default now()
);

alter table public.items enable row level security;

-- כולם יכולים לקרוא (אין צורך בהתחברות)
create policy "items are publicly readable"
  on public.items for select
  using (true);

-- אף אחד לא כותב ישירות מהדפדפן — הכתיבה היחידה היא דרך ה-Edge Function
-- (שמשתמש במפתח service_role ועוקף RLS). אין כאן policy ל-insert בכוונה.

-- מחיקה מותרת לכל מי שמחובר (כולל anonymous auth) — כדי שכל אחד יוכל להסיר פריט
create policy "authenticated users can delete items"
  on public.items for delete
  using (auth.uid() is not null);

-- מאפשר real-time sync (INSERT/DELETE) לכל הצופים
alter publication supabase_realtime add table public.items;
