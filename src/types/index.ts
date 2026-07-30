export type UserRole = 'admin' | 'manager' | 'serveur' | 'cuisinier' | 'caissier';

export interface User {
  id: string; // correspond à auth.users.id (UUID Supabase)
  name: string;
  username: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  active: boolean;
}

export type TableStatus = 'libre' | 'occupee' | 'reservee' | 'en_attente' | 'commande_en_cours';

export interface Table {
  id: number;
  number: number;
  name: string; // e.g. "Table 1"
  status: TableStatus;
  seats: number;
  accessCode?: string; // 4-digit PIN code dynamically generated for QR scan
  assignedWaiterId?: string;
  activeOrderId?: string;
  occupiedSince?: string; // ISO — maintenu automatiquement côté base (trigger)
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  order: number;
  section: 'food' | 'bar';
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  videoUrl?: string;
  prepTimeMinutes: number; // e.g., 15
  isAvailable: boolean;
  stockQuantity: number;
  isPromo?: boolean;
  promoPrice?: number;
  isRecommended?: boolean;
  isSpicy?: boolean;
  allergens: string[]; // e.g., ['Gluten', 'Lait', 'Arachides']
  dietaryLabels?: string[]; // e.g., ['Végétarien', 'Vegan', 'Sans Gluten', 'Fait Maison']
  translations?: Record<string, { name?: string; description?: string }>; // ex: { en: { name, description } }
  barcode?: string; // code-barres / QR du bon, utilisé pour l'ajout auto à l'addition (admin uniquement)
}

export interface OrderItemOption {
  name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  notes?: string; // e.g., "Sans oignons", "Bien cuit"
  status: 'nouvelle' | 'en_preparation' | 'prete' | 'servie' | 'annulee';
}

export type OrderStatus = 'en_attente_validation' | 'nouvelle' | 'en_preparation' | 'prete' | 'servie' | 'terminee' | 'annulee';

export interface Order {
  id: string;
  orderNumber: number;
  tableId: number;
  waiterId?: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: string; // ISO string
  updatedAt: string;
  specialRequests?: string;
  callWaiterRequest?: boolean;
  requestBill?: boolean;
  billRequestedAt?: string;
  confirmedByWaiterId?: string; // serveur qui a validé la commande vers la cuisine
  confirmedAt?: string;
  orderType?: 'sur_place' | 'emporter';
}

export interface SatisfactionReview {
  id: string;
  tableId?: number;
  orderId?: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export type PaymentMethod = 'espèces' | 'carte' | 'mobile' | 'partagé';

export interface PaymentBreakdown {
  method: Exclude<PaymentMethod, 'partagé'>;
  amount: number;
}

export interface Bill {
  id: string;
  orderId: string;
  tableId: number;
  subtotal: number;
  taxRate: number; // percentage, e.g. 10
  taxAmount: number;
  serviceRate: number; // percentage, e.g. 5
  serviceAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentsBreakdown?: PaymentBreakdown[];
  cashReceived?: number;
  changeGiven?: number;
  paidAt: string;
  processedByUserId?: string;
}

export interface Reservation {
  id: string;
  tableId: number;
  clientName: string;
  clientPhone: string;
  guestCount: number;
  dateTime: string; // ISO string or format YYYY-MM-DD HH:mm
  notes?: string;
  status: 'confirmée' | 'annulée' | 'honorée';
}

export interface Waiter {
  id: string;
  name: string;
  photo: string;
  pinCode?: string; // 4-digit special access PIN code
  phone: string;
  isOnline: boolean;
  assignedTableIds: number[];
}

export interface RestaurantSettings {
  name: string;
  logo: string;
  address: string;
  phone: string;
  email: string;
  openingHours: string;
  currency: string; // e.g. "€" or "MAD" or "FCFA"
  vatRate: number; // e.g. 10
  serviceRate: number; // e.g. 5
  primaryColor: string; // hex string e.g. "#e11d48"
  bgStyle: 'clean' | 'warm' | 'dark_luxury';
  firebaseConfig?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
  };
  cloudinaryCloudName?: string;
  alarmSoundType?: string;
  customAudioUrl?: string;
  enableLoopAlarm?: boolean;
  alarmVolume?: number;
  latitude?: number;
  longitude?: number;
}

export interface CashRegisterClosing {
  id: string;
  closedByUserId?: string;
  periodStart: string;
  periodEnd: string;
  openingFloat: number;
  expectedCash: number;
  declaredCash: number;
  difference: number;
  notes?: string;
  createdAt: string;
}

export interface CallNotification {
  id: string;
  tableId: number;
  type: 'waiter_call' | 'bill_request' | 'new_order' | 'kitchen_ready';
  message: string;
  timestamp: string;
  read: boolean;
}

export interface ActiveAlarm {
  id: string;
  tableId: number;
  orderNumber?: number;
  message: string;
  type: 'new_order' | 'waiter_call' | 'bill_request';
  timestamp: string;
}
