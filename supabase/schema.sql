-- AI Messe Guide – Supabase-Schema
-- Ausführen im Supabase SQL-Editor (einmalig).
--
-- Sicherheitsmodell:
--  * Auth über Supabase (E-Mail + Passwort, MFA/TOTP in der App aktivierbar).
--  * app_state: eine JSONB-Zeile pro Nutzer, Row Level Security erzwingt,
--    dass jeder Nutzer ausschließlich seine eigene Zeile lesen/schreiben kann.
--  * delete_user(): DSGVO-Löschung (Art. 17) – entfernt Daten UND Auth-Konto
--    des aufrufenden Nutzers, ohne dass der Client einen Service-Key braucht.

create table if not exists public.app_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

create policy "Eigenen Zustand lesen"
  on public.app_state for select
  using (auth.uid() = user_id);

create policy "Eigenen Zustand anlegen"
  on public.app_state for insert
  with check (auth.uid() = user_id);

create policy "Eigenen Zustand ändern"
  on public.app_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Eigenen Zustand löschen"
  on public.app_state for delete
  using (auth.uid() = user_id);

-- DSGVO Art. 17: Selbstlöschung des Kontos inkl. aller Daten.
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.app_state where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_user() from public;
revoke execute on function public.delete_user() from anon; -- Supabase vergibt anon-Rechte per Default-Privileges
grant execute on function public.delete_user() to authenticated;

-- Empfohlene Projekt-Einstellungen (Dashboard):
--  * Authentication → E-Mail-Bestätigung aktiv lassen (Double-Opt-in).
--  * Authentication → MFA (TOTP) aktivieren.
--  * Auth → SMTP eigener Absender für DSGVO-konforme Mails (optional).
--
-- Ausbaustufe (geteilte Community-Daten über Nutzer hinweg):
-- eigene Tabellen für beitraege/nachrichten/mitfahrten/treffen mit RLS-Policies
-- pro Veranstaltung – bewusst noch nicht Teil dieser Version.
