-- ============================================================================
-- 0005_seed_data.sql
-- Données de démarrage : catégories, carte, 10 tables, paramètres du resto.
-- (Les comptes du personnel ne sont PAS créés ici — ils passent par
-- Supabase Auth + l'Edge Function create-staff-user, voir README.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CATÉGORIES
-- ----------------------------------------------------------------------------

insert into public.categories (name, sort_order) values
  ('Entrées', 1),
  ('Salades', 2),
  ('Sandwichs', 3),
  ('Pizza', 4),
  ('Grillades', 5),
  ('Pâtes', 6),
  ('Burgers', 7),
  ('Couscous', 8),
  ('Tajines', 9),
  ('Desserts', 10),
  ('Glaces', 11),
  ('Boissons chaudes', 12),
  ('Boissons froides', 13),
  ('Cocktails', 14),
  ('Chicha', 15);

-- ----------------------------------------------------------------------------
-- CARTE (menu_items) — reliés aux catégories par leur nom.
-- ----------------------------------------------------------------------------

insert into public.menu_items (category_id, name, description, price, images, prep_time_minutes, is_available, stock_quantity, is_promo, promo_price, is_recommended, is_spicy, allergens)
select c.id, v.name, v.description, v.price, v.images, v.prep_time_minutes, true, v.stock_quantity, v.is_promo, v.promo_price, v.is_recommended, v.is_spicy, v.allergens
from (values
  ('Entrées', 'Tapas Assortis Gourmands', 'Croquettes au fromage, calamars croustillants, calamares a la romana et sauces maison.', 850::numeric, array['https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=800&q=80','https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800&q=80'], 10, 25, false, null::numeric, true, false, array['Gluten','Poisson','Lait']),
  ('Salades', 'Salade César au Poulet Crispy', 'Poulet croustillant, salade romaine, parmesan affiné, croutons ail & herbes et sauce César crémeuse.', 950, array['https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80'], 12, 18, true, 800, false, false, array['Gluten','Lait','Œufs']),
  ('Burgers', 'Smash Burger Double Cheddar', 'Deux steaks de bœuf haché frais, cheddar fondu, oignons caramélisés, cornichons et sauce artisanale.', 1200, array['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80','https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=800&q=80'], 15, 30, false, null, true, false, array['Gluten','Lait','Sésame']),
  ('Burgers', 'Burger Spicy Diablo', 'Steak de bœuf, jalapeños grillés, pepper jack, sauce pimentée chipotle et oignons croustillants.', 1300, array['https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=800&q=80'], 15, 15, false, null, false, true, array['Gluten','Lait']),
  ('Pizza', 'Pizza Truffe & Burrata', 'Sauce crème à la truffe, mozzarella fior di latte, burrata fraîche 125g, roquette et huile de truffe.', 1500, array['https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80'], 14, 20, false, null, true, false, array['Gluten','Lait']),
  ('Pizza', 'Pizza Quattro Formaggi', 'Mozzarella, gorgonzola AOP, taleggio, parmesan râpé et filet de miel sauvage.', 1200, array['https://images.unsplash.com/photo-1573821663912-569905455b1c?auto=format&fit=crop&w=800&q=80'], 14, 25, false, null, false, false, array['Gluten','Lait']),
  ('Tajines', 'Tajine d''Agneau aux Pruneaux & Amandes', 'Agneau fondant mijoté aux épices orientales, pruneaux caramélisés, amandes torréfiées et sésame.', 1800, array['https://images.unsplash.com/photo-1541518763669-27fef04b14da?auto=format&fit=crop&w=800&q=80'], 20, 12, false, null, true, false, array['Fruits à coque','Sésame']),
  ('Grillades', 'Mixed Grill Royale', 'Brochettes d''agneau, kfta épicée, filet de poulet mariné au citron, servies avec frites fraîches et riz.', 2200, array['https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80'], 18, 15, false, null, false, true, array[]::text[]),
  ('Desserts', 'Fondant au Chocolat Coeur Coulant', 'Servi chaud avec une boule de glace vanille de Madagascar et coulis de fruits rouges.', 550, array['https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80'], 8, 20, false, null, false, false, array['Gluten','Lait','Œufs']),
  ('Cocktails', 'Mojito Passion Signature', 'Rhum blanc, fruit de la passion frais, menthe fraîche pilée, citron vert et eau gazeuse.', 600, array['https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80'], 5, 50, false, null, true, false, array[]::text[]),
  ('Cocktails', 'Pina Colada Royale', 'Rhum, crème de coco, jus d''ananas frais infusé à la vanille.', 650, array['https://images.unsplash.com/photo-1546171753-97d7676e4602?auto=format&fit=crop&w=800&q=80'], 5, 40, false, null, false, false, array['Lait']),
  ('Chicha', 'Chicha Premium Special Blend', 'Chicha haute qualité avec foyer au choix : Menthe Intense, Double Pomme, Love 66 ou Mangue glacée.', 2000, array['https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80'], 10, 15, false, null, false, false, array[]::text[]),
  ('Boissons froides', 'Limonade Maison Menthe & Gingembre', 'Jus de citron pressé à la minute, menthe fraîche et touche de gingembre doux.', 350, array['https://images.unsplash.com/photo-1523371054106-bbf80586c38c?auto=format&fit=crop&w=800&q=80'], 4, 60, false, null, false, false, array[]::text[]),
  ('Boissons froides', 'Bière Pression Fraîche (50cl)', 'Bière pression fraîche servie glacée.', 400, array['https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=800&q=80'], 2, 100, false, null, false, false, array['Gluten']),
  ('Boissons chaudes', 'Café Expresso / Capuccino', 'Café fraîchement moulu ou cappuccino onctueux.', 150, array['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80'], 3, 80, false, null, false, false, array['Lait'])
) as v(category_name, name, description, price, images, prep_time_minutes, stock_quantity, is_promo, promo_price, is_recommended, is_spicy, allergens)
join public.categories c on c.name = v.category_name;

-- ----------------------------------------------------------------------------
-- 10 TABLES (mêmes codes PIN que la démo d'origine)
-- ----------------------------------------------------------------------------

insert into public.restaurant_tables (id, number, name, status, seats, access_code) values
  (1, 1, 'Table 1', 'libre', 4, '1234'),
  (2, 2, 'Table 2', 'libre', 2, '2345'),
  (3, 3, 'Table 3', 'libre', 4, '3456'),
  (4, 4, 'Table 4', 'libre', 2, '4567'),
  (5, 5, 'Table 5', 'libre', 4, '5678'),
  (6, 6, 'Table 6', 'libre', 2, '6789'),
  (7, 7, 'Table 7', 'libre', 4, '7890'),
  (8, 8, 'Table 8', 'libre', 2, '8901'),
  (9, 9, 'Table 9', 'libre', 4, '9012'),
  (10, 10, 'Table 10', 'libre', 2, '4821');

-- ----------------------------------------------------------------------------
-- PARAMÈTRES DU RESTAURANT (met à jour la ligne unique créée en 0001)
-- ----------------------------------------------------------------------------

update public.restaurant_settings set
  name = 'Le Lounge GastroBar & Resto',
  logo = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=150&q=80',
  address = '12 Rue Didouche Mourad, Alger',
  phone = '+213 21 60 70 80',
  email = 'contact@lelounge-resto.dz',
  opening_hours = '11:00 - 02:00 (7j/7)',
  currency = 'DA',
  vat_rate = 0,
  service_rate = 0
where id = true;
