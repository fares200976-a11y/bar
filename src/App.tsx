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

export default function App() {
  const [appState, setAppState] = useState(store.getState());

  // Navigation & View state
  const [currentView, setCurrentView] = useState<'client' | 'admin'>('client');
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [selectedTableId, setSelectedTableId] = useState<number>(1);

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
        store.verifyAndOccupyTable(tableNum, paramCode);
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

  const activeOrderForTable = appState.orders.find(
    (o) => o.tableId === selectedTableId && o.status !== 'terminee' && o.status !== 'annulee'
  );

  // Cart operations
  const handleAddToCart = (item: MenuItem, quantity: number, notes?: string) => {
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
    if (cartItems.length === 0) return;
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
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <ClientMenuView
            table={selectedTable}
            categories={appState.categories}
            menu={appState.menu}
            activeOrder={activeOrderForTable}
            waiter={assignedWaiter}
            settings={appState.settings}
            onAddToCart={handleAddToCart}
            onCallWaiter={() => store.callWaiter(selectedTableId)}
            onRequestBill={() => store.requestBill(selectedTableId)}
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
            onCallWaiter={() => store.callWaiter(selectedTableId)}
            onRequestBill={() => store.requestBill(selectedTableId)}
          />
        </main>
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
              onUpdateStatus={(tId, st) => store.updateTableStatus(tId, st)}
              onAssignWaiter={(tId, wId) => store.assignWaiterToTable(tId, wId)}
              onMoveOrder={(fromId, toId) => store.moveOrderBetweenTables(fromId, toId)}
              onMergeTables={(srcId, tgtId) => store.mergeTables(srcId, tgtId)}
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
