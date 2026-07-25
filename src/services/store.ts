import {
  Table,
  MenuItem,
  Category,
  Order,
  OrderItem,
  Bill,
  Reservation,
  Waiter,
  User,
  RestaurantSettings,
  CallNotification,
  ActiveAlarm,
  OrderStatus,
  PaymentMethod,
  PaymentBreakdown
} from '../types';
import {
  INITIAL_CATEGORIES,
  INITIAL_MENU,
  INITIAL_TABLES,
  INITIAL_WAITERS,
  INITIAL_USERS,
  INITIAL_SETTINGS
} from '../data/initialData';
import { startContinuousAlarm, stopContinuousAlarm } from '../utils/audioAlarm';

const STORAGE_KEY = 'resto_bar_app_v2';
const CHANNEL_NAME = 'resto_bar_sync_channel';

interface AppState {
  categories: Category[];
  menu: MenuItem[];
  tables: Table[];
  orders: Order[];
  bills: Bill[];
  reservations: Reservation[];
  waiters: Waiter[];
  users: User[];
  settings: RestaurantSettings;
  notifications: CallNotification[];
  activeAlarm: ActiveAlarm | null;
}

// BroadcastChannel for instant cross-tab live updates
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
}

// Load initial state or local storage state
function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        categories: parsed.categories || INITIAL_CATEGORIES,
        menu: parsed.menu || INITIAL_MENU,
        tables: parsed.tables || INITIAL_TABLES,
        orders: parsed.orders || [],
        bills: parsed.bills || [],
        reservations: parsed.reservations || [],
        waiters: parsed.waiters || INITIAL_WAITERS,
        users: parsed.users || INITIAL_USERS,
        settings: parsed.settings || INITIAL_SETTINGS,
        notifications: parsed.notifications || [],
        activeAlarm: parsed.activeAlarm || null,
      };
    }
  } catch (err) {
    console.error('Error loading state from localStorage:', err);
  }

  return {
    categories: INITIAL_CATEGORIES,
    menu: INITIAL_MENU,
    tables: INITIAL_TABLES,
    orders: [],
    bills: [],
    reservations: [],
    waiters: INITIAL_WAITERS,
    users: INITIAL_USERS,
    settings: INITIAL_SETTINGS,
    notifications: [],
    activeAlarm: null,
  };
}

let state: AppState = loadState();
type Listener = (state: AppState) => void;
const listeners = new Set<Listener>();

// Mémorise l'id de la dernière alarme pour laquelle le son a été (re)lancé,
// afin de ne PAS relancer l'audio depuis zéro à chaque action du store
// (ex : changer un plat de disponibilité) alors que l'alarme est déjà en cours.
let lastSyncedAlarmId: string | null = null;

function syncAlarmAudio() {
  const currentAlarmId = state.activeAlarm?.id ?? null;

  if (currentAlarmId && state.settings.enableLoopAlarm !== false) {
    if (currentAlarmId !== lastSyncedAlarmId) {
      // Nouvelle alarme (ou premier chargement) : on (re)démarre le son en boucle.
      lastSyncedAlarmId = currentAlarmId;
      startContinuousAlarm(
        state.settings.alarmSoundType || 'mp3_alarm_clock',
        state.settings.customAudioUrl || '',
        state.settings.alarmVolume ?? 0.8
      );
    }
    // Sinon : c'est toujours la même alarme, on laisse la boucle déjà en cours
    // continuer sans la relancer.
  } else {
    lastSyncedAlarmId = null;
    stopContinuousAlarm();
  }
}

// Initial audio sync
syncAlarmAudio();

function saveStateAndNotify(triggerBroadcast = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
  syncAlarmAudio();
  listeners.forEach((listener) => listener(state));
  if (triggerBroadcast && broadcastChannel) {
    broadcastChannel.postMessage('STATE_UPDATED');
  }
}

