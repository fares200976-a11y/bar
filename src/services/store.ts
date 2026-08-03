import { supabase } from './supabaseClient';
import {
  Table,
  TableStatus,
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
  PaymentBreakdown,
  CashRegisterClosing,
} from '../types';
import { startContinuousAlarm, stopContinuousAlarm } from '../utils/audioAlarm';

// ============================================================================
// store.ts — désormais branché sur Supabase (Postgres + Realtime) au lieu de
// localStorage. L'interface publique (subscribe/getState/méthodes) reste la
// même qu'avant pour limiter les changements dans les composants existants,
// mais TOUTES les méthodes sont maintenant asynchrones (elles retournent des
// Promises), puisqu'elles appellent le réseau.
//
// Sécurité : toute action sensible (occuper une table, commander, encaisser,
// changer un statut...) passe par une fonction RPC Postgres (voir
// supabase/migrations/0002 et 0004) qui vérifie elle-même le rôle de
// l'utilisateur connecté — jamais uniquement par une policy RLS générique.
// ============================================================================

interface AppState {
  loaded: boolean;
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
  cashRegisterClosings: CashRegisterClosing[];
  isOffline: boolean;
  isUsingCachedData: boolean;
  pendingOfflineOrders: number;
}

const DEFAULT_SETTINGS: RestaurantSettings = {
  name: 'Chargement...',
  logo: '',
  address: '',
  phone: '',
  email: '',
  openingHours: '',
  currency: 'DA',
  vatRate: 0,
  serviceRate: 0,
  primaryColor: '#5A5A40',
  bgStyle: 'clean',
  enableLoopAlarm: true,
  alarmVolume: 0.8,
};

let state: AppState = {
  loaded: false,
  categories: [],
  menu: [],
  tables: [],
  orders: [],
  bills: [],
  reservations: [],
  waiters: [],
  users: [],
  settings: DEFAULT_SETTINGS,
  notifications: [],
  activeAlarm: null,
  cashRegisterClosings: [],
  isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  isUsingCachedData: false,
  pendingOfflineOrders: 0,
};

// ----------------------------------------------------------------------------
// Mode hors-ligne : sauvegarde locale de secours (menu/tables/réglages) pour
// que le client puisse au moins CONSULTER le menu sans connexion, et file
// d'attente des commandes passées hors-ligne — envoyées automatiquement dès
// le retour de la connexion (voir flushOfflineOrderQueue).
// ----------------------------------------------------------------------------
const OFFLINE_CACHE_KEY = 'bar_offline_cache_v1';
const OFFLINE_QUEUE_KEY = 'bar_offline_order_queue_v1';

interface OfflineCache {
  categories: Category[];
  menu: MenuItem[];
  tables: Table[];
  settings: RestaurantSettings;
  savedAt: string;
}

interface QueuedOrder {
  id: string;
  tableId: number;
  items: Array<{ menuItemId: string; quantity: number; notes?: string; weightGrams?: number }>;
  queuedAt: string;
}

function saveOfflineCache() {
  try {
    const cache: OfflineCache = {
      categories: state.categories,
      menu: state.menu,
      tables: state.tables,
      settings: state.settings,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // stockage plein ou indisponible — pas grave, juste pas de secours hors-ligne cette fois
  }
}

function loadOfflineCache(): OfflineCache | null {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as OfflineCache) : null;
  } catch {
    return null;
  }
}

function getOfflineQueue(): QueuedOrder[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedOrder[]) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: QueuedOrder[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

// Envoie automatiquement toutes les commandes mises en attente pendant une
// coupure Internet, dès que la connexion revient.
async function flushOfflineOrderQueue() {
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  const remaining: QueuedOrder[] = [];
  for (const queued of queue) {
    const { error } = await supabase.rpc('create_client_order', {
      p_table_id: queued.tableId,
      p_items: queued.items,
    });
    if (error) {
      remaining.push(queued);
    }
  }
  saveOfflineQueue(remaining);
  state = { ...state, pendingOfflineOrders: remaining.length };
  notify();
  await fetchAll();
}

if (typeof window !== 'undefined') {
  state.pendingOfflineOrders = getOfflineQueue().length;

  window.addEventListener('online', () => {
    state = { ...state, isOffline: false };
    notify();
    flushOfflineOrderQueue();
    fetchAll();
  });

  window.addEventListener('offline', () => {
    state = { ...state, isOffline: true };
    notify();
  });
}

type Listener = (state: AppState) => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener(state));
}

// ----------------------------------------------------------------------------
// Audio : alarme en boucle (identique à avant), + sons ponctuels réactifs aux
// nouvelles notifications détectées après chaque rafraîchissement.
// ----------------------------------------------------------------------------

let lastSyncedAlarmId: string | null = null;

function syncAlarmAudio() {
  const currentAlarmId = state.activeAlarm?.id ?? null;

  if (currentAlarmId && state.settings.enableLoopAlarm !== false) {
    if (currentAlarmId !== lastSyncedAlarmId) {
      lastSyncedAlarmId = currentAlarmId;
      startContinuousAlarm(
        state.settings.alarmSoundType || 'mp3_alarm_clock',
        state.settings.customAudioUrl || '',
        state.settings.alarmVolume ?? 0.8
      );
    }
  } else {
    lastSyncedAlarmId = null;
    stopContinuousAlarm();
  }
}

let knownNotificationIds = new Set<string>();
let isFirstFetch = true;

function playSoundsForNewNotifications(newNotifications: CallNotification[]) {
  if (isFirstFetch) {
    // Au tout premier chargement, on ne joue aucun son pour l'historique existant.
    knownNotificationIds = new Set(newNotifications.map((n) => n.id));
    isFirstFetch = false;
    return;
  }

  const freshOnes = newNotifications.filter((n) => !knownNotificationIds.has(n.id));
  freshOnes.forEach((n) => {
    if (n.type === 'kitchen_ready') playChimeSound('ready');
    else if (n.type === 'new_order') playChimeSound('order');
    else playChimeSound('call');
  });
  knownNotificationIds = new Set(newNotifications.map((n) => n.id));
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
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'ready') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, ctx.currentTime);
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // Contexte audio parfois restreint avant une interaction utilisateur.
  }
}

