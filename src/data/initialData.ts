import { Category, MenuItem, Table, Waiter, RestaurantSettings, User } from '../types';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Entrées', order: 1 },
  { id: 'cat-2', name: 'Salades', order: 2 },
  { id: 'cat-3', name: 'Sandwichs', order: 3 },
  { id: 'cat-4', name: 'Pizza', order: 4 },
  { id: 'cat-5', name: 'Grillades', order: 5 },
  { id: 'cat-6', name: 'Pâtes', order: 6 },
  { id: 'cat-7', name: 'Burgers', order: 7 },
  { id: 'cat-8', name: 'Couscous', order: 8 },
  { id: 'cat-9', name: 'Tajines', order: 9 },
  { id: 'cat-10', name: 'Desserts', order: 10 },
  { id: 'cat-11', name: 'Glaces', order: 11 },
  { id: 'cat-12', name: 'Boissons chaudes', order: 12 },
  { id: 'cat-13', name: 'Boissons froides', order: 13 },
  { id: 'cat-14', name: 'Cocktails', order: 14 },
  { id: 'cat-15', name: 'Chicha', order: 15 },
];

export const INITIAL_MENU: MenuItem[] = [
  // Entrées & Salades
  {
    id: 'item-1',
    categoryId: 'cat-1',
    name: 'Tapas Assortis Gourmands',
    description: 'Croquettes au fromage, calamars croustillants, calamares a la romana et sauces maison.',
    price: 850,
    images: [
      'https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800&q=80'
    ],
    prepTimeMinutes: 10,
    isAvailable: true,
    stockQuantity: 25,
    isRecommended: true,
    allergens: ['Gluten', 'Poisson', 'Lait']
  },
  {
    id: 'item-2',
    categoryId: 'cat-2',
    name: 'Salade César au Poulet Crispy',
    description: 'Poulet croustillant, salade romaine, parmesan affiné, croutons ail & herbes et sauce César crémeuse.',
    price: 950,
    images: [
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80'
    ],
    prepTimeMinutes: 12,
    isAvailable: true,
    stockQuantity: 18,
    isPromo: true,
    promoPrice: 800,
    allergens: ['Gluten', 'Lait', 'Œufs']
  },
  // Burgers
  {
    id: 'item-3',
    categoryId: 'cat-7',
    name: 'Smash Burger Double Cheddar',
    description: 'Deux steaks de bœuf haché frais, cheddar fondu, oignons caramélisés, cornichons et sauce artisanale.',
    price: 1200,
    images: [
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=800&q=80'
    ],
    prepTimeMinutes: 15,
    isAvailable: true,
    stockQuantity: 30,
    isRecommended: true,
    isSpicy: false,
    allergens: ['Gluten', 'Lait', 'Sésame']
  },
  {
    id: 'item-4',
    categoryId: 'cat-7',
    name: 'Burger Spicy Diablo',
    description: 'Steak de bœuf, jalapeños grillés, pepper jack, sauce pimentée chipotle et oignons croustillants.',
    price: 1300,
    images: [
      'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=800&q=80'
    ],
    prepTimeMinutes: 15,
    isAvailable: true,
    stockQuantity: 15,
    isSpicy: true,
    allergens: ['Gluten', 'Lait']
  },
  // Pizzas
  {
    id: 'item-5',
    categoryId: 'cat-4',
    name: 'Pizza Truffe & Burrata',
    description: 'Sauce crème à la truffe, mozzarella fior di latte, burrata fraîche 125g, roquette et huile de truffe.',
    price: 1500,
    images: [
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80'
    ],
    prepTimeMinutes: 14,
    isAvailable: true,
    stockQuantity: 20,
    isRecommended: true,
    allergens: ['Gluten', 'Lait']
  },
  {
    id: 'item-6',
    categoryId: 'cat-4',
    name: 'Pizza Quattro Formaggi',
    description: 'Mozzarella, gorgonzola AOP, taleggio, parmesan râpé et filet de miel sauvage.',
    price: 1200,
    images: [
      'https://images.unsplash.com/photo-1573821663912-569905455b1c?auto=format&fit=crop&w=800&q=80'
    ],
    prepTimeMinutes: 14,
    isAvailable: true,
    stockQuantity: 25,
    allergens: ['Gluten', 'Lait']
  },
  // Grillades & Tajines
  {
    id: 'item-7',
    categoryId: 'cat-9',
    name: 'Tajine d’Agneau aux Pruneaux & Amandes',
    description: 'Agneau fondant mijoté aux épices orientales, pruneaux caramélisés, amandes torréfiées et sésame.',
    price: 1800,
    images: [
      'https://images.unsplash.com/photo-1541518763669-27fef04b14da?auto=format&fit=crop&w=800&q=80'
    ],
    prepTimeMinutes: 20,
    isAvailable: true,
    stockQuantity: 12,
    isRecommended: true,
    allergens: ['Fruits à coque', 'Sésame']
  },
  {
    id: 'item-8',
    categoryId: 'cat-5',
    name: 'Mixed Grill Royale',
    description: 'Brochettes d’agneau, kfta épicée, filet de poulet mariné au citron, servies avec frites fraîches et riz.',
    price: 2200,
    images: [
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80'
    ],
    prepTimeMinutes: 18,
    isAvailable: true,
    stockQuantity: 15,
    isSpicy: true,
    allergens: []
  },
  // Desserts
  {
    id: 'item-9',
    categoryId: 'cat-10',
    name: 'Fondant au Chocolat Coeur Coulant',
    description: 'Servi chaud avec une boule de glace vanille de Madagascar et coulis de fruits rouges.',
    price: 550,
    images: [
      'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80'
    ],
    prepTimeMinutes: 8,
    isAvailable: true,
    stockQuantity: 20,
    allergens: ['Gluten', 'Lait', 'Œufs']
  },
  // Cocktails, Boissons & Bières
  {
    id: 'item-10',
    categoryId: 'cat-14',
    name: 'Mojito Passion Signature',
    description: 'Rhum blanc, fruit de la passion frais, menthe fraîche pilée, citron vert et eau gazeuse.',
    price: 600,
    images: [
      'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80'
    ],
    prepTimeMinutes: 5,
    isAvailable: true,
    stockQuantity: 50,
    isRecommended: true,
    allergens: []
  },
  {
    id: 'item-11',
    categoryId: 'cat-14',
    name: 'Pina Colada Royale',
    description: 'Rhum, crème de coco, jus d’ananas frais infusé à la vanille.',
    price: 650,
    images: [
      'https://images.unsplash.com/photo-1546171753-97d7676e4602?auto=format&fit=crop&w=800&q=80'
    ],
    prepTimeMinutes: 5,
    isAvailable: true,
    stockQuantity: 40,
    allergens: ['Lait']
  },
  {
    id: 'item-12',
    categoryId: 'cat-15',
    name: 'Chicha Premium Special Blend',
    description: 'Chicha haute qualité avec foyer au choix : Menthe Intense, Double Pomme, Love 66 ou Mangue glacée.',
    price: 2000,
    images: [
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80'
    ],
    prepTimeMinutes: 10,
    isAvailable: true,
    stockQuantity: 15,
    allergens: []
  },
  {
    id: 'item-13',
    categoryId: 'cat-13',
    name: 'Limonade Maison Menthe & Gingembre',
    description: 'Jus de citron pressé à la minute, menthe fraîche et touche de gingembre doux.',
    price: 350,
    images: [
      'https://images.unsplash.com/photo-1523371054106-bbf80586c38c?auto=format&fit=crop&w=800&q=80'
    ],
    prepTimeMinutes: 4,
    isAvailable: true,
    stockQuantity: 60,
    allergens: []
  },
  {
    id: 'item-14',
    categoryId: 'cat-13',
    name: 'Bière Pression Fraîche (50cl)',
    description: 'Bière pression fraîche servie glacée.',
    price: 400,
    images: [
      'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=800&q=80'
    ],
    prepTimeMinutes: 2,
    isAvailable: true,
    stockQuantity: 100,
    allergens: ['Gluten']
  },
  {
    id: 'item-15',
    categoryId: 'cat-12',
    name: 'Café Expresso / Capuccino',
    description: 'Café fraîchement moulu ou cappuccino onctueux.',
    price: 150,
    images: [
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80'
    ],
    prepTimeMinutes: 3,
    isAvailable: true,
    stockQuantity: 80,
    allergens: ['Lait']
  }
];

