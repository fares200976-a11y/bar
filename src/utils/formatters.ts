import { Category, Order, OrderStatus, TableStatus } from '../types';

export function formatCurrency(amount: number, currency = 'DA'): string {
  const formatted = Math.round(amount) === amount
    ? amount.toLocaleString('fr-FR')
    : amount.toFixed(2).replace('.', ',');
  return `${formatted} ${currency}`;
}

export function isDrinkOrBeerItem(
  item: { name: string; categoryId?: string },
  categories: Category[] = []
): boolean {
  const nameLower = item.name.toLowerCase();

  const drinkKeywords = [
    'biere', 'bière', 'beer', 'boisson', 'cocktail', 'jus', 'soda', 'eau', 'café', 'cafe',
    'thé', 'the', 'chicha', 'mojito', 'pina colada', 'coca', 'fanta', 'sprite', 'red bull',
    'limonade', 'heineken', '1664', 'corona', 'alcool', 'alcol', 'vin', 'champagne', 'whisky',
    'vodka', 'rhum', 'bar', 'soft', 'glace', 'glaces'
  ];

  if (drinkKeywords.some((kw) => nameLower.includes(kw))) {
    return true;
  }

  if (item.categoryId && categories.length > 0) {
    const cat = categories.find((c) => c.id === item.categoryId);
    if (cat) {
      const catNameLower = cat.name.toLowerCase();
      if (drinkKeywords.some((kw) => catNameLower.includes(kw))) {
        return true;
      }
    }
  }

  return false;
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatTimeOnly(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'nouvelle':
      return 'Nouvelle';
    case 'en_preparation':
      return 'En préparation';
    case 'prete':
      return 'Prête';
    case 'servie':
      return 'Servie';
    case 'terminee':
      return 'Terminée';
    case 'annulee':
      return 'Annulée';
    default:
      return status;
  }
}

export function getOrderStatusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case 'nouvelle':
      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300';
    case 'en_preparation':
      return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 animate-pulse';
    case 'prete':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'servie':
      return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300';
    case 'terminee':
      return 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300';
    case 'annulee':
      return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-300';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getTableStatusLabel(status: TableStatus): string {
  switch (status) {
    case 'libre':
      return 'Libre';
    case 'occupee':
      return 'Occupée';
    case 'reservee':
      return 'Réservée';
    case 'en_attente':
      return 'En attente';
    case 'commande_en_cours':
      return 'Commande en cours';
    default:
      return status;
  }
}

export function getTableStatusBadgeClass(status: TableStatus): string {
  switch (status) {
    case 'libre':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400';
    case 'occupee':
      return 'bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400';
    case 'reservee':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400';
    case 'en_attente':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400';
    case 'commande_en_cours':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400 animate-pulse';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function calculateOrderTotals(order: Order, vatRate = 0, serviceRate = 0, discount = 0) {
  const subtotal = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const vatAmount = (subtotal * vatRate) / 100;
  const serviceAmount = (subtotal * serviceRate) / 100;
  const grandTotal = Math.max(0, subtotal + vatAmount + serviceAmount - discount);

  return {
    subtotal,
    vatRate,
    vatAmount,
    serviceRate,
    serviceAmount,
    discount,
    grandTotal,
  };
}