// Listen for cross-tab messages
if (broadcastChannel) {
  broadcastChannel.onmessage = (event) => {
    if (event.data === 'STATE_UPDATED') {
      state = loadState();
      syncAlarmAudio();
      listeners.forEach((listener) => listener(state));
    }
  };
}

export function generateRandom4DigitPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function playDoubleBeepSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // First beep
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.1);

    // Second beep (2bip)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.14);
    gain2.gain.setValueAtTime(0.4, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.24);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.24);
  } catch (e) {
    console.warn('Double beep audio error:', e);
  }
}

// Sound chime generator using Web Audio API (no external file dependency needed!)
export function playChimeSound(type: 'order' | 'ready' | 'call' = 'order') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'order') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'ready') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24); // G5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, ctx.currentTime);
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // Audio Context might be restricted before user interaction
  }
}

export const store = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState(): AppState {
    return state;
  },

  // --- MENU & CATEGORIES ---
  addCategory(name: string, icon?: string) {
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name,
      icon,
      order: state.categories.length + 1,
    };
    state.categories = [...state.categories, newCat];
    saveStateAndNotify();
  },

  deleteCategory(catId: string) {
    state.categories = state.categories.filter((c) => c.id !== catId);
    saveStateAndNotify();
  },

  addMenuItem(item: Omit<MenuItem, 'id'>) {
    const newItem: MenuItem = {
      ...item,
      id: `item-${Date.now()}`,
    };
    state.menu = [...state.menu, newItem];
    saveStateAndNotify();
  },

  updateMenuItem(id: string, updates: Partial<MenuItem>) {
    state.menu = state.menu.map((item) => (item.id === id ? { ...item, ...updates } : item));
    saveStateAndNotify();
  },

  deleteMenuItem(id: string) {
    state.menu = state.menu.filter((item) => item.id !== id);
    saveStateAndNotify();
  },

  toggleItemAvailability(id: string) {
    state.menu = state.menu.map((item) =>
      item.id === id ? { ...item, isAvailable: !item.isAvailable } : item
    );
    saveStateAndNotify();
  },

  // --- TABLES ---
  updateTableStatus(tableId: number, status: Table['status']) {
    state.tables = state.tables.map((t) => {
      if (t.id === tableId) {
        // Automatically regenerate 4-digit PIN code when table becomes free (libre)
        const newPin = status === 'libre' ? generateRandom4DigitPin() : (t.accessCode || generateRandom4DigitPin());
        return { ...t, status, accessCode: newPin };
      }
      return t;
    });
    saveStateAndNotify();
  },

  verifyAndOccupyTable(tableId: number, code: string): { success: boolean; message: string } {
    const table = state.tables.find((t) => t.id === tableId);
    if (!table) {
      return { success: false, message: 'Table introuvable.' };
    }

    const enteredCode = code.trim();
    if (table.accessCode && table.accessCode !== enteredCode) {
      return { success: false, message: 'Code à 4 chiffres incorrect pour cette table.' };
    }

    // Set table status to 'occupee'
    const wasLibre = table.status === 'libre';
    state.tables = state.tables.map((t) =>
      t.id === tableId ? { ...t, status: 'occupee' } : t
    );

    // Play double beep sound alert for waiter & admin
    playDoubleBeepSound();

    this.addNotification(
      tableId,
      'waiter_call',
      `Table ${tableId} scannée et activée (Occupée) via le Code QR [${enteredCode || table.accessCode}]`
    );

    // Persistent siren alarm so waiters & admin notice even if not looking at the screen
    if (wasLibre) {
      state.activeAlarm = {
        id: `alarm-${Date.now()}`,
        tableId,
        message: `Table ${tableId} activée par un client (Scan QR Code)`,
        type: 'waiter_call',
        timestamp: new Date().toISOString(),
      };
    }

    saveStateAndNotify();
    return {
      success: true,
      message: wasLibre
        ? `Table ${tableId} activée avec succès ! Statut changé en OCCUPÉE.`
        : `Accès validé pour la Table ${tableId}.`,
    };
  },

  // Used on the client landing page: the client only knows their table's 4-digit code,
  // not which "table number" is currently selected in the app, so we search across ALL
  // tables for a match instead of requiring a table to be pre-selected first.
  verifyAndOccupyTableByCode(code: string): { success: boolean; message: string; tableId?: number } {
    const enteredCode = code.trim();
    if (enteredCode.length !== 4) {
      return { success: false, message: 'Veuillez saisir les 4 chiffres du code affiché sur votre table.' };
    }

    const table = state.tables.find((t) => t.accessCode === enteredCode);
    if (!table) {
      return { success: false, message: "Code invalide. Vérifiez le code à 4 chiffres affiché sur votre table." };
    }

    const wasLibre = table.status === 'libre';
    state.tables = state.tables.map((t) =>
      t.id === table.id ? { ...t, status: 'occupee' } : t
    );

    playDoubleBeepSound();

    this.addNotification(
      table.id,
      'waiter_call',
      `Table ${table.id} scannée et activée (Occupée) via le Code [${enteredCode}]`
    );

    if (wasLibre) {
      state.activeAlarm = {
        id: `alarm-${Date.now()}`,
        tableId: table.id,
        message: `Table ${table.id} activée par un client (Code saisi)`,
        type: 'waiter_call',
        timestamp: new Date().toISOString(),
      };
    }

    saveStateAndNotify();
    return {
      success: true,
      tableId: table.id,
      message: wasLibre
        ? `Table ${table.id} activée avec succès ! Statut changé en OCCUPÉE.`
        : `Accès validé pour la Table ${table.id}.`,
    };
  },

  regenerateTablePin(tableId: number): string {
    const newPin = generateRandom4DigitPin();
    state.tables = state.tables.map((t) =>
      t.id === tableId ? { ...t, accessCode: newPin } : t
    );
    saveStateAndNotify();
    return newPin;
  },

  assignWaiterToTable(tableId: number, waiterId: string | undefined) {
    state.tables = state.tables.map((t) =>
      t.id === tableId ? { ...t, assignedWaiterId: waiterId } : t
    );
    saveStateAndNotify();
  },

  moveOrderBetweenTables(fromTableId: number, toTableId: number) {
    const activeOrder = state.orders.find(
      (o) => o.tableId === fromTableId && o.status !== 'terminee' && o.status !== 'annulee'
    );
    if (!activeOrder) return false;

    // Update order tableId
    state.orders = state.orders.map((o) =>
      o.id === activeOrder.id ? { ...o, tableId: toTableId } : o
    );

    // Update source table to libre, target table to commande_en_cours
    const fromTableObj = state.tables.find((t) => t.id === fromTableId);
    state.tables = state.tables.map((t) => {
      if (t.id === fromTableId) return { ...t, status: 'libre', activeOrderId: undefined };
      if (t.id === toTableId) return { ...t, status: 'commande_en_cours', activeOrderId: activeOrder.id };
      return t;
    });

    this.addNotification(toTableId, 'new_order', `Commande transférée de Table ${fromTableId} vers Table ${toTableId}`);
    saveStateAndNotify();
    return true;
  },

  mergeTables(sourceTableId: number, targetTableId: number) {
    const sourceOrder = state.orders.find(
      (o) => o.tableId === sourceTableId && o.status !== 'terminee' && o.status !== 'annulee'
    );
    const targetOrder = state.orders.find(
      (o) => o.tableId === targetTableId && o.status !== 'terminee' && o.status !== 'annulee'
    );

    if (!sourceOrder) return false;

    if (!targetOrder) {
      // Just move source order to target
      return this.moveOrderBetweenTables(sourceTableId, targetTableId);
    }

    // Combine items into target order
    const mergedItems = [...targetOrder.items, ...sourceOrder.items];
    state.orders = state.orders.map((o) => {
      if (o.id === targetOrder.id) {
        return {
          ...o,
          items: mergedItems,
          updatedAt: new Date().toISOString(),
        };
      }
      if (o.id === sourceOrder.id) {
        return {
          ...o,
          status: 'annulee',
          specialRequests: `Fusionnée avec Table ${targetTableId}`,
        };
      }
      return o;
    });

    state.tables = state.tables.map((t) => {
      if (t.id === sourceTableId) return { ...t, status: 'libre', activeOrderId: undefined };
      return t;
    });

    this.addNotification(targetTableId, 'new_order', `Tables ${sourceTableId} et ${targetTableId} fusionnées!`);
    saveStateAndNotify();
    return true;
  },

  // --- ORDERS ---
  createOrder(tableId: number, items: Array<{ menuItem: MenuItem; quantity: number; notes?: string }>): Order {
    const newOrderNumber = state.orders.length + 101;
    const tableObj = state.tables.find((t) => t.id === tableId);

    const orderItems = items.map((i, idx) => ({
      id: `oi-${Date.now()}-${idx}`,
      menuItemId: i.menuItem.id,
      name: i.menuItem.name,
      unitPrice: i.menuItem.isPromo && i.menuItem.promoPrice ? i.menuItem.promoPrice : i.menuItem.price,
      quantity: i.quantity,
      notes: i.notes,
      status: 'nouvelle' as const,
    }));

    // Deduct stock quantity automatically
    state.menu = state.menu.map((menuItem) => {
      const ordered = items.find((i) => i.menuItem.id === menuItem.id);
      if (ordered) {
        const remaining = Math.max(0, menuItem.stockQuantity - ordered.quantity);
        return {
          ...menuItem,
          stockQuantity: remaining,
          isAvailable: remaining > 0,
        };
      }
      return menuItem;
    });

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: newOrderNumber,
      tableId,
      waiterId: tableObj?.assignedWaiterId,
      items: orderItems,
      status: 'en_attente_validation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    state.orders = [newOrder, ...state.orders];

    // Set table status to 'commande_en_cours'
    state.tables = state.tables.map((t) =>
      t.id === tableId ? { ...t, status: 'commande_en_cours', activeOrderId: newOrder.id } : t
    );

    this.addNotification(
      tableId,
      'new_order',
      `Nouvelle commande (#${newOrderNumber}) pour Table ${tableId} — en attente de validation du serveur`
    );
    playChimeSound('order');

    // Trigger persistent audio alarm for waiters and admin until manually stopped
    // (ou jusqu'à ce que le serveur confirme la commande, voir confirmOrder ci-dessous)
    state.activeAlarm = {
      id: `alarm-${Date.now()}`,
      tableId,
      orderNumber: newOrderNumber,
      message: `Commande Table ${tableId} (#${newOrderNumber}) à valider par le serveur`,
      type: 'new_order',
      timestamp: new Date().toISOString(),
    };

    saveStateAndNotify();
    return newOrder;
  },

  // Le serveur (ou l'admin) confirme la commande passée par le client : elle devient
  // alors visible en cuisine ('nouvelle') et l'alarme liée est coupée puisqu'un humain
  // vient d'en prendre la responsabilité.
  confirmOrder(orderId: string, waiterId?: string): boolean {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order || order.status !== 'en_attente_validation') return false;

    state.orders = state.orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: 'nouvelle',
            waiterId: waiterId || o.waiterId,
            confirmedByWaiterId: waiterId,
            confirmedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : o
    );

    this.addNotification(
      order.tableId,
      'new_order',
      `Commande #${order.orderNumber} confirmée — transmise en cuisine (Table ${order.tableId})`
    );

    // Si l'alarme active correspond bien à cette commande, on l'éteint : la confirmation
    // du serveur vaut prise en charge.
    if (
      state.activeAlarm &&
      state.activeAlarm.tableId === order.tableId &&
      state.activeAlarm.orderNumber === order.orderNumber
    ) {
      state.activeAlarm = null;
    }

    saveStateAndNotify();
    return true;
  },

  updateOrderStatus(orderId: string, status: OrderStatus) {
    const existingOrder = state.orders.find((o) => o.id === orderId);
    if (!existingOrder) return;

    state.orders = state.orders.map((o) => {
      if (o.id === orderId) {
        const updatedItems = o.items.map((item) => ({
          ...item,
          status: status === 'prete' ? ('prete' as const) : status === 'servie' ? ('servie' as const) : item.status,
        }));
        return {
          ...o,
          status,
          items: updatedItems,
          updatedAt: new Date().toISOString(),
        };
      }
      return o;
    });

    if (status === 'prete') {
      this.addNotification(existingOrder.tableId, 'kitchen_ready', `Plat(s) PRÊT(S) pour Table ${existingOrder.tableId}!`);
      playChimeSound('ready');
    }

    saveStateAndNotify();
  },

  updateOrderItemStatus(orderId: string, itemId: string, itemStatus: OrderItem['status']) {
    state.orders = state.orders.map((o) => {
      if (o.id === orderId) {
        const items = o.items.map((i) => (i.id === itemId ? { ...i, status: itemStatus } : i));
        // If all items are prete, mark overall order prete
        const allPrete = items.every((i) => i.status === 'prete' || i.status === 'servie' || i.status === 'annulee');
        return {
          ...o,
          items,
          status: allPrete ? 'prete' : o.status,
          updatedAt: new Date().toISOString(),
        };
      }
      return o;
    });
    saveStateAndNotify();
  },

  callWaiter(tableId: number) {
    state.orders = state.orders.map((o) =>
      o.tableId === tableId && o.status !== 'terminee' ? { ...o, callWaiterRequest: true } : o
    );
    this.addNotification(tableId, 'waiter_call', `Appel Serveur à la Table ${tableId}`);
    playChimeSound('call');

    state.activeAlarm = {
      id: `alarm-${Date.now()}`,
      tableId,
      message: `Appel serveur Table ${tableId}`,
      type: 'waiter_call',
      timestamp: new Date().toISOString(),
    };

    saveStateAndNotify();
  },

  requestBill(tableId: number) {
    state.orders = state.orders.map((o) =>
      o.tableId === tableId && o.status !== 'terminee'
        ? { ...o, requestBill: true, billRequestedAt: new Date().toISOString() }
        : o
    );
    this.addNotification(tableId, 'bill_request', `Table ${tableId} demande L'ADDITION!`);
    playChimeSound('call');

    state.activeAlarm = {
      id: `alarm-${Date.now()}`,
      tableId,
      message: `Demande d'addition Table ${tableId}`,
      type: 'bill_request',
      timestamp: new Date().toISOString(),
    };

    saveStateAndNotify();
  },

  stopAlarm() {
    state.activeAlarm = null;
    stopContinuousAlarm();
    saveStateAndNotify();
  },

  dismissTableCall(tableId: number) {
    state.orders = state.orders.map((o) =>
      o.tableId === tableId ? { ...o, callWaiterRequest: false, requestBill: false } : o
    );
    saveStateAndNotify();
  },

  // --- BILLS & PAYMENTS ---
  processBillPayment(
    orderId: string,
    paymentMethod: PaymentMethod,
    discountAmount = 0,
    cashReceived = 0,
    paymentsBreakdown?: PaymentBreakdown[],
    processedUserId?: string
  ): Bill | null {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return null;

    const subtotal = order.items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
    const taxRate = state.settings.vatRate ?? 0;
    const serviceRate = state.settings.serviceRate ?? 0;

    const taxAmount = (subtotal * taxRate) / 100;
    const serviceAmount = (subtotal * serviceRate) / 100;
    const total = Math.max(0, subtotal + taxAmount + serviceAmount - discountAmount);

    const changeGiven = cashReceived > total ? cashReceived - total : 0;

    const newBill: Bill = {
      id: `bill-${Date.now()}`,
      orderId: order.id,
      tableId: order.tableId,
      subtotal,
      taxRate,
      taxAmount,
      serviceRate,
      serviceAmount,
      discountAmount,
      total,
      paymentMethod,
      paymentsBreakdown,
      cashReceived: cashReceived || undefined,
      changeGiven: changeGiven || undefined,
      paidAt: new Date().toISOString(),
      processedByUserId: processedUserId,
    };

    state.bills = [newBill, ...state.bills];

    // Mark order as terminee
    state.orders = state.orders.map((o) => (o.id === orderId ? { ...o, status: 'terminee' } : o));

    // Release table and automatically change its 4-digit code
    state.tables = state.tables.map((t) =>
      t.id === order.tableId
        ? {
            ...t,
            status: 'libre',
            activeOrderId: undefined,
            accessCode: generateRandom4DigitPin(),
          }
        : t
    );

    saveStateAndNotify();
    return newBill;
  },

  // --- RESERVATION ---
  addReservation(res: Omit<Reservation, 'id'>) {
    const newRes: Reservation = {
      ...res,
      id: `res-${Date.now()}`,
    };
    state.reservations = [...state.reservations, newRes];

    // Mark table reserved if same day
    state.tables = state.tables.map((t) =>
      t.id === res.tableId ? { ...t, status: 'reservee' } : t
    );

    saveStateAndNotify();
  },

  cancelReservation(id: string) {
    state.reservations = state.reservations.map((r) =>
      r.id === id ? { ...r, status: 'annulée' } : r
    );
    saveStateAndNotify();
  },

  // --- WAITERS & USERS ---
  addWaiter(waiter: Omit<Waiter, 'id'>) {
    const newWaiter: Waiter = {
      ...waiter,
      id: `waiter-${Date.now()}`,
    };
    state.waiters = [...state.waiters, newWaiter];
    saveStateAndNotify();
  },

  updateWaiter(id: string, updates: Partial<Waiter>) {
    state.waiters = state.waiters.map((w) => (w.id === id ? { ...w, ...updates } : w));
    saveStateAndNotify();
  },

  deleteWaiter(id: string) {
    state.waiters = state.waiters.filter((w) => w.id !== id);
    saveStateAndNotify();
  },

  addUser(user: Omit<User, 'id'>) {
    const newUser: User = {
      ...user,
      id: `u-${Date.now()}`,
    };
    state.users = [...state.users, newUser];
    saveStateAndNotify();
  },

  updateUser(id: string, updates: Partial<User>) {
    state.users = state.users.map((u) => (u.id === id ? { ...u, ...updates } : u));
    saveStateAndNotify();
  },

  deleteUser(id: string) {
    state.users = state.users.filter((u) => u.id !== id);
    saveStateAndNotify();
  },

  // --- SETTINGS ---
  updateSettings(updates: Partial<RestaurantSettings>) {
    state.settings = { ...state.settings, ...updates };
    saveStateAndNotify();
  },

  // --- NOTIFICATIONS ---
  addNotification(tableId: number, type: CallNotification['type'], message: string) {
    const newNotif: CallNotification = {
      id: `notif-${Date.now()}`,
      tableId,
      type,
      message,
      timestamp: new Date().toISOString(),
      read: false,
    };
    state.notifications = [newNotif, ...state.notifications].slice(0, 30);
  },

  clearNotifications() {
    state.notifications = [];
    saveStateAndNotify();
  },

  deleteNotification(id: string) {
    state.notifications = state.notifications.filter((n) => n.id !== id);
    saveStateAndNotify();
  },

  resetToDefaultData() {
    state = {
      categories: INITIAL_CATEGORIES,
      menu: INITIAL_MENU,
      tables: INITIAL_TABLES,
      orders: [],
      bills: [],
      reservations: [],
      waiters: INITIAL_WAITERS,
      users: INITIAL_USERS,
      settings: INITIAL_SETTINGS,
      notifications: [],
      activeAlarm: null,
    };
    saveStateAndNotify();
  },
};
