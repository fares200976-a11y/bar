import React, { useEffect, useState } from 'react';
import { store, playChimeSound } from './services/store';
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
  OrderStatus
} from './types';

import { Header } from './components/common/Header';
import { NotificationToast } from './components/common/NotificationToast';
import { AlarmBanner } from './components/common/AlarmBanner';
import { ClientMenuView } from './components/client/ClientMenuView';
import { CartDrawer } from './components/client/CartDrawer';
import { OrderStatusModal } from './components/client/OrderStatusModal';
import { AdminLayout, AdminTab } from './components/admin/AdminLayout';
import { DashboardView } from './components/admin/DashboardView';
import { TablesView } from './components/admin/TablesView';
import { KitchenView } from './components/admin/KitchenView';
import { CashierView } from './components/admin/CashierView';
import { MenuView } from './components/admin/MenuView';
import { WaitersView } from './components/admin/WaitersView';
import { ReservationsView } from './components/admin/ReservationsView';
import { OrderHistoryView } from './components/admin/OrderHistoryView';
import { QRCodeGeneratorView } from './components/admin/QRCodeGeneratorView';
import { SettingsView } from './components/admin/SettingsView';
import { LoginModal } from './components/auth/LoginModal';

// Page d'accueil client : aucune table n'est affichée tant que le code à 4 chiffres
// n'a pas été saisi et validé. Dès que 4 chiffres sont tapés, la vérification se fait
// automatiquement (pas de bouton à cliquer) et le numéro de table trouvé s'affiche.
function ClientLandingGate({
  settings,
  onCodeVerified,
}: {
  settings: RestaurantSettings;
  onCodeVerified: (tableId: number) => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [foundTableId, setFoundTableId] = useState<number | null>(null);

  useEffect(() => {
    if (pin.length !== 4) {
      setError('');
      setFoundTableId(null);
      return;
    }

    const result = store.verifyAndOccupyTableByCode(pin);

    if (result.success && result.tableId) {
      setError('');
      setFoundTableId(result.tableId);
      const timer = setTimeout(() => onCodeVerified(result.tableId as number), 700);
      return () => clearTimeout(timer);
    }

    setFoundTableId(null);
    setError(result.message || 'Code invalide. Vérifiez les 4 chiffres affichés sur votre table.');
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
      </div>
    </main>
  );
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

  // Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(appState.users[0]); // Default admin logged in
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Client Cart State
  const [cartItems, setCartItems] = useState<
    Array<{ menuItem: MenuItem; quantity: number; notes?: string }>
  >([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Theme & Audio Preferences
  const [darkMode, setDarkMode] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Detect URL parameters for Table access e.g. /table/3 or ?table=3&code=1001 or Waiter QR Login e.g. ?waiterPin=2001 or ?waiter=waiter-1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramTable = params.get('table');
    const paramCode = params.get('code');
    const paramWaiterPin = params.get('waiterPin');
    const paramWaiterId = params.get('waiter');

    // Waiter QR Code Login Detection
    if (paramWaiterPin || paramWaiterId) {
      const foundWaiter = appState.waiters.find(
        (w) => w.pinCode === paramWaiterPin || w.id === paramWaiterId
      );

      if (foundWaiter) {
        const waiterUser: User = {
          id: foundWaiter.id,
          name: foundWaiter.name,
          username: foundWaiter.id,
          role: 'serveur',
          phone: foundWaiter.phone,
          active: true,
        };
        setCurrentUser(waiterUser);
        setCurrentView('admin');
        setAdminTab('tables');
        return;
      }
    }

    // Client Table Access
    const path = window.location.pathname;
    const match = path.match(/\/table\/(\d+)/);

    let tableNum: number | null = null;
    if (match && match[1]) {
      tableNum = parseInt(match[1], 10);
    } else if (paramTable) {
      tableNum = parseInt(paramTable, 10);
    }

    if (tableNum && tableNum >= 1 && tableNum <= 10) {
      setSelectedTableId(tableNum);
      setCurrentView('client');

      if (paramCode) {
        const result = store.verifyAndOccupyTable(tableNum, paramCode);
        if (result.success) {
          setClientAccessGranted(true);
        }
      }
    }
  }, [appState.waiters]);

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

  const selectedTable =
    appState.tables.find((t) => t.id === selectedTableId) || appState.tables[0];
  const assignedWaiter = appState.waiters.find((w) => w.id === selectedTable?.assignedWaiterId);

  // Sécurité : une table n'est considérée "vérifiée" que lorsque le client a saisi
  // le bon code à 4 chiffres (ce qui passe son statut à 'occupee' côté store).
  // Tant que ce n'est pas le cas, aucune action d'écriture (panier, appel serveur,
  // addition) n'est autorisée — visiter /table/N sans le code ne suffit plus.
  const isSelectedTableVerified = selectedTable?.status === 'occupee';

  const activeOrderForTable = appState.orders.find(
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

  const handleSubmitClientOrder = () => {
    if (cartItems.length === 0 || !isSelectedTableVerified) return;
    store.createOrder(selectedTableId, cartItems);
    setCartItems([]);
  };

  const cartTotalSum = cartItems.reduce(
    (acc, i) =>
      acc + (i.menuItem.isPromo && i.menuItem.promoPrice ? i.menuItem.promoPrice : i.menuItem.price) * i.quantity,
    0
  );

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors`}>
      {/* Persistent Audio Siren Alarm Banner for Waiters and Admin ONLY */}
      {currentView === 'admin' && <AlarmBanner alarm={appState.activeAlarm} />}

      {/* Top Main Navigation Header */}
      <Header
        currentView={currentView}
        selectedTableId={selectedTableId}
        onSelectTable={(tId) => setSelectedTableId(tId)}
        onSwitchView={(v) => setCurrentView(v)}
        currentUser={currentUser}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={() => setCurrentUser(null)}
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
            onCodeVerified={(tableId) => {
              setSelectedTableId(tableId);
              setClientAccessGranted(true);
            }}
          />
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
            onTableIdentified={(tId) => {
              setSelectedTableId(tId);
              setClientAccessGranted(true);
            }}
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
          />
        </main>
        )
      ) : (
        /* Staff & Admin Interface Layout */
        <AdminLayout
          activeTab={adminTab}
          onTabChange={(tab) => setAdminTab(tab)}
          currentUser={currentUser || appState.users[0]}
          onLogout={() => setCurrentUser(null)}
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
              onUpdateStatus={(tId, st) => store.updateTableStatus(tId, st)}
              onAssignWaiter={(tId, wId) => store.assignWaiterToTable(tId, wId)}
              onMoveOrder={(fromId, toId) => store.moveOrderBetweenTables(fromId, toId)}
              onMergeTables={(srcId, tgtId) => store.mergeTables(srcId, tgtId)}
              onConfirmOrder={(oId) => store.confirmOrder(oId, currentUser?.id)}
              onOpenCashierForTable={(tId) => {
                setSelectedTableId(tId);
                setAdminTab('cashier');
              }}
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
              onAddCategory={(name) => store.addCategory(name)}
              onDeleteCategory={(id) => store.deleteCategory(id)}
              onAddMenuItem={(item) => store.addMenuItem(item)}
              onUpdateMenuItem={(id, updates) => store.updateMenuItem(id, updates)}
              onDeleteMenuItem={(id) => store.deleteMenuItem(id)}
              onToggleAvailability={(id) => store.toggleItemAvailability(id)}
            />
          )}

          {adminTab === 'waiters' && (
            <WaitersView
              waiters={appState.waiters}
              onAddWaiter={(w) => store.addWaiter(w)}
              onUpdateWaiter={(id, up) => store.updateWaiter(id, up)}
              onDeleteWaiter={(id) => store.deleteWaiter(id)}
            />
          )}

          {adminTab === 'reservations' && (
            <ReservationsView
              reservations={appState.reservations}
              tables={appState.tables}
              onAddReservation={(r) => store.addReservation(r)}
              onCancelReservation={(id) => store.cancelReservation(id)}
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
        </AdminLayout>
      )}

      {/* Password-protected Staff Login Dialog */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        users={appState.users}
        onLoginSuccess={(u) => {
          setCurrentUser(u);
          setCurrentView('admin');
        }}
      />
    </div>
  );
}
