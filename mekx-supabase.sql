-- MEKX: إعداد المزامنة في Supabase
-- التنفيذ: Supabase Dashboard > SQL Editor > الصق السكربت كاملاً > Run

create table if not exists public.mekx_records (
  store   text        not null,            -- نوع السجل: sales, products, stockMoves ...
  id      text        not null,            -- معرّف السجل
  data    jsonb       not null,            -- محتوى السجل
  device  text,                            -- الجهاز الذي أرسله
  srv_ts  timestamptz not null default now(),
  primary key (store, id)
);

create index if not exists mekx_records_srv_ts_idx on public.mekx_records (srv_ts);

-- ختم زمني من الخادم عند كل إدخال أو تعديل (يعتمد عليه السحب التزايدي)
create or replace function public.mekx_touch() returns trigger as $$
begin
  new.srv_ts := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists mekx_touch_t on public.mekx_records;
create trigger mekx_touch_t before insert or update on public.mekx_records
  for each row execute function public.mekx_touch();

-- الأمان: لا يقرأ ولا يكتب إلا المستخدم المسجّل دخوله
alter table public.mekx_records enable row level security;

drop policy if exists "mekx authenticated" on public.mekx_records;
create policy "mekx authenticated" on public.mekx_records
  for all to authenticated using (true) with check (true);

-- بعد التنفيذ:
-- 1) Authentication > Users > Add user: أنشئ مستخدماً واحداً للمحل (بريد + كلمة مرور) مع تفعيل Auto Confirm.
-- 2) Project Settings > API: انسخ Project URL و anon public key.
-- 3) في كل جهاز: الإدارة > الإعدادات > المزامنة بين الأجهزة، بالبريد وكلمة المرور نفسيهما ورقم جهاز مختلف.
