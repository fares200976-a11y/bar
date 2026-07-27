-- ============================================================================
-- 0011_menu_dietary_labels.sql
-- Ajoute des labels diététiques positifs (Végétarien, Vegan, Fait Maison...)
-- séparés des allergènes (qui restent une liste à éviter).
-- ============================================================================

alter table public.menu_items add column dietary_labels text[] not null default '{}';
