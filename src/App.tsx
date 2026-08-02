import React, { useEffect, useState, Suspense, lazy } from 'react';
import { store, playDoubleBeepSound } from './services/store';
import { fetchOwnProfile, signOut, createStaffAccount, signInWithPin, listMfaFactors } from './services/auth';
import { SettingsMfaGate } from './components/admin/SettingsMfaGate';
import {
  Table,
  MenuItem,
  Category,
  Order,
  Bill,
  Reservation,
  Waiter,
  User,
  RestaurantSettings,
  CallNotification,
  PaymentMethod,
  PaymentBreakdown,
  TableStatus,
  OrderStatus,
  MenuItem
} from './types';

import { Header } from './components/common/Header';
import { NotificationToast } from './components/common/NotificationToast';
import { AlarmBanner } from './components/common/AlarmBanner';
import { ClientMenuView } from './components/client/ClientMenuView';
import { KioskMenuView } from './components/client/KioskMenuView';
import { CartDrawer } from './components/client/CartDrawer';
import { OrderStatusModal } from './components/client/OrderStatusModal';
import { AdminLayout, AdminTab } from './components/admin/AdminLayout';
// Vues admin chargées à la demande : un client qui commande ne télécharge jamais
// ce code (Dashboard, Caisse, jsPDF, xlsx...), ce qui allège fortement l'app.
const DashboardView = lazy(() =>
  import('./components/admin/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const TablesView = lazy(() =>
  import('./components/admin/TablesView').then((m) => ({ default: m.TablesView }))
);
const KitchenView = lazy(() =>
  import('./components/admin/KitchenView').then((m) => ({ default: m.KitchenView }))
);
const CashierView = lazy(() =>
  import('./components/admin/CashierView').then((m) => ({ default: m.CashierView }))
);
const MenuView = lazy(() => import('./components/admin/MenuView').then((m) => ({ default: m.MenuView })));
const WaitersView = lazy(() =>
  import('./components/admin/WaitersView').then((m) => ({ default: m.WaitersView }))
);
const ReservationsView = lazy(() =>
  import('./components/admin/ReservationsView').then((m) => ({ default: m.ReservationsView }))
);
const OrderHistoryView = lazy(() =>
  import('./components/admin/OrderHistoryView').then((m) => ({ default: m.OrderHistoryView }))
);
const QRCodeGeneratorView = lazy(() =>
  import('./components/admin/QRCodeGeneratorView').then((m) => ({ default: m.QRCodeGeneratorView }))
);
const SettingsView = lazy(() =>
  import('./components/admin/SettingsView').then((m) => ({ default: m.SettingsView }))
);
import { LoginModal } from './components/auth/LoginModal';

// Page d'accueil client : aucune table n'est affichée tant que le code à 4 chiffres
// n'a pas été saisi et validé. Dès que 4 chiffres sont tapés, la vérification se fait
// automatiquement (pas de bouton à cliquer) et le numéro de table trouvé s'affiche.
function ClientLandingGate({
  settings,
  menu,
  onCodeVerified,
  onPickupMode,
}: {
  settings: RestaurantSettings;
  menu: MenuItem[];
  onCodeVerified: (tableId: number) => void;
  onPickupMode: () => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [foundTableId, setFoundTableId] = useState<number | null>(null);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [resName, setResName] = useState('');
  const [resPhone, setResPhone] = useState('');
  const [resGuestCount, setResGuestCount] = useState(2);
  const [resDateTime, setResDateTime] = useState('');
  const [resNotes, setResNotes] = useState('');
  const [resSubmitting, setResSubmitting] = useState(false);
  const [resDone, setResDone] = useState(false);
  const [resError, setResError] = useState('');

  const platsDuJour = menu.filter((m) => m.isPlatDuJour && m.isAvailable);

  const handleSubmitReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resName.trim() || !resPhone.trim() || !resDateTime) return;
    setResSubmitting(true);
    setResError('');
    const result = await store.requestReservation({
      clientName: resName.trim(),
      clientPhone: resPhone.trim(),
      guestCount: resGuestCount,
      dateTime: new Date(resDateTime).toISOString(),
      notes: resNotes.trim() || undefined,
    });
    setResSubmitting(false);
    if (!result.success) {
      setResError(result.message || 'Impossible d\'envoyer la demande. Réessayez.');
      return;
    }
    setResDone(true);
  };

  useEffect(() => {
    if (pin.length !== 4) {
      setError('');
      setFoundTableId(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const result = await store.verifyAndOccupyTableByCode(pin);
      if (cancelled) return;

      if (result.success && result.tableId) {
        setError('');
        setFoundTableId(result.tableId);
        setTimeout(() => {
          if (!cancelled) onCodeVerified(result.tableId as number);
        }, 700);
      } else {
        setFoundTableId(null);
        setError(result.message || 'Code invalide. Vérifiez les 4 chiffres affichés sur votre table.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pin]);

  return (
    <main className="min-h-[75vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-white dark:bg-[#1C1C16] rounded-3xl shadow-xl border border-[#E5E2DD] dark:border-[#33332A] p-8 text-center space-y-6">
        {settings.logo && (
          <img
            src={settings.logo}
            alt={settings.name}
            className="w-16 h-16 rounded-2xl object-cover mx-auto shadow-sm"
          />
        )}
        <div>
          <h1 className="text-xl font-serif font-semibold text-[#5A5A40] dark:text-[#E2E0D8]">
            {settings.name}
          </h1>
          <p className="text-xs text-[#9A948C] mt-2">
            Bienvenue ! Saisissez le code à 4 chiffres affiché sur votre table pour accéder au menu.
          </p>
        </div>

        {platsDuJour.length > 0 && (
          <div className="text-left bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <span>⭐</span>
              <span>Plat{platsDuJour.length > 1 ? 's' : ''} du Jour</span>
            </p>
            {platsDuJour.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-[#1A1A1A] dark:text-white">{p.name}</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  {p.price} {settings.currency}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            className="w-full text-center text-3xl font-black font-mono tracking-[0.5em] bg-[#F5F2ED] dark:bg-[#26261E] text-[#1A1A1A] dark:text-white py-4 rounded-2xl border border-[#E5E2DD] dark:border-[#33332A] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]"
          />

          {foundTableId ? (
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              ✅ Table {foundTableId} trouvée — ouverture du menu...
            </p>
          ) : error ? (
            <p className="text-xs font-semibold text-rose-500">{error}</p>
          ) : (
            <p className="text-[11px] text-[#9A948C]">
              Le numéro de votre table s'affichera automatiquement dès la saisie.
            </p>
          )}
        </div>

        <div className="pt-2 border-t border-[#E5E2DD] dark:border-[#33332A] space-y-2">
          <button
            onClick={onPickupMode}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#F5F2ED] dark:bg-[#26261E] text-[#5A5A40] dark:text-[#D1CECB] rounded-2xl font-semibold text-sm border border-[#E5E2DD] dark:border-[#33332A] hover:bg-[#EDEDE6] transition-colors"
          >
            <span>🥡</span>
            <span>Commander à Emporter (Click & Collect)</span>
          </button>

          <button
            onClick={() => setShowReservationModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#F5F2ED] dark:bg-[#26261E] text-[#5A5A40] dark:text-[#D1CECB] rounded-2xl font-semibold text-sm border border-[#E5E2DD] dark:border-[#33332A] hover:bg-[#EDEDE6] transition-colors"
          >
            <span>📅</span>
            <span>Réserver une Table</span>
          </button>
        </div>
      </div>

      {showReservationModal && (
        <div className="fixed inset-0 z-50 bg-[#12120E]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1C1C16] w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-[#E5E2DD] dark:border-[#33332A] space-y-4">
            {resDone ? (
              <div className="text-center space-y-3 py-4">
                <p className="text-3xl">✅</p>
                <p className="text-sm font-bold text-[#1A1A1A] dark:text-white">Demande envoyée !</p>
                <p className="text-xs text-[#9A948C]">
                  Le restaurant va confirmer votre réservation et vous attribuer une table.
                </p>
                <button
                  onClick={() => {
                    setShowReservationModal(false);
                    setResDone(false);
                    setResName('');
                    setResPhone('');
                    setResNotes('');
                    setResDateTime('');
                  }}
                  className="w-full py-3 bg-[#5A5A40] text-white rounded-2xl font-semibold text-xs mt-2"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitReservation} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif font-semibold text-lg text-[#5A5A40] dark:text-[#E2E0D8]">
                    Réserver une Table
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowReservationModal(false)}
                    className="p-1.5 text-[#9A948C] hover:text-[#1A1A1A]"
                  >
                    ✕
                  </button>
                </div>

                {resError && <p className="text-xs font-semibold text-rose-500">{resError}</p>}

                <div className="space-y-2 text-xs">
                  <input
                    type="text"
                    required
                    value={resName}
                    onChange={(e) => setResName(e.target.value)}
                    placeholder="Votre nom"
                    className="w-full bg-[#F5F2ED] dark:bg-[#26261E] text-[#1A1A1A] dark:text-white p-3 rounded-2xl border border-[#E5E2DD] dark:border-[#33332A]"
                  />
                  <input
                    type="tel"
                    required
                    value={resPhone}
                    onChange={(e) => setResPhone(e.target.value)}
                    placeholder="Téléphone"
                    className="w-full bg-[#F5F2ED] dark:bg-[#26261E] text-[#1A1A1A] dark:text-white p-3 rounded-2xl border border-[#E5E2DD] dark:border-[#33332A]"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      required
                      value={resGuestCount}
                      onChange={(e) => setResGuestCount(parseInt(e.target.value) || 1)}
                      placeholder="Personnes"
                      className="w-24 bg-[#F5F2ED] dark:bg-[#26261E] text-[#1A1A1A] dark:text-white p-3 rounded-2xl border border-[#E5E2DD] dark:border-[#33332A]"
                    />
                    <input
                      type="datetime-local"
                      required
                      value={resDateTime}
                      onChange={(e) => setResDateTime(e.target.value)}
                      className="flex-1 bg-[#F5F2ED] dark:bg-[#26261E] text-[#1A1A1A] dark:text-white p-3 rounded-2xl border border-[#E5E2DD] dark:border-[#33332A]"
                    />
                  </div>
                  <input
                    type="text"
                    value={resNotes}
                    onChange={(e) => setResNotes(e.target.value)}
                    placeholder="Demande spéciale (optionnel)"
                    className="w-full bg-[#F5F2ED] dark:bg-[#26261E] text-[#1A1A1A] dark:text-white p-3 rounded-2xl border border-[#E5E2DD] dark:border-[#33332A]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={resSubmitting}
                  className="w-full py-3.5 bg-[#5A5A40] hover:bg-[#484833] disabled:opacity-60 text-white rounded-2xl font-semibold text-xs shadow-2xs"
                >
                  {resSubmitting ? 'Envoi...' : 'Envoyer la Demande'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// Choisit un onglet de démarrage que le rôle du compte peut réellement ouvrir
// (évite l'écran "Accès Non Autorisé" juste après connexion pour tout le monde
// sauf admin/manager, puisque 'dashboard' — l'ancien onglet par défaut — leur
// est interdit).
function getDefaultAdminTab(role: User['role']): AdminTab {
  if (role === 'cuisinier') return 'kitchen';
  if (role === 'caissier') return 'cashier';
  if (role === 'serveur') return 'tables';
  return 'dashboard'; // admin, manager
}

export default function App() {
  const [appState, setAppState] = useState(store.getState());

  // Navigation & View state
  const [currentView, setCurrentView] = useState<'client' | 'admin'>('client');
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [selectedTableId, setSelectedTableId] = useState<number>(1);

  // Le client n'est considéré comme "arrivé" sur une table que lorsqu'il a explicitement
  // scanné un QR avec un code valide, ou saisi son code à 4 chiffres sur la page d'accueil.
  // Sans ça, on ne doit JAMAIS lui montrer une table par défaut (même si elle est occupée
  // par quelqu'un d'autre par ailleurs).
  const [clientAccessGranted, setClientAccessGranted] = useState(false);

  // Authentication state — plus d'auto-login admin par défaut : on démarre
  // déconnecté et on restaure une éventuelle session Supabase existante juste après.
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Verrou sur l'onglet Paramètres : si ce compte a activé la double
  // authentification, on redemande le code à 6 chiffres à chaque ouverture de
  // Paramètres (indépendamment de la connexion normale, qui n'exige rien).
  const [settingsMfaFactorId, setSettingsMfaFactorId] = useState<string | null>(null);
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [showSettingsGate, setShowSettingsGate] = useState(false);

  // Client Cart State
  const [cartItems, setCartItems] = useState<
    Array<{ menuItem: MenuItem; quantity: number; notes?: string }>
  >([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Theme & Audio Preferences
  const [darkMode, setDarkMode] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Restaure la session Supabase existante (si l'utilisateur a déjà un JWT valide
  // en cache) au chargement de l'app — SAUF si l'URL contient un ?waiterPin=,
  // auquel cas cette connexion explicite a toujours la priorité. Les deux étaient
  // avant dans deux useEffect séparés qui se "couraient après" : selon lequel
  // finissait en dernier, on pouvait se retrouver connecté avec le mauvais compte.
  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const paramWaiterPin = params.get('waiterPin');

      if (paramWaiterPin) {
        const result = await signInWithPin(paramWaiterPin);
        if (result.success && result.user) {
          setCurrentUser(result.user);
          setCurrentView('admin');
          setAdminTab(getDefaultAdminTab(result.user.role));
        }
        setIsAuthLoading(false);
        return;
      }

      const profile = await fetchOwnProfile();
      if (profile) {
        setCurrentUser(profile);
        setCurrentView('admin');
        setAdminTab(getDefaultAdminTab(profile.role));
      }
      setIsAuthLoading(false);
    })();
  }, []);

  // Récupère le facteur MFA du compte connecté (s'il en a activé un), pour
  // savoir si Paramètres doit être verrouillé. Réinitialise le verrou à
  // chaque changement de compte (nouvelle connexion = re-verrouillé).
  useEffect(() => {
    setSettingsUnlocked(false);
    setSettingsMfaFactorId(null);
    if (!currentUser) return;
    (async () => {
      const factors = await listMfaFactors();
      setSettingsMfaFactorId(factors[0]?.id || null);
    })();
  }, [currentUser?.id]);

  // Detect URL parameters for Table access e.g. /table/3 or ?table=3&code=1001
  // (la connexion serveur par ?waiterPin= est gérée dans l'effet précédent)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramTable = params.get('table');
    const paramCode = params.get('code');
    const paramWaiterPin = params.get('waiterPin');

    // Si un waiterPin est présent, cet effet ne gère pas la logique de table.
    if (paramWaiterPin) {
      return;
    }

    const path = window.location.pathname;
    const match = path.match(/\/table\/(\d+)/);

    let tableNum: number | null = null;
    if (match && match[1]) {
      tableNum = parseInt(match[1], 10);
    } else if (paramTable) {
      tableNum = parseInt(paramTable, 10);
    }

    if (tableNum && tableNum >= 1 && tableNum <= 500) {
      setSelectedTableId(tableNum);
      setCurrentView('client');

      if (paramCode) {
        (async () => {
          const result = await store.verifyAndOccupyTable(tableNum as number, paramCode);
          if (result.success) {
            setClientAccessGranted(true);
          }
        })();
      }
    }
  }, []);

  // Subscribe to store
  useEffect(() => {
    const unsubscribe = store.subscribe((newState) => {
      setAppState(newState);
    });
    return () => unsubscribe();
  }, []);

  // Sync dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Rappel sonore périodique : tant qu'une commande "prête" (plat ou boisson)
  // n'a pas été marquée "servie" par le serveur, ça re-sonne toutes les 20s.
  // Ne concerne que le personnel connecté (jamais l'appareil du client).
  useEffect(() => {
    if (!currentUser || !audioEnabled) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const staleReadyOrders = appState.orders.filter(
        (o) => o.status === 'prete' && now - new Date(o.updatedAt).getTime() >= 20000
      );
      if (staleReadyOrders.length > 0) {
        playDoubleBeepSound();
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [currentUser, audioEnabled, appState.orders]);

  const selectedTable = appState.tables.find((t) => t.id === selectedTableId);
  const assignedWaiter = appState.waiters.find((w) => w.id === selectedTable?.assignedWaiterId);

  // Sécurité : une table n'est considérée "vérifiée" que lorsque le client a saisi
  // le bon code à 4 chiffres (ce qui fait sortir son statut de 'libre' côté store).
  // Tant que ce n'est pas le cas, aucune action d'écriture (panier, appel serveur,
  // addition) n'est autorisée — visiter /table/N sans le code ne suffit plus.
  // NB : on teste "≠ libre" et pas "=== occupee" car after une commande le statut
  // passe à 'commande_en_cours' — la table reste bien vérifiée à ce moment-là.
  const isSelectedTableVerified = Boolean(selectedTable) && selectedTable?.status !== 'libre';

  const [pickupOrderId, setPickupOrderId] = useState<string | null>(null);

  // Pour la table virtuelle Click & Collect (999), plusieurs clients peuvent
  // avoir une commande active en même temps — on ne peut donc pas identifier
  // "ma commande" juste par tableId comme pour une vraie table. On utilise
  // l'ID de commande précis, mémorisé au moment de la création.
  const activeOrderForTable =
    selectedTableId === 999
      ? appState.orders.find((o) => o.id === pickupOrderId)
      : appState.orders.find(
          (o) => o.tableId === selectedTableId && o.status !== 'terminee' && o.status !== 'annulee'
        );

  // Cart operations
  const handleAddToCart = (item: MenuItem, quantity: number, notes?: string) => {
    // Sécurité : impossible d'ajouter au panier tant que la table n'a pas été
    // validée via son code QR à 4 chiffres (voir isSelectedTableVerified).
    if (!isSelectedTableVerified) return;

    const existingIndex = cartItems.findIndex(
      (c) => c.menuItem.id === item.id && c.notes === notes
    );
    if (existingIndex > -1) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += quantity;
      setCartItems(updated);
    } else {
      setCartItems([...cartItems, { menuItem: item, quantity, notes }]);
    }
  };

  const handleUpdateCartQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      setCartItems(cartItems.filter((_, idx) => idx !== index));
    } else {
      const updated = [...cartItems];
      updated[index].quantity = newQty;
      setCartItems(updated);
    }
  };

  const handleRemoveCartItem = (index: number) => {
    setCartItems(cartItems.filter((_, idx) => idx !== index));
  };

  const handleSubmitClientOrder = async () => {
    if (cartItems.length === 0 || !isSelectedTableVerified) return;

    if (selectedTableId === 999) {
      const order = await store.createPickupOrder(cartItems);
      if (order) setPickupOrderId(order.id);
    } else {
      store.createOrder(selectedTableId, cartItems);
    }
    setCartItems([]);
  };

  const cartTotalSum = cartItems.reduce(
    (acc, i) =>
      acc + (i.menuItem.isPromo && i.menuItem.promoPrice ? i.menuItem.promoPrice : i.menuItem.price) * i.quantity,
    0
  );

  // Tant que les données Supabase ou la session ne sont pas prêtes, on affiche un
  // écran de chargement plutôt qu'un état intermédiaire potentiellement incohérent.
  if (!appState.loaded || isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#5A5A40] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Chargement...</p>
        </div>
      </div>
    );
  }

  // Mode "borne tactile extérieure" (?kiosk=1) : menu en lecture seule, sans
  // panier ni commande, pensé pour une tablette fixée en vitrine.
  const isKioskMode = new URLSearchParams(window.location.search).get('kiosk') === '1';
  if (isKioskMode) {
    return <KioskMenuView categories={appState.categories} menu={appState.menu} settings={appState.settings} />;
  }

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors`}>
      {/* Persistent Audio Siren Alarm Banner for Waiters and Admin ONLY */}
      {currentView === 'admin' && <AlarmBanner alarm={appState.activeAlarm} />}

      {/* Top Main Navigation Header */}
      <Header
        currentView={currentView}
        selectedTableId={selectedTableId}
        tables={appState.tables}
        onSelectTable={(tId) => setSelectedTableId(tId)}
        onSwitchView={(v) => setCurrentView(v)}
        currentUser={currentUser}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={() => { signOut(); setCurrentUser(null); setCurrentView('client'); }}
        settings={appState.settings}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        notifications={appState.notifications}
        onClearNotifications={() => store.clearNotifications()}
        onDeleteNotification={(id) => store.deleteNotification(id)}
        audioEnabled={audioEnabled}
        onToggleAudio={() => setAudioEnabled(!audioEnabled)}
      />

      {/* Real-time Notification Toast Alert */}
      <NotificationToast
        notifications={appState.notifications}
        onClearNotifications={() => store.clearNotifications()}
        onDeleteNotification={(id) => store.deleteNotification(id)}
      />

      {/* Main View Router */}
      {currentView === 'client' ? (
        !clientAccessGranted ? (
          <ClientLandingGate
            settings={appState.settings}
            menu={appState.menu}
            onCodeVerified={(tableId) => {
              setSelectedTableId(tableId);
              setClientAccessGranted(true);
            }}
            onPickupMode={() => {
              setSelectedTableId(999);
              setClientAccessGranted(true);
            }}
          />
        ) : !selectedTable ? (
          // Ne devrait pas arriver, mais on évite un écran blanc si jamais la
          // table n'est momentanément pas trouvée (ex: pendant un rafraîchissement).
          <div className="min-h-[50vh] flex items-center justify-center px-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Chargement de votre table...</p>
          </div>
        ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <ClientMenuView
            table={selectedTable}
            categories={appState.categories}
            menu={appState.menu}
            activeOrder={activeOrderForTable}
            waiter={assignedWaiter}
            settings={appState.settings}
            onAddToCart={handleAddToCart}
            onCallWaiter={() => {
              if (!isSelectedTableVerified) return;
              store.callWaiter(selectedTableId);
            }}
            onRequestBill={() => {
              if (!isSelectedTableVerified) return;
              store.requestBill(selectedTableId);
            }}
            onOpenCart={() => setIsCartOpen(true)}
            onOpenStatusModal={() => setIsStatusModalOpen(true)}
            cartItemCount={cartItems.reduce((acc, i) => acc + i.quantity, 0)}
            cartTotal={cartTotalSum}
          />

          {/* Cart Drawer Modal */}
          <CartDrawer
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            items={cartItems}
            tableNumber={selectedTableId}
            settings={appState.settings}
            onUpdateQuantity={handleUpdateCartQty}
            onRemoveItem={handleRemoveCartItem}
            onSubmitOrder={handleSubmitClientOrder}
          />

          {/* Order Live Status Modal */}
          <OrderStatusModal
            isOpen={isStatusModalOpen}
            onClose={() => setIsStatusModalOpen(false)}
            order={activeOrderForTable}
            settings={appState.settings}
            onCallWaiter={() => {
              if (!isSelectedTableVerified) return;
              store.callWaiter(selectedTableId);
            }}
            onRequestBill={() => {
              if (!isSelectedTableVerified) return;
              store.requestBill(selectedTableId);
            }}
            onSubmitReview={(rating, comment) =>
              store.submitSatisfactionReview(selectedTableId, activeOrderForTable?.id || null, rating, comment)
            }
          />
        </main>
        )
      ) : !currentUser ? (
        // Ne devrait pas arriver (Header n'autorise le passage en vue admin
        // qu'après connexion), mais on évite par sécurité d'afficher une
        // fausse identité par défaut comme le faisait l'ancien code.
        <div className="max-w-md mx-auto mt-20 text-center space-y-4">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Session expirée ou non authentifiée.
          </p>
          <button
            onClick={() => setIsLoginOpen(true)}
            className="px-5 py-2.5 bg-[#5A5A40] text-white rounded-2xl font-semibold text-xs"
          >
            Se connecter
          </button>
        </div>
      ) : (
        /* Staff & Admin Interface Layout */
        <AdminLayout
          activeTab={adminTab}
          onTabChange={(tab) => {
            if (tab === 'settings' && settingsMfaFactorId && !settingsUnlocked) {
              setShowSettingsGate(true);
              return;
            }
            setAdminTab(tab);
          }}
          currentUser={currentUser}
          onLogout={() => { signOut(); setCurrentUser(null); setCurrentView('client'); }}
        >
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-4 border-[#5A5A40] border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
          {adminTab === 'dashboard' && (
            <DashboardView
              tables={appState.tables}
              orders={appState.orders}
              bills={appState.bills}
              waiters={appState.waiters}
              menu={appState.menu}
              settings={appState.settings}
            />
          )}

          {adminTab === 'tables' && (
            <TablesView
              tables={appState.tables}
              orders={appState.orders}
              waiters={appState.waiters}
              settings={appState.settings}
              currentUser={currentUser}
              categories={appState.categories}
              menu={appState.menu}
              onUpdateStatus={(tId, st) => store.updateTableStatus(tId, st)}
              onAssignWaiter={(tId, wId) => store.assignWaiterToTable(tId, wId)}
              onMoveOrder={(fromId, toId) => store.moveOrderBetweenTables(fromId, toId)}
              onMergeTables={(srcId, tgtId) => store.mergeTables(srcId, tgtId)}
              onConfirmOrder={(oId) => store.confirmOrder(oId)}
              onMarkServed={(oId) => store.updateOrderStatus(oId, 'servie')}
              onOpenCashierForTable={(tId) => {
                setSelectedTableId(tId);
                setAdminTab('cashier');
              }}
              onAddItemsToTable={(tId, items) => store.addItemsToTable(tId, items)}
              onAddItemByBarcode={(tId, code, qty) => store.addItemByBarcode(tId, code, qty)}
            />
          )}

          {adminTab === 'kitchen' && (
            <KitchenView
              orders={appState.orders}
              categories={appState.categories}
              settings={appState.settings}
              onUpdateOrderStatus={(oId, st) => store.updateOrderStatus(oId, st)}
              onUpdateOrderItemStatus={(oId, iId, st) => store.updateOrderItemStatus(oId, iId, st)}
            />
          )}

          {adminTab === 'cashier' && (
            <CashierView
              tables={appState.tables}
              orders={appState.orders}
              settings={appState.settings}
              categories={appState.categories}
              menu={appState.menu}
              onAddItemsToTable={(tId, items) => store.addItemsToTable(tId, items)}
              onProcessPayment={(oId, method, disc, cash, breakdown) =>
                store.processBillPayment(oId, method, disc, cash, breakdown, currentUser?.id)
              }
            />
          )}

          {adminTab === 'menu' && (
            <MenuView
              categories={appState.categories}
              menu={appState.menu}
              settings={appState.settings}
              onAddCategory={(name, icon, section) => store.addCategory(name, icon, section)}
              onDeleteCategory={(id) => store.deleteCategory(id)}
              onAddMenuItem={(item) => store.addMenuItem(item)}
              onUpdateMenuItem={(id, updates) => store.updateMenuItem(id, updates)}
              onDeleteMenuItem={(id) => store.deleteMenuItem(id)}
              onToggleAvailability={(id) => store.toggleItemAvailability(id)}
            />
          )}

          {adminTab === 'waiters' && (
            <WaitersView
              users={appState.users}
              waiters={appState.waiters}
              tables={appState.tables}
              onCreateAccount={(input) => createStaffAccount(input)}
              onUpdateUser={(id, up) => store.updateUser(id, up)}
              onUpdateWaiter={(id, up) => store.updateWaiter(id, up)}
            />
          )}

          {adminTab === 'reservations' && (
            <ReservationsView
              reservations={appState.reservations}
              tables={appState.tables}
              onAddReservation={(r) => store.addReservation(r)}
              onCancelReservation={(id) => store.cancelReservation(id)}
              onAssignTable={(resId, tableId) => store.assignReservationTable(resId, tableId)}
            />
          )}

          {adminTab === 'history' && (
            <OrderHistoryView
              orders={appState.orders}
              bills={appState.bills}
              settings={appState.settings}
            />
          )}

          {adminTab === 'qrcodes' && (
            <QRCodeGeneratorView
              tables={appState.tables}
              waiters={appState.waiters}
              settings={appState.settings}
              onSelectTable={(tId) => setSelectedTableId(tId)}
              onSwitchToClient={() => setCurrentView('client')}
            />
          )}

          {adminTab === 'settings' && (
            <SettingsView
              settings={appState.settings}
              onUpdateSettings={(up) => store.updateSettings(up)}
              onResetData={() => store.resetToDefaultData()}
            />
          )}
          </Suspense>
        </AdminLayout>
      )}

      {/* Password-protected Staff Login Dialog */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(u) => {
          setCurrentUser(u);
          setCurrentView('admin');
          setAdminTab(getDefaultAdminTab(u.role));
        }}
      />

      {/* Verrou Paramètres — demande le code à 6 chiffres avant d'ouvrir l'onglet */}
      {showSettingsGate && settingsMfaFactorId && (
        <SettingsMfaGate
          factorId={settingsMfaFactorId}
          onUnlock={() => {
            setSettingsUnlocked(true);
            setShowSettingsGate(false);
            setAdminTab('settings');
          }}
          onCancel={() => setShowSettingsGate(false)}
        />
      )}
    </div>
  );
}