const INITIAL_PINS = ['1234', '2345', '3456', '4567', '5678', '6789', '7890', '8901', '9012', '4821'];

export const INITIAL_TABLES: Table[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  number: i + 1,
  name: `Table ${i + 1}`,
  status: 'libre',
  seats: i % 2 === 0 ? 4 : 2,
  accessCode: INITIAL_PINS[i] || `${1000 + i + 1}`,
  assignedWaiterId: i < 5 ? 'waiter-1' : 'waiter-2',
}));

export const INITIAL_WAITERS: Waiter[] = [
  {
    id: 'waiter-1',
    name: 'Karim Benali',
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    phone: '06 12 34 56 78',
    pinCode: '2001',
    isOnline: true,
    assignedTableIds: [1, 2]
  },
  {
    id: 'waiter-2',
    name: 'Sarah Moreau',
    photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
    phone: '06 98 76 54 32',
    pinCode: '2002',
    isOnline: true,
    assignedTableIds: [3, 4]
  },
  {
    id: 'waiter-3',
    name: 'Yassine Belkacem',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    phone: '06 55 44 33 22',
    pinCode: '2003',
    isOnline: true,
    assignedTableIds: [5, 6]
  },
  {
    id: 'waiter-4',
    name: 'Amine Hamdi',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    phone: '06 11 99 88 77',
    pinCode: '2004',
    isOnline: true,
    assignedTableIds: [7, 8]
  },
  {
    id: 'waiter-5',
    name: 'Leila Mansouri',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    phone: '06 33 22 11 00',
    pinCode: '2005',
    isOnline: true,
    assignedTableIds: [9, 10]
  },
  {
    id: 'waiter-6',
    name: 'Thomas Dubois',
    photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80',
    phone: '06 77 88 99 00',
    pinCode: '2006',
    isOnline: true,
    assignedTableIds: [1, 3, 5]
  },
  {
    id: 'waiter-7',
    name: 'Mehdi Saadi',
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
    phone: '06 44 55 66 77',
    pinCode: '2007',
    isOnline: true,
    assignedTableIds: [2, 4, 6]
  },
  {
    id: 'waiter-8',
    name: 'Nadia Cherif',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    phone: '06 22 33 44 55',
    pinCode: '2008',
    isOnline: true,
    assignedTableIds: [7, 8, 9, 10]
  }
];