// ----------------------------------------------------------------------------
// Mapping lignes Supabase (snake_case) -> types applicatifs (camelCase)
// ----------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? undefined,
    order: row.sort_order,
    section: row.section === 'bar' ? 'bar' : 'food',
  };
}

function mapMenuItem(row: any): MenuItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description ?? '',
    price: Number(row.price),
    images: row.images || [],
    videoUrl: row.video_url ?? undefined,
    prepTimeMinutes: row.prep_time_minutes,
    isAvailable: row.is_available,
    stockQuantity: row.stock_quantity,
    isPromo: row.is_promo ?? undefined,
    promoPrice: row.promo_price != null ? Number(row.promo_price) : undefined,
    isRecommended: row.is_recommended ?? undefined,
    isSpicy: row.is_spicy ?? undefined,
    allergens: row.allergens || [],
    dietaryLabels: row.dietary_labels || [],
    translations: row.translations || {},
    barcode: row.barcode ?? undefined,
    isPlatDuJour: row.is_plat_du_jour ?? false,
    isPricedByWeight: row.is_priced_by_weight ?? false,
  };
}

function mapTable(row: any): Table {
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    status: row.status,
    seats: row.seats,
    accessCode: row.access_code ?? undefined,
    assignedWaiterId: row.assigned_waiter_id ?? undefined,
    activeOrderId: row.active_order_id ?? undefined,
    occupiedSince: row.occupied_since ?? undefined,
    clientName: row.client_name ?? undefined,
  };
}

function mapOrderItem(row: any): OrderItem {
  return {
    id: row.id,
    menuItemId: row.menu_item_id,
    name: row.name,
    unitPrice: Number(row.unit_price),
    quantity: row.quantity,
    notes: row.notes ?? undefined,
    status: row.status,
    weightGrams: row.weight_grams ?? undefined,
  };
}

function mapOrder(row: any, items: any[]): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    tableId: row.table_id,
    waiterId: row.waiter_id ?? undefined,
    items: items.map(mapOrderItem),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    specialRequests: row.special_requests ?? undefined,
    callWaiterRequest: row.call_waiter_request ?? undefined,
    requestBill: row.request_bill ?? undefined,
    billRequestedAt: row.bill_requested_at ?? undefined,
    confirmedByWaiterId: row.confirmed_by_waiter_id ?? undefined,
    confirmedAt: row.confirmed_at ?? undefined,
    orderType: row.order_type ?? 'sur_place',
  };
}

function mapBill(row: any): Bill {
  return {
    id: row.id,
    orderId: row.order_id,
    tableId: row.table_id,
    subtotal: Number(row.subtotal),
    taxRate: Number(row.tax_rate),
    taxAmount: Number(row.tax_amount),
    serviceRate: Number(row.service_rate),
    serviceAmount: Number(row.service_amount),
    discountAmount: Number(row.discount_amount),
    total: Number(row.total),
    paymentMethod: row.payment_method,
    paymentsBreakdown: row.payments_breakdown ?? undefined,
    cashReceived: row.cash_received != null ? Number(row.cash_received) : undefined,
    changeGiven: row.change_given != null ? Number(row.change_given) : undefined,
    paidAt: row.paid_at,
    processedByUserId: row.processed_by_user_id ?? undefined,
  };
}

function mapReservation(row: any): Reservation {
  return {
    id: row.id,
    tableId: row.table_id ?? undefined,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    guestCount: row.guest_count,
    dateTime: row.date_time,
    notes: row.notes ?? undefined,
    status: row.status,
  };
}

function mapProfileToUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    phone: row.phone ?? undefined,
    avatar: row.avatar ?? undefined,
    active: row.active,
  };
}

const DEFAULT_WAITER_AVATAR =
  'https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=200&q=80';

function deriveWaiters(profileRows: any[], tables: Table[]): Waiter[] {
  return profileRows
    .filter((p) => p.role === 'serveur')
    .map((p) => ({
      id: p.id,
      name: p.name,
      photo: p.avatar || DEFAULT_WAITER_AVATAR,
      phone: p.phone || '',
      pinCode: p.pin_code ?? undefined,
      isOnline: p.is_online,
      assignedTableIds: tables.filter((t) => t.assignedWaiterId === p.id).map((t) => t.id),
    }));
}

function mapSettings(row: any): RestaurantSettings {
  return {
    name: row.name,
    logo: row.logo ?? '',
    address: row.address ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    openingHours: row.opening_hours ?? '',
    currency: row.currency,
    vatRate: Number(row.vat_rate),
    serviceRate: Number(row.service_rate),
    primaryColor: row.primary_color,
    bgStyle: row.bg_style,
    cloudinaryCloudName: row.cloudinary_cloud_name ?? undefined,
    alarmSoundType: row.alarm_sound_type ?? undefined,
    customAudioUrl: row.custom_audio_url ?? undefined,
    enableLoopAlarm: row.enable_loop_alarm,
    alarmVolume: row.alarm_volume != null ? Number(row.alarm_volume) : undefined,
    latitude: row.latitude != null ? Number(row.latitude) : undefined,
    longitude: row.longitude != null ? Number(row.longitude) : undefined,
  };
}

function mapNotification(row: any): CallNotification {
  return {
    id: row.id,
    tableId: row.table_id,
    type: row.type,
    message: row.message,
    timestamp: row.created_at,
    read: row.read,
  };
}

function mapActiveAlarm(row: any): ActiveAlarm | null {
  if (!row || !row.table_id) return null;
  return {
    id: row.created_at || `alarm-${row.table_id}`,
    tableId: row.table_id,
    orderNumber: row.order_number ?? undefined,
    message: row.message || '',
    type: row.type,
    timestamp: row.created_at,
  };
}

