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

-- אף אחד לא כותב/מוחק/מעדכן ישירות מהדפדפן — insert/delete/update עוברים דרך
-- Edge Functions (add-item, delete-item, update-item) שמשתמשות במפתח service_role
-- ועוקפות RLS. בכוונה אין כאן שום policy לכתיבה: PostgreSQL ללא policy = חסום.
-- (בעבר הייתה כאן policy למחיקה ישירה "auth.uid() is not null" בלי סינון שורה —
-- זה איפשר בקשת DELETE אחת בלי WHERE למחוק את *כל* הטבלה בבת אחת. delete-item
-- סוגר את זה: תמיד מוחקת שורה בודדת לפי id, אין דרך למחיקה גורפת מבחוץ.)

-- מאפשר real-time sync (INSERT/UPDATE/DELETE) לכל הצופים
alter publication supabase_realtime add table public.items;

-- צ'קליסט "מה להזמין" (t1..t16) משותף לכולם: מי שמסמן, מסומן אצל כולם.
-- (רשימת האריזה p1..p8 נשארת אישית בכוונה — כל אחד אורז את התיק של עצמו —
-- ולכן ממשיכה להישמר רק ב-localStorage בקובץ app.js, בלי טבלה כאן.)
create table if not exists public.checklist (
  task_id text primary key check (task_id ~ '^t[0-9]+$'),
  checked boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.checklist enable row level security;

create policy "checklist is publicly readable"
  on public.checklist for select
  using (true);

create policy "authenticated users can insert checklist rows"
  on public.checklist for insert
  with check (auth.uid() is not null);

create policy "authenticated users can update checklist rows"
  on public.checklist for update
  using (auth.uid() is not null);

alter publication supabase_realtime add table public.checklist;

-- מונה קצב לפונקציות שקוראות ל-Claude (add-item/extract-item/update-item), כדי שאף
-- אחד לא יוכל להריץ עליהן לולאה ולנפח את חשבון ה-API. RLS מופעל ובכוונה בלי אף policy —
-- הטבלה נגישה רק ל-service_role (בתוך ה-Edge Functions), אף פעם לא ישירות מהדפדפן.
create table if not exists public.rate_limits (
  bucket_key text primary key,
  count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