export const INITIAL_USERS: User[] = [
  {
    id: 'u-1',
    name: 'Admin Principal',
    username: 'admin',
    role: 'admin',
    phone: '06 00 00 00 00',
    active: true,
  },
  {
    id: 'u-2',
    name: 'Chef Michel (Cuisine)',
    username: 'cuisine',
    role: 'cuisinier',
    phone: '06 11 22 33 44',
    active: true,
  },
  {
    id: 'u-3',
    name: 'Sofia Caissière',
    username: 'caisse',
    role: 'caissier',
    phone: '06 55 66 77 88',
    active: true,
  },
  {
    id: 'u-4',
    name: 'Karim Serveur (PIN: 2001)',
    username: 'karim',
    role: 'serveur',
    phone: '06 12 34 56 78',
    active: true,
  },
  {
    id: 'u-5',
    name: 'Sarah Serveuse (PIN: 2002)',
    username: 'sarah',
    role: 'serveur',
    phone: '06 98 76 54 32',
    active: true,
  }
];

export const INITIAL_SETTINGS: RestaurantSettings = {
  name: 'Le Lounge GastroBar & Resto',
  logo: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=150&q=80',
  address: '12 Rue Didouche Mourad, Alger',
  phone: '+213 21 60 70 80',
  email: 'contact@lelounge-resto.dz',
  openingHours: '11:00 - 02:00 (7j/7)',
  currency: 'DA',
  vatRate: 0,
  serviceRate: 0,
  primaryColor: '#5A5A40',
  bgStyle: 'clean',
  alarmSoundType: 'mp3_alarm_clock',
  customAudioUrl: '',
  enableLoopAlarm: true,
  alarmVolume: 0.8
};
