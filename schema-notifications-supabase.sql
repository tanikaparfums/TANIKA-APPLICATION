-- ═══════════════════════════════════════════════════════════
-- AJOUT — NOTIFICATIONS PUSH POUR L'OLFACTOTHÈQUE TANIKA
-- ═══════════════════════════════════════════════════════════
-- À exécuter dans le même SQL Editor Supabase, peut être
-- rejoué sans risque.
-- ═══════════════════════════════════════════════════════════

create table if not exists push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "Chacune gère ses propres abonnements" on push_subscriptions;
create policy "Chacune gère ses propres abonnements"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- FIN — la table est prête à recevoir les abonnements.
-- ═══════════════════════════════════════════════════════════