function mapCashRegisterClosing(row: any): CashRegisterClosing {
  return {
    id: row.id,
    closedByUserId: row.closed_by ?? undefined,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    openingFloat: Number(row.opening_float),
    expectedCash: Number(row.expected_cash),
    declaredCash: Number(row.declared_cash),
    difference: Number(row.difference),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ----------------------------------------------------------------------------
// Chargement complet de l'état depuis Supabase
// ----------------------------------------------------------------------------

let fetchInFlight: Promise<void> | null = null;

// Enregistre une commande client localement (pas encore envoyée) et renvoie
// un objet "commande" provisoire, affiché tel quel côté client en attendant
// l'envoi réel dès le retour de la connexion.
function queueOrderOffline(
  tableId: number,
  payload: Array<{ menuItemId: string; quantity: number; notes?: string; weightGrams?: number }>,
  items: Array<{ menuItem: MenuItem; quantity: number; notes?: string; weightGrams?: number }>
): Order {
  const queue = getOfflineQueue();
  const localId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  queue.push({ id: localId, tableId, items: payload, queuedAt: new Date().toISOString() });
  saveOfflineQueue(queue);

  state = { ...state, pendingOfflineOrders: queue.length };
  notify();

  const now = new Date().toISOString();
  return {
    id: localId,
    orderNumber: 0,
    tableId,
    items: items.map((i, idx) => ({
      id: `${localId}-item-${idx}`,
      menuItemId: i.menuItem.id,
      name: i.weightGrams ? `${i.menuItem.name} (${i.weightGrams}g)` : i.menuItem.name,
      unitPrice: i.menuItem.isPricedByWeight && i.weightGrams
        ? Math.round(((i.menuItem.price * i.weightGrams) / 1000) * 100) / 100
        : i.menuItem.price,
      quantity: i.menuItem.isPricedByWeight && i.weightGrams ? 1 : i.quantity,
      notes: i.notes,
      status: 'nouvelle',
    })),
    status: 'en_attente_validation',
    createdAt: now,
    updatedAt: now,
  };
}

async function fetchAll(): Promise<void> {
  // Évite les rafraîchissements concurrents qui se chevauchent (plusieurs
  // événements Realtime arrivant en rafale).
  if (fetchInFlight) return fetchInFlight;

  fetchInFlight = (async () => {
    let results;
    try {
      results = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('menu_items').select('*'),
        supabase.from('restaurant_tables').select('*').order('id'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('order_items').select('*'),
        supabase.from('bills').select('*').order('paid_at', { ascending: false }),
        supabase.from('reservations').select('*'),
        supabase.from('restaurant_settings').select('*').eq('id', true).maybeSingle(),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30),
        supabase.from('active_alarm').select('*').eq('id', true).maybeSingle(),
        supabase.from('cash_register_closings').select('*').order('created_at', { ascending: false }).limit(20),
      ]);
    } catch {
      // Pas de connexion (ou Supabase injoignable) : on ne casse jamais l'app.
      // Si on a déjà des données en mémoire, on les garde telles quelles — on
      // signale juste le mode hors-ligne. Sinon (tout premier chargement),
      // on retombe sur la dernière sauvegarde locale connue, pour que le
      // client puisse au moins consulter le menu.
      if (!state.loaded) {
        const cache = loadOfflineCache();
        if (cache) {
          state = {
            ...state,
            loaded: true,
            categories: cache.categories,
            menu: cache.menu,
            tables: cache.tables,
            settings: cache.settings,
            isOffline: true,
            isUsingCachedData: true,
          };
        } else {
          state = { ...state, isOffline: true };
        }
      } else {
        state = { ...state, isOffline: true };
      }
      notify();
      return;
    }

    const [
      profilesRes,
      categoriesRes,
      menuRes,
      tablesRes,
      ordersRes,
      orderItemsRes,
      billsRes,
      reservationsRes,
      settingsRes,
      notificationsRes,
      alarmRes,
      cashClosingsRes,
    ] = results;

    const tables = (tablesRes.data || []).map(mapTable);

    const itemsByOrder = new Map<string, unknown[]>();
    (orderItemsRes.data || []).forEach((it: { order_id: string }) => {
      const list = (itemsByOrder.get(it.order_id) as unknown[]) || [];
      list.push(it);
      itemsByOrder.set(it.order_id, list);
    });

    const orders = (ordersRes.data || []).map((o: { id: string }) =>
      mapOrder(o, (itemsByOrder.get(o.id) as never[]) || [])
    );

    const notifications = (notificationsRes.data || []).map(mapNotification);
    playSoundsForNewNotifications(notifications);

    state = {
      loaded: true,
      categories: (categoriesRes.data || []).map(mapCategory),
      menu: (menuRes.data || []).map(mapMenuItem),
      tables,
      orders,
      bills: (billsRes.data || []).map(mapBill),
      reservations: (reservationsRes.data || []).map(mapReservation),
      waiters: deriveWaiters(profilesRes.data || [], tables),
      users: (profilesRes.data || []).map(mapProfileToUser),
      settings: settingsRes.data ? mapSettings(settingsRes.data) : state.settings,
      notifications,
      activeAlarm: mapActiveAlarm(alarmRes.data),
      cashRegisterClosings: (cashClosingsRes.data || []).map(mapCashRegisterClosing),
      isOffline: false,
      isUsingCachedData: false,
      pendingOfflineOrders: getOfflineQueue().length,
    };

    saveOfflineCache();
    syncAlarmAudio();
    notify();
  })();

  try {
    await fetchInFlight;
  } finally {
    fetchInFlight = null;
  }
}

// ----------------------------------------------------------------------------
// Realtime : toute modification faite par N'IMPORTE QUEL appareil connecté
// (client, serveur, cuisine, admin...) redéclenche un rafraîchissement complet.
// Simple et fiable — le volume de données d'un bar-restaurant reste modeste.
// ----------------------------------------------------------------------------

function initRealtime() {
  const tablesToWatch = [
    'orders',
    'order_items',
    'restaurant_tables',
    'notifications',
    'active_alarm',
    'profiles',
    'menu_items',
    'categories',
    'reservations',
    'restaurant_settings',
    'bills',
    'cash_register_closings',
  ];

  const channel = supabase.channel('app-state-sync');
  tablesToWatch.forEach((table) => {
    channel.on(
      'postgres_changes' as never,
      { event: '*', schema: 'public', table },
      () => {
        fetchAll();
      }
    );
  });
  channel.subscribe();
}

