import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Flame,
  Star,
  Clock,
  Plus,
  Minus,
  ShoppingCart,
  Bell,
  Receipt,
  Check,
  Info,
  X,
  Play,
  AlertCircle,
  Tag,
  Sparkles,
  ShieldCheck,
  QrCode,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Category, MenuItem, Order, Table, Waiter, RestaurantSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface ClientMenuViewProps {
  table: Table;
  categories: Category[];
  menu: MenuItem[];
  activeOrder?: Order;
  waiter?: Waiter;
  settings: RestaurantSettings;
  onAddToCart: (item: MenuItem, quantity: number, notes?: string) => void;
  onCallWaiter: () => void;
  onRequestBill: () => void;
  onOpenCart: () => void;
  onOpenStatusModal: () => void;
  cartItemCount: number;
  cartTotal: number;
}

export const ClientMenuView: React.FC<ClientMenuViewProps> = ({
  table,
  categories,
  menu,
  activeOrder,
  waiter,
  settings,
  onAddToCart,
  onCallWaiter,
  onRequestBill,
  onOpenCart,
  onOpenStatusModal,
  cartItemCount,
  cartTotal,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [activeSection, setActiveSection] = useState<'food' | 'bar'>('food');
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const scrollCategories = (dir: 'left' | 'right') => {
    categoryScrollRef.current?.scrollBy({ left: dir === 'left' ? -220 : 220, behavior: 'smooth' });
  };
  const sectionCategories = categories.filter((c) => (c.section || 'food') === activeSection);
  const categorySectionById = new Map(categories.map((c) => [c.id, c.section || 'food']));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState('');
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [callSent, setCallSent] = useState(false);
  const [billSent, setBillSent] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeDietaryLabels, setActiveDietaryLabels] = useState<string[]>([]);
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([]);

  // La vérification du code à 4 chiffres se fait désormais sur la page d'accueil
  // (voir ClientLandingGate dans App.tsx) avant même que ce composant ne soit
  // affiché. On ne fait ici que relire le statut de la table par sécurité
  // (défense en profondeur) — jamais 'libre' à ce stade normalement.
  const isTableVerified = table.status !== 'libre';
  const isPickup = table.id === 999;
  const [lang, setLang] = useState<'fr' | 'en'>('fr');

  const t = (item: MenuItem, field: 'name' | 'description') => {
    const translated = item.translations?.[lang]?.[field];
    return translated && translated.trim().length > 0 ? translated : item[field];
  };

  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  useEffect(() => {
    if (settings.latitude == null || settings.longitude == null) return;
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${settings.latitude}&longitude=${settings.longitude}&current=temperature_2m,weather_code`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data?.current) {
          setWeather({ temp: Math.round(data.current.temperature_2m), code: data.current.weather_code });
        }
      })
      .catch(() => {});
  }, [settings.latitude, settings.longitude]);

  const weatherEmoji = (code: number) => {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌦️';
    return '⛈️';
  };

  // Labels et allergènes réellement présents sur la carte (pas de liste figée
  // qui afficherait des filtres vides si le restaurant ne les utilise pas).
  const availableDietaryLabels = Array.from(
    new Set(menu.flatMap((item) => item.dietaryLabels || []))
  ).sort();
  const availableAllergens = Array.from(new Set(menu.flatMap((item) => item.allergens))).sort();

  // Filter menu
  const filteredMenu = menu.filter((item) => {
    const matchesSection = categorySectionById.get(item.categoryId) === activeSection;
    const matchesCategory = selectedCategoryId === 'all' || item.categoryId === selectedCategoryId;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDietary =
      activeDietaryLabels.length === 0 ||
      activeDietaryLabels.every((label) => (item.dietaryLabels || []).includes(label));
    const matchesAllergens =
      excludedAllergens.length === 0 || !excludedAllergens.some((alg) => item.allergens.includes(alg));
    return matchesSection && matchesCategory && matchesSearch && matchesDietary && matchesAllergens;
  });

  const activeFilterCount = activeDietaryLabels.length + excludedAllergens.length;

  const handleCallWaiterClick = () => {
    if (!isTableVerified) return;
    onCallWaiter();
    setCallSent(true);
    setTimeout(() => setCallSent(false), 4000);
  };

  const handleRequestBillClick = () => {
    if (!isTableVerified) return;
    onRequestBill();
    setBillSent(true);
    setTimeout(() => setBillSent(false), 4000);
  };

  const openItemDetailModal = (item: MenuItem) => {
    setSelectedMenuItem(item);
    setItemQuantity(1);
    setItemNotes('');
    setActiveImageIdx(0);
  };

  // Confirmation state before adding item to cart
  const [showConfirmAdd, setShowConfirmAdd] = useState(false);

  const handleAddFromModal = () => {
    if (selectedMenuItem && isTableVerified) {
      setShowConfirmAdd(true);
    }
  };

  const handleFinalConfirmAdd = () => {
    if (selectedMenuItem) {
      onAddToCart(selectedMenuItem, itemQuantity, itemNotes);
      setSelectedMenuItem(null);
      setShowConfirmAdd(false);
    }
  };

  return (
    <div className="pb-28 pt-2">
      {/* Table Welcome Banner */}
      <div className="bg-[#5A5A40] rounded-3xl p-6 text-[#F5F2ED] shadow-md mb-6 relative overflow-hidden border border-[#484833]">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-medium tracking-wide uppercase mb-2 text-[#E2E0D8]">
              <Sparkles className="w-3.5 h-3.5 text-[#E0B580]" />
              <span>{isPickup ? 'Click & Collect' : `Commande Directe • Table ${table.number}`}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-normal tracking-wide">
              {isPickup ? 'Commande à Emporter' : `Bienvenue à la Table ${table.number}`}
            </h2>
            <p className="text-[#D1CECB] text-xs sm:text-sm mt-1 max-w-lg font-light">
              {isPickup
                ? 'Composez votre commande, elle sera prête à récupérer sur place.'
                : 'Découvrez notre carte gastronomique. Vos plats et rafraîchissements seront préparés à la commande.'}
            </p>

            {waiter && !isPickup && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                <img
                  src={waiter.photo}
                  alt={waiter.name}
                  className="w-7 h-7 rounded-full object-cover border border-white/30"
                />
                <p className="text-xs text-[#E2E0D8]">
                  Votre serveur dédié : <span className="font-semibold text-white">{waiter.name}</span>
                </p>
              </div>
            )}
          </div>

          {/* Table Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {weather && (
              <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-white">
                <span>{weatherEmoji(weather.code)}</span>
                <span>{weather.temp}°C</span>
              </div>
            )}

            <div className="flex items-center bg-white/10 rounded-xl p-1">
              {(['fr', 'en'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    lang === l ? 'bg-white text-[#5A5A40]' : 'text-[#D1CECB] hover:text-white'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {!isPickup && (
              <>
            <button
              onClick={handleCallWaiterClick}
              disabled={callSent || !isTableVerified}
              title={!isTableVerified ? 'Validez le code à 4 chiffres de votre table ci-dessous pour activer cette fonction.' : undefined}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-medium transition-all shadow-xs ${
                callSent
                  ? 'bg-[#486349] text-white'
                  : !isTableVerified
                  ? 'bg-white/10 text-[#D1CECB]/50 cursor-not-allowed'
                  : 'bg-[#F5F2ED] text-[#5A5A40] hover:bg-white active:scale-95'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>{callSent ? 'Serveur Appelé !' : 'Appeler le serveur'}</span>
            </button>

            <button
              onClick={handleRequestBillClick}
              disabled={billSent || !isTableVerified}
              title={!isTableVerified ? 'Validez le code à 4 chiffres de votre table ci-dessous pour activer cette fonction.' : undefined}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-medium transition-all shadow-xs ${
                billSent
                  ? 'bg-[#486349] text-white'
                  : !isTableVerified
                  ? 'bg-white/10 text-[#D1CECB]/50 cursor-not-allowed'
                  : 'bg-[#1A1A1A] text-white hover:bg-[#2A2A2A] active:scale-95'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>{billSent ? 'Demande envoyée !' : "Demander l'addition"}</span>
            </button>
              </>
            )}

            {activeOrder && activeOrder.status !== 'terminee' && (
              <button
                onClick={onOpenStatusModal}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-medium bg-[#D95D39] text-white hover:bg-[#C24E2B] transition-all shadow-xs active:scale-95 animate-pulse"
              >
                <Clock className="w-4 h-4" />
                <span>Suivre ma commande ({activeOrder.items.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bannière de confirmation table active */}
      <div className="mb-6 p-4 rounded-3xl bg-white dark:bg-[#1C1C16] border border-[#E5E2DD] dark:border-[#33332A] shadow-xs">
        <div className="flex items-center justify-between gap-3 text-emerald-700 dark:text-emerald-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">
                Table {table.number} — Occupée & Validée
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Un signal sonore (2 bips) a été transmis au serveur et à l'administrateur.
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-extrabold px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800 shrink-0">
            OCCUPÉE
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#9A948C] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher un plat, une boisson, un ingrédient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#1C1C16] text-[#1A1A1A] dark:text-white placeholder-[#9A948C] text-sm py-3 pl-10 pr-4 rounded-2xl border border-[#E5E2DD] dark:border-[#33332A] focus:outline-none focus:ring-2 focus:ring-[#5A5A40] shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A948C] hover:text-[#1A1A1A]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {(availableDietaryLabels.length > 0 || availableAllergens.length > 0) && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold border shadow-2xs transition-all shrink-0 ${
              activeFilterCount > 0
                ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                : 'bg-white dark:bg-[#1C1C16] text-[#5A5A40] dark:text-[#D1CECB] border-[#E5E2DD] dark:border-[#33332A]'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
          </button>
        )}
      </div>

      {showFilters && (availableDietaryLabels.length > 0 || availableAllergens.length > 0) && (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#E5E2DD] dark:border-[#33332A] rounded-2xl p-4 mb-6 space-y-4">
          {availableDietaryLabels.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[#5A5A40] dark:text-[#D1CECB] mb-2">Régimes :</p>
              <div className="flex flex-wrap gap-2">
                {availableDietaryLabels.map((label) => {
                  const isActive = activeDietaryLabels.includes(label);
                  return (
                    <button
                      key={label}
                      onClick={() =>
                        setActiveDietaryLabels(
                          isActive ? activeDietaryLabels.filter((l) => l !== label) : [...activeDietaryLabels, label]
                        )
                      }
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                        isActive
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-[#F5F2ED] dark:bg-[#26261E] border-[#E5E2DD] dark:border-[#33332A] text-[#5A5A40] dark:text-[#D1CECB]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {availableAllergens.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[#D95D39] mb-2">Exclure les allergènes :</p>
              <div className="flex flex-wrap gap-2">
                {availableAllergens.map((alg) => {
                  const isExcluded = excludedAllergens.includes(alg);
                  return (
                    <button
                      key={alg}
                      onClick={() =>
                        setExcludedAllergens(
                          isExcluded ? excludedAllergens.filter((a) => a !== alg) : [...excludedAllergens, alg]
                        )
                      }
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                        isExcluded
                          ? 'bg-[#D95D39] text-white border-[#D95D39]'
                          : 'bg-[#F5F2ED] dark:bg-[#26261E] border-[#E5E2DD] dark:border-[#33332A] text-[#5A5A40] dark:text-[#D1CECB]'
                      }`}
                    >
                      {alg}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setActiveDietaryLabels([]);
                setExcludedAllergens([]);
              }}
              className="text-xs font-bold text-[#9A948C] hover:text-[#5A5A40] underline"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      {/* Section Switch : Menu (plats) vs Bar & Alcools */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => {
            setActiveSection('food');
            setSelectedCategoryId('all');
          }}
          className={`py-3 rounded-2xl text-sm font-bold transition-all ${
            activeSection === 'food'
              ? 'bg-[#5A5A40] text-white shadow-md'
              : 'bg-white dark:bg-[#1C1C16] text-[#9A948C] border border-[#E5E2DD] dark:border-[#33332A]'
          }`}
        >
          🍽️ Menu
        </button>
        <button
          onClick={() => {
            setActiveSection('bar');
            setSelectedCategoryId('all');
          }}
          className={`py-3 rounded-2xl text-sm font-bold transition-all ${
            activeSection === 'bar'
              ? 'bg-[#5A5A40] text-white shadow-md'
              : 'bg-white dark:bg-[#1C1C16] text-[#9A948C] border border-[#E5E2DD] dark:border-[#33332A]'
          }`}
        >
          🍷 Bar & Alcools
        </button>
      </div>

      {/* Category Horizontal Slider */}
      <div className="relative mb-6">
        <button
          onClick={() => scrollCategories('left')}
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full bg-white dark:bg-[#1C1C16] border border-[#E5E2DD] dark:border-[#33332A] shadow-md cursor-pointer"
          aria-label="Défiler à gauche"
        >
          <ChevronLeft className="w-4 h-4 text-[#5A5A40] dark:text-[#E2E0D8]" />
        </button>

        <div
          ref={categoryScrollRef}
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none sm:px-9"
        >
        <button
          onClick={() => setSelectedCategoryId('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-medium whitespace-nowrap transition-all ${
            selectedCategoryId === 'all'
              ? 'bg-[#5A5A40] text-white shadow-2xs font-semibold'
              : 'bg-white dark:bg-[#1C1C16] text-[#9A948C] border border-[#E5E2DD] dark:border-[#33332A] hover:bg-[#F5F2ED] dark:hover:bg-[#26261E]'
          }`}
        >
          Tous les produits
        </button>
        {sectionCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategoryId === cat.id
                ? 'bg-[#5A5A40] text-white shadow-2xs font-semibold'
                : 'bg-white dark:bg-[#1C1C16] text-[#9A948C] border border-[#E5E2DD] dark:border-[#33332A] hover:bg-[#F5F2ED] dark:hover:bg-[#26261E]'
            }`}
          >
            {cat.name}
          </button>
        ))}
        </div>

        <button
          onClick={() => scrollCategories('right')}
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full bg-white dark:bg-[#1C1C16] border border-[#E5E2DD] dark:border-[#33332A] shadow-md cursor-pointer"
          aria-label="Défiler à droite"
        >
          <ChevronRight className="w-4 h-4 text-[#5A5A40] dark:text-[#E2E0D8]" />
        </button>
      </div>


      {/* Menu Grid */}
      {filteredMenu.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#1C1C16] rounded-3xl border border-[#E5E2DD] dark:border-[#33332A] p-8">
          <AlertCircle className="w-12 h-12 text-[#9A948C] mx-auto mb-3" />
          <h3 className="text-base font-serif font-semibold text-[#5A5A40] dark:text-[#E2E0D8]">Aucun produit trouvé</h3>
          <p className="text-xs text-[#9A948C] mt-1">Essayez un autre terme de recherche ou changez de catégorie.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMenu.map((item) => {
            const isOutOfStock = !item.isAvailable || item.stockQuantity <= 0;
            const displayPrice = item.isPromo && item.promoPrice ? item.promoPrice : item.price;

            return (
              <div
                key={item.id}
                onClick={() => !isOutOfStock && openItemDetailModal(item)}
                className={`group relative bg-white dark:bg-[#1C1C16] rounded-3xl border border-[#E5E2DD] dark:border-[#33332A] overflow-hidden shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between ${
                  isOutOfStock ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5'
                }`}
              >
                <div>
                  {/* Photo Banner */}
                  <div className="relative aspect-16/10 overflow-hidden bg-[#F5F2ED] dark:bg-[#26261E]">
                    <img
                      src={item.images[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'}
                      alt={item.name}
                      className={`w-full h-full object-cover transition-transform duration-500 ${
                        !isOutOfStock && 'group-hover:scale-105'
                      }`}
                    />

                    {/* Badges Overlay */}
                    <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-10">
                      {item.isRecommended && (
                        <span className="bg-[#5A5A40] text-white text-[10px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full shadow-2xs flex items-center gap-1">
                          <Star className="w-3 h-3 fill-white" /> Chef
                        </span>
                      )}
                      {item.isPromo && (
                        <span className="bg-[#D95D39] text-white text-[10px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full shadow-2xs flex items-center gap-1">
                          <Tag className="w-3 h-3" /> Promo
                        </span>
                      )}
                      {item.isSpicy && (
                        <span className="bg-[#C24E2B] text-white text-[10px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full shadow-2xs flex items-center gap-1">
                          <Flame className="w-3 h-3" /> Épicé
                        </span>
                      )}
                    </div>

                    {/* Prep Time badge */}
                    <div className="absolute bottom-3 right-3 bg-[#1A1A1A]/80 text-white text-[10px] font-medium px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#E0B580]" />
                      <span>{item.prepTimeMinutes} min</span>
                    </div>

                    {/* Out of stock Overlay */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-[#12120E]/70 backdrop-blur-xs flex items-center justify-center p-4">
                        <span className="bg-[#D95D39] text-white font-medium text-xs px-3 py-1.5 rounded-full shadow-lg">
                          Rupture de stock
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif font-semibold text-[#1A1A1A] dark:text-white text-lg group-hover:text-[#5A5A40] transition-colors">
                        {t(item, 'name')}
                      </h3>
                    </div>

                    <p className="text-xs text-[#9A948C] dark:text-[#A8A49C] mt-1.5 line-clamp-2 leading-relaxed">
                      {t(item, 'description')}
                    </p>

                    {/* Dietary labels badges */}
                    {(item.dietaryLabels || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {(item.dietaryLabels || []).map((label) => (
                          <span
                            key={label}
                            className="text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/50"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Allergens badges */}
                    {item.allergens.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {item.allergens.map((alg) => (
                          <span
                            key={alg}
                            className="text-[9px] bg-[#F5F2ED] dark:bg-[#26261E] text-[#9A948C] px-2 py-0.5 rounded-md border border-[#E5E2DD] dark:border-[#33332A]"
                          >
                            {alg}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Price & Add Button */}
                <div className="p-5 pt-0 flex items-center justify-between border-t border-[#E5E2DD] dark:border-[#33332A] mt-2">
                  <div className="pt-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif font-bold text-[#5A5A40] dark:text-[#E2E0D8] text-xl">
                        {formatCurrency(displayPrice, settings.currency)}
                        {item.isPricedByWeight && <span className="text-xs font-sans font-medium">/Kg</span>}
                      </span>
                      {item.isPromo && item.promoPrice && (
                        <span className="text-xs text-[#9A948C] line-through">
                          {formatCurrency(item.price, settings.currency)}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isOutOfStock) onAddToCart(item, 1);
                    }}
                    disabled={isOutOfStock}
                    className={`p-3 rounded-2xl font-bold transition-all ${
                      isOutOfStock
                        ? 'bg-[#F5F2ED] dark:bg-[#26261E] text-[#9A948C] cursor-not-allowed'
                        : 'bg-[#5A5A40] hover:bg-[#484833] text-white shadow-2xs active:scale-95'
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Cart Bar */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[92%] bg-[#5A5A40] text-white rounded-3xl p-3 pl-5 shadow-xl flex items-center justify-between border border-[#E5E2DD]/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center font-bold text-sm">
              {cartItemCount}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/80">Panier Table {table.number}</p>
              <p className="text-base font-serif font-semibold">{formatCurrency(cartTotal, settings.currency)}</p>
            </div>
          </div>

          <button
            onClick={onOpenCart}
            className="flex items-center gap-2 bg-[#F5F2ED] text-[#5A5A40] px-5 py-3 rounded-2xl font-semibold text-xs hover:bg-white transition-colors shadow-2xs"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Voir le Panier</span>
          </button>
        </div>
      )}

      {/* Item Detail Modal with Gallery & Notes */}
      {selectedMenuItem && (
        <div className="fixed inset-0 z-50 bg-[#12120E]/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1C1C16] w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-[#E5E2DD] dark:border-[#33332A] my-8">
            {/* Header Image Gallery */}
            <div className="relative aspect-16/10 bg-[#F5F2ED] dark:bg-[#26261E]">
              <img
                src={
                  selectedMenuItem.images[activeImageIdx] ||
                  selectedMenuItem.images[0] ||
                  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'
                }
                alt={selectedMenuItem.name}
                className="w-full h-full object-cover"
              />

              <button
                onClick={() => setSelectedMenuItem(null)}
                className="absolute top-4 right-4 p-2 bg-[#1A1A1A]/70 hover:bg-[#1A1A1A] text-white rounded-full transition-colors z-20"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Thumbnails if multiple images */}
              {selectedMenuItem.images.length > 1 && (
                <div className="absolute bottom-3 left-4 right-4 flex items-center gap-2 overflow-x-auto p-1 bg-[#12120E]/40 rounded-xl backdrop-blur-xs">
                  {selectedMenuItem.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIdx(idx)}
                      className={`w-12 h-10 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                        activeImageIdx === idx ? 'border-[#5A5A40] scale-105' : 'border-transparent opacity-70'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-2xl font-serif font-semibold text-[#5A5A40] dark:text-[#E2E0D8]">{t(selectedMenuItem, 'name')}</h3>
                  <span className="text-xl font-serif font-bold text-[#5A5A40] dark:text-white">
                    {formatCurrency(
                      selectedMenuItem.isPromo && selectedMenuItem.promoPrice
                        ? selectedMenuItem.promoPrice
                        : selectedMenuItem.price,
                      settings.currency
                    )}
                  </span>
                </div>
                <p className="text-xs text-[#9A948C] dark:text-[#A8A49C] mt-2 leading-relaxed">
                  {t(selectedMenuItem, 'description')}
                </p>
              </div>

              {/* Video Preview if provided */}
              {selectedMenuItem.videoUrl && (
                <div className="p-3 bg-[#F5F2ED] dark:bg-[#26261E] rounded-2xl border border-[#E5E2DD] dark:border-[#33332A] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#5A5A40] dark:text-[#D1CECB]">
                    <Play className="w-4 h-4 fill-[#5A5A40]" />
                    <span>Vidéo de présentation du plat</span>
                  </div>
                  <a
                    href={selectedMenuItem.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#5A5A40] hover:underline"
                  >
                    Visionner
                  </a>
                </div>
              )}

              {/* Allergens & Prep time */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#9A948C]">
                <span className="flex items-center gap-1 bg-[#F5F2ED] dark:bg-[#26261E] px-3 py-1 rounded-xl border border-[#E5E2DD] dark:border-[#33332A]">
                  <Clock className="w-3.5 h-3.5 text-[#E0B580]" /> Temps : {selectedMenuItem.prepTimeMinutes} min
                </span>
                {selectedMenuItem.allergens.length > 0 && (
                  <span className="flex items-center gap-1 bg-[#F5F2ED] dark:bg-[#26261E] px-3 py-1 rounded-xl border border-[#E5E2DD] dark:border-[#33332A]">
                    <Info className="w-3.5 h-3.5 text-[#D95D39]" /> Allergènes : {selectedMenuItem.allergens.join(', ')}
                  </span>
                )}
              </div>

              {/* Special Instructions / Remarques */}
              <div>
                <label className="block text-xs font-semibold text-[#5A5A40] dark:text-[#D1CECB] mb-1">
                  Remarques ou instructions spéciales pour le chef :
                </label>
                <input
                  type="text"
                  placeholder="Ex: Sans oignons, Peu salé, Sauce à part, Bien cuit..."
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full bg-[#F5F2ED] dark:bg-[#26261E] text-[#1A1A1A] dark:text-white text-xs p-3 rounded-2xl border border-[#E5E2DD] dark:border-[#33332A] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]"
                />
              </div>

              {/* Quantity Selector & Add Button */}
              <div className="flex items-center justify-between pt-3 border-t border-[#E5E2DD] dark:border-[#33332A]">
                <div className="flex items-center gap-3 bg-[#F5F2ED] dark:bg-[#26261E] p-1.5 rounded-2xl border border-[#E5E2DD] dark:border-[#33332A]">
                  <button
                    onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                    className="p-2 text-[#5A5A40] dark:text-[#D1CECB] hover:bg-white dark:hover:bg-[#1C1C16] rounded-xl transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-[#1A1A1A] dark:text-white text-sm px-2">
                    {itemQuantity}
                  </span>
                  <button
                    onClick={() => setItemQuantity(itemQuantity + 1)}
                    className="p-2 text-[#5A5A40] dark:text-[#D1CECB] hover:bg-white dark:hover:bg-[#1C1C16] rounded-xl transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={handleAddFromModal}
                  disabled={!isTableVerified}
                  title={!isTableVerified ? 'Validez le code à 4 chiffres de votre table avant de commander.' : undefined}
                  className={`flex-1 ml-4 py-3.5 px-6 rounded-2xl font-medium text-xs flex items-center justify-center gap-2 shadow-2xs transition-all ${
                    isTableVerified
                      ? 'bg-[#5A5A40] hover:bg-[#484833] text-white active:scale-95'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isTableVerified
                      ? `Ajouter au panier • ${formatCurrency(
                          (selectedMenuItem.isPromo && selectedMenuItem.promoPrice
                            ? selectedMenuItem.promoPrice
                            : selectedMenuItem.price) * itemQuantity,
                          settings.currency
                        )}`
                      : 'Validez le code de la table pour commander'}
                  </span>
                </button>
              </div>
              {!isTableVerified && (
                <p className="text-[11px] text-[#D95D39] font-medium text-center -mt-1">
                  Saisissez le code à 4 chiffres affiché sur votre table (bandeau ci-dessus) pour pouvoir commander.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Before Adding to Cart */}
      {showConfirmAdd && selectedMenuItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border-2 border-emerald-500 space-y-4 animate-scale-up text-center">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
              <Check className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Confirmer votre Choix</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Souhaitez-vous vraiment ajouter cet article à votre commande ?
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-left space-y-1">
              <p className="font-bold text-slate-900 dark:text-white text-sm">
                {itemQuantity}x {selectedMenuItem.name}
              </p>
              {itemNotes && (
                <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                  Note: "{itemNotes}"
                </p>
              )}
              <p className="text-sm font-black text-rose-600 dark:text-rose-400 mt-2">
                Total : {formatCurrency(
                  (selectedMenuItem.isPromo && selectedMenuItem.promoPrice
                    ? selectedMenuItem.promoPrice
                    : selectedMenuItem.price) * itemQuantity,
                  settings.currency
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowConfirmAdd(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white rounded-2xl font-bold text-xs transition-colors"
              >
                Modifier
              </button>
              <button
                onClick={handleFinalConfirmAdd}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
              >
                Oui, Confirmer !
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