// Démarrage : premier chargement + écoute temps réel + filet de sécurité.
// Le temps réel Supabase peut, dans certains cas, ne pas diffuser les
// changements pour des policies RLS un peu complexes (comportement connu et
// silencieux). Pour garantir une synchronisation fiable quel que soit ce
// comportement, on rafraîchit aussi toutes les 5 secondes en tâche de fond.
if (typeof window !== 'undefined') {
  fetchAll();
  initRealtime();
  setInterval(() => {
    fetchAll();
  }, 5000);
}

// ----------------------------------------------------------------------------
// API publique du store
// ----------------------------------------------------------------------------

export const store = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    if (state.loaded) listener(state);
    return () => listeners.delete(listener);
  },
  getState(): AppState {
    return state;
  },

  // --- MENU & CATEGORIES (admin/manager — cf. policies categories_write_admin / menu_items_write_admin) ---
  // Versions "rapides" pour l'import en masse (scan de menu) : pas de
  // rafraîchissement de toute l'app après CHAQUE ligne — un seul refresh()
  // à la fin de tout l'import, sinon 40 plats = 40 rechargements complets.
  async addCategoryFast(name: string, section: 'food' | 'bar' = 'food'): Promise<{ success: boolean; id?: string; message?: string }> {
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, sort_order: state.categories.length + 1, section })
      .select('id')
      .single();
    if (error) return { success: false, message: error.message };
    return { success: true, id: data.id };
  },

  async addMenuItemFast(item: Omit<MenuItem, 'id'>): Promise<{ success: boolean; message?: string }> {
    const { error } = await supabase.from('menu_items').insert({
      category_id: item.categoryId,
      name: item.name,
      description: item.description,
      price: item.price,
      images: item.images,
      video_url: item.videoUrl,
      prep_time_minutes: item.prepTimeMinutes,
      is_available: item.isAvailable,
      stock_quantity: item.stockQuantity,
      is_promo: item.isPromo ?? false,
      promo_price: item.promoPrice,
      is_recommended: item.isRecommended ?? false,
      is_spicy: item.isSpicy ?? false,
      allergens: item.allergens,
      dietary_labels: item.dietaryLabels || [],
      translations: item.translations || {},
      barcode: item.barcode || null,
      is_plat_du_jour: item.isPlatDuJour ?? false,
      is_priced_by_weight: item.isPricedByWeight ?? false,
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async refresh() {
    await fetchAll();
  },

  // Envoie un fichier (photo produit ou MP3 d'alarme) vers le stockage
  // Supabase et renvoie son URL publique, utilisable directement comme
  // "images: [url]" sur un produit ou "customAudioUrl" dans les réglages.
  // Réinitialisation complète du site (menu + historique) — réservée admin,
  // pour repartir de zéro avec un autre restaurant sans passer par le SQL.
  async fullResetRestaurant(): Promise<{ success: boolean; message?: string }> {
    const { error } = await supabase.rpc('full_reset_restaurant');
    await fetchAll();
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async uploadFile(folder: 'menu' | 'alarms', file: File): Promise<{ success: boolean; url?: string; message?: string }> {
    const ext = file.name.split('.').pop() || 'bin';
    const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const path = `${folder}/${crypto.randomUUID()}.${safeExt}`;

    const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert: false });
    if (error) return { success: false, message: error.message };

    const { data } = supabase.storage.from('uploads').getPublicUrl(path);
    return { success: true, url: data.publicUrl };
  },

  async addCategory(name: string, icon?: string, section: 'food' | 'bar' = 'food'): Promise<{ success: boolean; id?: string; message?: string }> {
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, icon, sort_order: state.categories.length + 1, section })
      .select('id')
      .single();
    await fetchAll();
    if (error) return { success: false, message: error.message };
    return { success: true, id: data.id };
  },

  // Envoie une photo (menu papier ou bon d'achat/facture) à l'Edge Function
  // scan-image, qui utilise une IA vision pour en extraire les produits.
  async scanImage(
    mode: 'menu' | 'invoice',
    imageBase64: string,
    mimeType: string
  ): Promise<{ success: boolean; items?: Array<Record<string, unknown>>; message?: string }> {
    const { data, error } = await supabase.functions.invoke('scan-image', {
      body: { mode, imageBase64, mimeType },
    });
    if (error) {
      let message = error.message;
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        }
      } catch {
        // garde le message générique si la réponse n'est pas du JSON
      }
      return { success: false, message };
    }
    if (data?.error) {
      return { success: false, message: data.error };
    }
    return { success: true, items: data?.items || [] };
  },

  // Change l'ordre d'affichage d'une catégorie (échange sa position avec sa
  // voisine directe) — utilisé par les flèches ↑↓ dans Carte & Plats.
  async reorderCategory(categoryId: string, direction: 'up' | 'down'): Promise<{ success: boolean; message?: string }> {
    const sorted = [...state.categories].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((c) => c.id === categoryId);
    if (idx === -1) return { success: false, message: 'Catégorie introuvable.' };

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return { success: true }; // déjà en bout de liste

    const a = sorted[idx];
    const b = sorted[swapIdx];

    const { error: error1 } = await supabase.from('categories').update({ sort_order: b.order }).eq('id', a.id);
    const { error: error2 } = await supabase.from('categories').update({ sort_order: a.order }).eq('id', b.id);
    await fetchAll();

    if (error1 || error2) return { success: false, message: (error1 || error2)?.message };
    return { success: true };
  },

  // Change la section (Menu/plats ou Bar/alcools) d'une catégorie déjà créée
  // — utile pour corriger un classement automatique erroné après un scan.
  async updateCategorySection(categoryId: string, section: 'food' | 'bar'): Promise<{ success: boolean; message?: string }> {
    const { error } = await supabase.from('categories').update({ section }).eq('id', categoryId);
    await fetchAll();
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async deleteCategory(catId: string): Promise<{ success: boolean; message?: string }> {
    const { error } = await supabase.from('categories').delete().eq('id', catId);
    await fetchAll();
    if (error) {
      const message = error.code === '23503'
        ? 'Impossible : cette catégorie contient encore des produits. Supprime ou déplace-les d\'abord.'
        : error.message;
      return { success: false, message };
    }
    return { success: true };
  },

  async addMenuItem(item: Omit<MenuItem, 'id'>) {
    await supabase.from('menu_items').insert({
      category_id: item.categoryId,
      name: item.name,
      description: item.description,
      price: item.price,
      images: item.images,
      video_url: item.videoUrl,
      prep_time_minutes: item.prepTimeMinutes,
      is_available: item.isAvailable,
      stock_quantity: item.stockQuantity,
      is_promo: item.isPromo ?? false,
      promo_price: item.promoPrice,
      is_recommended: item.isRecommended ?? false,
      is_spicy: item.isSpicy ?? false,
      allergens: item.allergens,
      dietary_labels: item.dietaryLabels || [],
      translations: item.translations || {},
      barcode: item.barcode || null,
      is_plat_du_jour: item.isPlatDuJour ?? false,
      is_priced_by_weight: item.isPricedByWeight ?? false,
    });
    await fetchAll();
  },

  async updateMenuItemFast(id: string, updates: Partial<MenuItem>): Promise<{ success: boolean; message?: string }> {
    const payload: Record<string, unknown> = {};
    if (updates.stockQuantity !== undefined) payload.stock_quantity = updates.stockQuantity;
    if (updates.price !== undefined) payload.price = updates.price;
    const { error } = await supabase.from('menu_items').update(payload).eq('id', id);
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async updateMenuItem(id: string, updates: Partial<MenuItem>) {
    const payload: Record<string, unknown> = {};
    if (updates.categoryId !== undefined) payload.category_id = updates.categoryId;
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.price !== undefined) payload.price = updates.price;
    if (updates.images !== undefined) payload.images = updates.images;
    if (updates.videoUrl !== undefined) payload.video_url = updates.videoUrl;
    if (updates.prepTimeMinutes !== undefined) payload.prep_time_minutes = updates.prepTimeMinutes;
    if (updates.isAvailable !== undefined) payload.is_available = updates.isAvailable;
    if (updates.stockQuantity !== undefined) payload.stock_quantity = updates.stockQuantity;
    if (updates.isPromo !== undefined) payload.is_promo = updates.isPromo;
    if (updates.promoPrice !== undefined) payload.promo_price = updates.promoPrice;
    if (updates.isRecommended !== undefined) payload.is_recommended = updates.isRecommended;
    if (updates.isSpicy !== undefined) payload.is_spicy = updates.isSpicy;
    if (updates.allergens !== undefined) payload.allergens = updates.allergens;
    if (updates.dietaryLabels !== undefined) payload.dietary_labels = updates.dietaryLabels;
    if (updates.translations !== undefined) payload.translations = updates.translations;
    if (updates.barcode !== undefined) payload.barcode = updates.barcode || null;
    if (updates.isPlatDuJour !== undefined) payload.is_plat_du_jour = updates.isPlatDuJour;
    if (updates.isPricedByWeight !== undefined) payload.is_priced_by_weight = updates.isPricedByWeight;

    await supabase.from('menu_items').update(payload).eq('id', id);
    await fetchAll();
  },

  async deleteMenuItem(id: string): Promise<{ success: boolean; message?: string }> {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    await fetchAll();
    if (error) {
      const message = error.code === '23503'
        ? "Impossible : ce produit a déjà été commandé au moins une fois (historique protégé). Rends-le plutôt \"indisponible\" si tu ne veux plus le vendre."
        : error.message;
      return { success: false, message };
    }
    return { success: true };
  },

  async toggleItemAvailability(id: string) {
    const item = state.menu.find((m) => m.id === id);
    if (!item) return;
    await supabase.from('menu_items').update({ is_available: !item.isAvailable }).eq('id', id);
    await fetchAll();
  },

  // --- TABLES ---
  async addTable(seats: number = 2, clientName?: string): Promise<{ success: boolean; message?: string }> {
    if (state.tables.length >= 500) {
      return { success: false, message: 'Limite de 500 tables atteinte.' };
    }
    const nextId = state.tables.length > 0 ? Math.max(...state.tables.map((t) => t.id)) + 1 : 1;
    const pin = generateRandom4DigitPin();
    const { error } = await supabase.from('restaurant_tables').insert({
      id: nextId,
      number: nextId,
      name: `Table ${nextId}`,
      status: 'libre',
      seats,
      access_code: pin,
      client_name: clientName?.trim() || null,
    });
    await fetchAll();
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async updateTableClientName(tableId: number, clientName: string): Promise<{ success: boolean; message?: string }> {
    const { error } = await supabase
      .from('restaurant_tables')
      .update({ client_name: clientName.trim() || null })
      .eq('id', tableId);
    await fetchAll();
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async updateTableStatus(tableId: number, status: TableStatus) {
    const table = state.tables.find((t) => t.id === tableId);
    const newPin = status === 'libre' ? generateRandom4DigitPin() : table?.accessCode || generateRandom4DigitPin();
    await supabase.from('restaurant_tables').update({ status, access_code: newPin }).eq('id', tableId);
    await fetchAll();
  },

  async verifyAndOccupyTable(tableId: number, code: string): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.rpc('verify_and_occupy_table', { p_table_id: tableId, p_code: code });
    await fetchAll();
    if (error) return { success: false, message: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    return { success: row?.success ?? false, message: row?.message ?? '' };
  },

  async verifyAndOccupyTableByCode(
    code: string
  ): Promise<{ success: boolean; message: string; tableId?: number }> {
    const { data, error } = await supabase.rpc('verify_and_occupy_table_by_code', { p_code: code });
    await fetchAll();
    if (error) return { success: false, message: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    return { success: row?.success ?? false, message: row?.message ?? '', tableId: row?.table_id ?? undefined };
  },

  async regenerateTablePin(tableId: number): Promise<string> {
    const { data, error } = await supabase.rpc('regenerate_table_pin', { p_table_id: tableId });
    await fetchAll();
    if (error) throw error;
    return data as string;
  },

  async assignWaiterToTable(tableId: number, waiterId: string | undefined) {
    // Un serveur qui clique "À moi le service !" sur une table libre s'auto-assigne :
    // ça doit passer par la RPC claim_table (les policies RLS directes n'autorisent
    // pas un serveur à s'assigner une table qui ne lui appartenait pas encore).
    // Un admin/manager qui choisit un AUTRE serveur dans le menu déroulant, en
    // revanche, passe par la mise à jour directe (autorisée par tables_write_admin).
    const { data: authData } = await supabase.auth.getUser();
    const isSelfClaim = Boolean(waiterId) && authData.user?.id === waiterId;

    if (isSelfClaim) {
      await supabase.rpc('claim_table', { p_table_id: tableId });
    } else {
      await supabase.from('restaurant_tables').update({ assigned_waiter_id: waiterId ?? null }).eq('id', tableId);
    }
    await fetchAll();
  },

  async claimTable(tableId: number): Promise<boolean> {
    const { error } = await supabase.rpc('claim_table', { p_table_id: tableId });
    await fetchAll();
    return !error;
  },

  async moveOrderBetweenTables(fromTableId: number, toTableId: number): Promise<boolean> {
    const { data, error } = await supabase.rpc('move_order_between_tables', {
      p_from_table_id: fromTableId,
      p_to_table_id: toTableId,
    });
    await fetchAll();
    return !error && Boolean(data);
  },

  async mergeTables(sourceTableId: number, targetTableId: number): Promise<boolean> {
    const { data, error } = await supabase.rpc('merge_tables', {
      p_source_table_id: sourceTableId,
      p_target_table_id: targetTableId,
    });
    await fetchAll();
    return !error && Boolean(data);
  },

  // --- ORDERS ---
  async createOrder(
    tableId: number,
    items: Array<{ menuItem: MenuItem; quantity: number; notes?: string; weightGrams?: number }>
  ): Promise<Order | null> {
    const payload = items.map((i) => ({
      menuItemId: i.menuItem.id,
      quantity: i.quantity,
      notes: i.notes,
      weightGrams: i.weightGrams,
    }));

    const isOfflineNow = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOfflineNow) {
      return queueOrderOffline(tableId, payload, items);
    }

    try {
      const { data: orderId, error } = await supabase.rpc('create_client_order', {
        p_table_id: tableId,
        p_items: payload,
      });
      await fetchAll();
      if (error || !orderId) return null;
      return state.orders.find((o) => o.id === orderId) || null;
    } catch {
      // Échec réseau malgré une connexion apparente (wifi connecté sans
      // accès Internet réel, coupure pile au moment de l'envoi...) — on met
      // en file d'attente plutôt que de perdre la commande du client.
      return queueOrderOffline(tableId, payload, items);
    }
  },

  // Ajout rapide par le personnel (admin/manager/serveur) depuis le plan de
  // salle : ajoute directement les articles à l'addition de la table
  // (pas de validation nécessaire, contrairement à create_client_order).
  async addItemsToTable(
    tableId: number,
    items: Array<{ menuItem: MenuItem; quantity: number; weightGrams?: number; unitPriceOverride?: number }>
  ): Promise<{ success: boolean; message?: string }> {
    const payload = items.map((i) => ({
      menuItemId: i.menuItem.id,
      quantity: i.quantity,
      weightGrams: i.weightGrams,
      unitPriceOverride: i.unitPriceOverride,
    }));
    const { error } = await supabase.rpc('staff_add_items_to_table', {
      p_table_id: tableId,
      p_items: payload,
    });
    await fetchAll();
    if (error) {
      console.error('addItemsToTable error:', error);
      return { success: false, message: error.message };
    }
    return { success: true };
  },

  // Scan d'un bon (code-barres/QR) — réservé admin côté RPC. Retrouve le
  // produit par son code-barres et l'ajoute automatiquement à l'addition.
  async addItemByBarcode(
    tableId: number,
    barcode: string,
    quantity = 1
  ): Promise<{ success: boolean; message?: string }> {
    const { error } = await supabase.rpc('staff_add_item_by_barcode', {
      p_table_id: tableId,
      p_barcode: barcode,
      p_quantity: quantity,
    });
    await fetchAll();
    if (error) {
      console.error('addItemByBarcode error:', error);
      return { success: false, message: error.message };
    }
    return { success: true };
  },

  // Click & Collect : commande à emporter, rattachée à la table virtuelle 999.
  async createPickupOrder(
    items: Array<{ menuItem: MenuItem; quantity: number; notes?: string; weightGrams?: number }>,
    clientName?: string,
    clientPhone?: string
  ): Promise<Order | null> {
    const payload = items.map((i) => ({
      menuItemId: i.menuItem.id,
      quantity: i.quantity,
      notes: i.notes,
      weightGrams: i.weightGrams,
    }));
    const { data: orderId, error } = await supabase.rpc('create_pickup_order', {
      p_items: payload,
      p_client_name: clientName || null,
      p_client_phone: clientPhone || null,
    });
    await fetchAll();
    if (error || !orderId) return null;
    return state.orders.find((o) => o.id === orderId) || null;
  },

  async submitSatisfactionReview(
    tableId: number | null,
    orderId: string | null,
    rating: number,
    comment?: string
  ): Promise<{ success: boolean; message?: string }> {
    const { error } = await supabase.rpc('submit_satisfaction_review', {
      p_table_id: tableId,
      p_order_id: orderId,
      p_rating: rating,
      p_comment: comment || null,
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async confirmOrder(orderId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('confirm_order', { p_order_id: orderId });
    await fetchAll();
    return !error && Boolean(data);
  },

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<{ success: boolean; message?: string }> {
    const { error } = await supabase.rpc('update_order_status', { p_order_id: orderId, p_status: status });
    await fetchAll();
    if (error) {
      console.error('updateOrderStatus error:', error);
      return { success: false, message: error.message };
    }
    return { success: true };
  },

  async updateOrderItemStatus(
    orderId: string,
    itemId: string,
    itemStatus: OrderItem['status']
  ): Promise<{ success: boolean; message?: string }> {
    const { error } = await supabase.rpc('update_order_item_status', {
      p_order_id: orderId,
      p_item_id: itemId,
      p_status: itemStatus,
    });
    await fetchAll();
    if (error) {
      console.error('updateOrderItemStatus error:', error);
      return { success: false, message: error.message };
    }
    return { success: true };
  },

  async callWaiter(tableId: number) {
    await supabase.rpc('client_call_waiter', { p_table_id: tableId });
    await fetchAll();
  },

  async requestBill(tableId: number) {
    await supabase.rpc('client_request_bill', { p_table_id: tableId });
    await fetchAll();
  },

  async stopAlarm() {
    await supabase.rpc('stop_alarm');
    stopContinuousAlarm();
    await fetchAll();
  },

  async dismissTableCall(tableId: number) {
    await supabase.rpc('dismiss_table_call', { p_table_id: tableId });
    await fetchAll();
  },

  // --- BILLS & PAYMENTS ---
  // Encaisse TOUTES les commandes actives d'une table en une seule facture
  // (remplace processBillPayment pour l'écran Caisse — une table peut avoir
  // plusieurs commandes séparées, mais un seul paiement groupé).
  async processTablePayment(
    tableId: number,
    paymentMethod: PaymentMethod,
    discountAmount = 0,
    cashReceived?: number,
    paymentsBreakdown?: PaymentBreakdown[]
  ): Promise<Bill | null> {
    const { data, error } = await supabase.rpc('process_table_payment', {
      p_table_id: tableId,
      p_payment_method: paymentMethod,
      p_discount: discountAmount,
      p_cash_received: cashReceived ?? null,
      p_breakdown: paymentsBreakdown ?? null,
    });
    await fetchAll();
    if (error || !data) {
      console.error('processTablePayment error:', error);
      return null;
    }
    const bill = state.bills.find((b) => b.id === data);
    return bill || null;
  },

  async processBillPayment(
    orderId: string,
    paymentMethod: PaymentMethod,
    discountAmount = 0,
    cashReceived = 0,
    paymentsBreakdown?: PaymentBreakdown[],
    _processedUserId?: string
  ): Promise<Bill | null> {
    const { data: billId, error } = await supabase.rpc('process_bill_payment', {
      p_order_id: orderId,
      p_payment_method: paymentMethod,
      p_discount: discountAmount,
      p_cash_received: cashReceived || null,
      p_breakdown: paymentsBreakdown ?? null,
    });
    await fetchAll();
    if (error || !billId) return null;
    return state.bills.find((b) => b.id === billId) || null;
  },

  // --- RESERVATIONS ---
  // Demande de réservation envoyée par le client depuis la page d'accueil —
  // sans table assignée, le staff choisira une table réelle ensuite.
  async requestReservation(input: {
    clientName: string;
    clientPhone: string;
    guestCount: number;
    dateTime: string;
    notes?: string;
  }): Promise<{ success: boolean; message?: string }> {
    const { error } = await supabase.from('reservations').insert({
      client_name: input.clientName,
      client_phone: input.clientPhone,
      guest_count: input.guestCount,
      date_time: input.dateTime,
      notes: input.notes || null,
      status: 'confirmée',
    });
    await fetchAll();
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  // Le staff assigne une table réelle à une demande de réservation client.
  async assignReservationTable(reservationId: string, tableId: number): Promise<{ success: boolean; message?: string }> {
    const { error } = await supabase.from('reservations').update({ table_id: tableId }).eq('id', reservationId);
    await fetchAll();
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async addReservation(res: Omit<Reservation, 'id'>) {
    await supabase.from('reservations').insert({
      table_id: res.tableId,
      client_name: res.clientName,
      client_phone: res.clientPhone,
      guest_count: res.guestCount,
      date_time: res.dateTime,
      notes: res.notes,
      status: res.status,
    });
    await supabase.from('restaurant_tables').update({ status: 'reservee' }).eq('id', res.tableId);
    await fetchAll();
  },

  async cancelReservation(id: string) {
    await supabase.from('reservations').update({ status: 'annulée' }).eq('id', id);
    await fetchAll();
  },

  // --- WAITERS (= profiles avec role='serveur') ---
  // La CRÉATION d'un compte (Supabase Auth + profil) nécessite la clé service :
  // impossible et volontairement bloqué depuis le navigateur. Utilisez l'Edge
  // Function `create-staff-user`.
  async addWaiter(): Promise<never> {
    throw new Error(
      "Impossible de créer un compte serveur directement depuis le navigateur. Utilisez l'écran d'administration relié à l'Edge Function create-staff-user."
    );
  },

  async updateWaiter(id: string, updates: Partial<Waiter>) {
    const profilePayload: Record<string, unknown> = {};
    if (updates.name !== undefined) profilePayload.name = updates.name;
    if (updates.phone !== undefined) profilePayload.phone = updates.phone;
    if (updates.photo !== undefined) profilePayload.avatar = updates.photo;
    if (updates.pinCode !== undefined) profilePayload.pin_code = updates.pinCode;
    if (updates.isOnline !== undefined) profilePayload.is_online = updates.isOnline;

    if (Object.keys(profilePayload).length > 0) {
      await supabase.from('profiles').update(profilePayload).eq('id', id);
    }

    if (updates.assignedTableIds !== undefined) {
      await supabase.from('restaurant_tables').update({ assigned_waiter_id: null }).eq('assigned_waiter_id', id);
      if (updates.assignedTableIds.length > 0) {
        await supabase
          .from('restaurant_tables')
          .update({ assigned_waiter_id: id })
          .in('id', updates.assignedTableIds);
      }
    }

    await fetchAll();
  },

  async deleteWaiter(): Promise<never> {
    throw new Error(
      'La suppression d\'un compte (Supabase Auth) nécessite la clé service — à faire depuis le Dashboard Supabase ou une Edge Function dédiée, jamais depuis le navigateur.'
    );
  },

  // --- USERS (comptes non-serveur : admin/manager/cuisinier/caissier) ---
  async addUser(): Promise<never> {
    throw new Error(
      "Impossible de créer un compte directement depuis le navigateur. Utilisez l'Edge Function create-staff-user."
    );
  },

  async updateUser(id: string, updates: Partial<User>) {
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.avatar !== undefined) payload.avatar = updates.avatar;
    if (updates.active !== undefined) payload.active = updates.active;
    if (updates.role !== undefined) payload.role = updates.role; // bloqué en base sauf pour un admin (trigger SQL)
    await supabase.from('profiles').update(payload).eq('id', id);
    await fetchAll();
  },

  async deleteUser(): Promise<never> {
    throw new Error(
      "La suppression d'un compte nécessite la clé service — à faire depuis le Dashboard Supabase ou une Edge Function dédiée."
    );
  },

  // --- SETTINGS (admin uniquement — cf. policy settings_write_admin) ---
  async updateSettings(updates: Partial<RestaurantSettings>) {
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.logo !== undefined) payload.logo = updates.logo;
    if (updates.address !== undefined) payload.address = updates.address;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.openingHours !== undefined) payload.opening_hours = updates.openingHours;
    if (updates.currency !== undefined) payload.currency = updates.currency;
    if (updates.vatRate !== undefined) payload.vat_rate = updates.vatRate;
    if (updates.serviceRate !== undefined) payload.service_rate = updates.serviceRate;
    if (updates.primaryColor !== undefined) payload.primary_color = updates.primaryColor;
    if (updates.bgStyle !== undefined) payload.bg_style = updates.bgStyle;
    if (updates.cloudinaryCloudName !== undefined) payload.cloudinary_cloud_name = updates.cloudinaryCloudName;
    if (updates.alarmSoundType !== undefined) payload.alarm_sound_type = updates.alarmSoundType;
    if (updates.customAudioUrl !== undefined) payload.custom_audio_url = updates.customAudioUrl;
    if (updates.enableLoopAlarm !== undefined) payload.enable_loop_alarm = updates.enableLoopAlarm;
    if (updates.alarmVolume !== undefined) payload.alarm_volume = updates.alarmVolume;
    if (updates.latitude !== undefined) payload.latitude = updates.latitude;
    if (updates.longitude !== undefined) payload.longitude = updates.longitude;

    await supabase.from('restaurant_settings').update(payload).eq('id', true);
    await fetchAll();
  },

  // --- NOTIFICATIONS ---
  // addNotification n'existe plus côté client : chaque fonction RPC insère
  // elle-même sa notification (voir supabase/migrations/0002 et 0004).
  async clearNotifications() {
    await supabase.rpc('clear_notifications');
    await fetchAll();
  },

  async deleteNotification(id: string) {
    await supabase.rpc('delete_notification', { p_notification_id: id });
    await fetchAll();
  },

  // --- CAISSE : tiroir-caisse & clôture ---
  async openCashDrawer(reason: string = 'ouverture_manuelle'): Promise<boolean> {
    const { error } = await supabase.rpc('open_cash_drawer', { p_reason: reason });
    return !error;
  },

  async getCashRegisterSummary(): Promise<{ periodStart: string; cashSales: number } | null> {
    const { data, error } = await supabase.rpc('get_cash_register_summary');
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return { periodStart: row.period_start, cashSales: Number(row.cash_sales) };
  },

  async closeCashRegister(
    declaredCash: number,
    openingFloat: number = 0,
    notes?: string
  ): Promise<{ success: boolean; message?: string }> {
    const { error } = await supabase.rpc('close_cash_register', {
      p_declared_cash: declaredCash,
      p_opening_float: openingFloat,
      p_notes: notes || null,
    });
    await fetchAll();
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async resetToDefaultData(): Promise<never> {
    throw new Error(
      'La réinitialisation complète des données doit se faire en ré-exécutant les migrations SQL depuis Supabase (plus de remise à zéro en un clic côté client, par sécurité).'
    );
  },

  // --- SAUVEGARDE & RESTAURATION (carte + tables + paramètres) ---
  // NB : les sauvegardes automatiques de toute la base (infrastructure) sont
  // déjà gérées par Supabase. Ceci est un export/import pratique, côté app,
  // de la carte/tables/paramètres — pas des commandes ou de l'historique.
  exportBackup() {
    return {
      exportedAt: new Date().toISOString(),
      categories: state.categories,
      menu: state.menu,
      tables: state.tables,
      settings: state.settings,
    };
  },

  async restoreBackup(backup: {
    categories?: Category[];
    menu?: MenuItem[];
    tables?: Table[];
    settings?: RestaurantSettings;
  }): Promise<{ success: boolean; message?: string }> {
    try {
      if (backup.categories?.length) {
        const { error } = await supabase.from('categories').upsert(
          backup.categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, sort_order: c.order }))
        );
        if (error) throw error;
      }

      if (backup.menu?.length) {
        const { error } = await supabase.from('menu_items').upsert(
          backup.menu.map((m) => ({
            id: m.id,
            category_id: m.categoryId,
            name: m.name,
            description: m.description,
            price: m.price,
            images: m.images,
            video_url: m.videoUrl,
            prep_time_minutes: m.prepTimeMinutes,
            is_available: m.isAvailable,
            stock_quantity: m.stockQuantity,
            is_promo: m.isPromo ?? false,
            promo_price: m.promoPrice,
            is_recommended: m.isRecommended ?? false,
            is_spicy: m.isSpicy ?? false,
            allergens: m.allergens,
            dietary_labels: m.dietaryLabels || [],
            barcode: m.barcode || null,
          }))
        );
        if (error) throw error;
      }

      if (backup.tables?.length) {
        const { error } = await supabase.from('restaurant_tables').upsert(
          backup.tables.map((t) => ({
            id: t.id,
            number: t.number,
            name: t.name,
            status: t.status,
            seats: t.seats,
            access_code: t.accessCode,
            assigned_waiter_id: t.assignedWaiterId,
          }))
        );
        if (error) throw error;
      }

      if (backup.settings) {
        const s = backup.settings;
        const { error } = await supabase
          .from('restaurant_settings')
          .update({
            name: s.name,
            logo: s.logo,
            address: s.address,
            phone: s.phone,
            email: s.email,
            opening_hours: s.openingHours,
            currency: s.currency,
            vat_rate: s.vatRate,
            service_rate: s.serviceRate,
            primary_color: s.primaryColor,
            bg_style: s.bgStyle,
            cloudinary_cloud_name: s.cloudinaryCloudName,
            alarm_sound_type: s.alarmSoundType,
            custom_audio_url: s.customAudioUrl,
            enable_loop_alarm: s.enableLoopAlarm,
            alarm_volume: s.alarmVolume,
          })
          .eq('id', true);
        if (error) throw error;
      }

      await fetchAll();
      return { success: true };
    } catch (err) {
      return { success: false, message: (err as Error).message || 'Restauration impossible.' };
    }
  },
};
