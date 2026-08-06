import React, { useEffect, useState } from 'react';
import { History, Search, Printer, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { Bill, Order, RestaurantSettings, User } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { printThermalReceipt } from '../../utils/export';
import { store } from '../../services/store';

interface OrderHistoryViewProps {
  settings: RestaurantSettings;
  currentUser?: User | null;
}

export const OrderHistoryView: React.FC<OrderHistoryViewProps> = ({ settings, currentUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('tous');
  const [daysBack, setDaysBack] = useState(30);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showClearModal, setShowClearModal] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState('');

  const loadHistory = async (range: number) => {
    setIsLoading(true);
    const result = await store.fetchOrderHistory(range);
    setOrders(result.orders);
    setBills(result.bills);
    setIsLoading(false);
  };

  useEffect(() => {
    loadHistory(daysBack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysBack]);

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      `Table ${o.tableId}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `Cmd #${o.orderNumber}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items.some((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'tous' || o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <History className="w-7 h-7 text-rose-500" />
            <span>Historique des Commandes & Additions</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Conservez et auditez toutes les consommations, annulations et paiements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadHistory(daysBack)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-2xl font-bold text-xs disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setShowClearModal(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 rounded-2xl font-bold text-xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vider l'Historique</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par numéro de table, commande ou nom de plat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs py-3 pl-10 pr-4 rounded-2xl border border-slate-200 dark:border-slate-800"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800"
        >
          <option value="tous">Tous les statuts</option>
          <option value="en_attente_validation">À valider (Admin)</option>
          <option value="terminee">Terminées / Payées</option>
          <option value="annulee">Annulées</option>
          <option value="servie">Servies</option>
        </select>

        <select
          value={daysBack}
          onChange={(e) => setDaysBack(parseInt(e.target.value))}
          className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800"
        >
          <option value={7}>7 derniers jours</option>
          <option value={30}>30 derniers jours</option>
          <option value={90}>90 derniers jours</option>
          <option value={365}>1 an</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-bold">
              <tr>
                <th className="p-4">Commande</th>
                <th className="p-4">Table</th>
                <th className="p-4">Date & Heure</th>
                <th className="p-4">Consommations</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Montant</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Chargement de l'historique...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Aucune commande ne correspond aux critères
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const bill = bills.find((b) => b.orderId === ord.id);
                  const total = ord.items.filter((i) => i.status !== 'annulee').reduce((s, i) => s + i.unitPrice * i.quantity, 0);

                  return (
                    <tr key={ord.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">#{ord.orderNumber}</td>
                      <td className="p-4 font-extrabold text-rose-600 dark:text-rose-400">Table {ord.tableId}</td>
                      <td className="p-4 text-slate-500">{formatDateTime(ord.createdAt)}</td>
                      <td className="p-4 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                        {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${
                            ord.status === 'terminee'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : ord.status === 'annulee'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                      <td className="p-4 text-right font-extrabold text-slate-900 dark:text-white">
                        {formatCurrency(bill?.total || total, settings.currency)}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => printThermalReceipt('addition', ord, bill, settings)}
                          className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl"
                          title="Réimprimer le ticket"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modale de confirmation stricte pour vider l'historique */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl border border-rose-300 dark:border-rose-900">
            <p className="font-black text-base text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>Vider tout l'historique ?</span>
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Ça supprime définitivement toutes les commandes et factures passées. Le menu et les tables ne sont PAS
              touchés. Tape <span className="font-mono font-black">VIDER</span> pour confirmer.
            </p>
            <input
              type="text"
              value={clearConfirmText}
              onChange={(e) => setClearConfirmText(e.target.value)}
              placeholder="VIDER"
              className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-mono font-bold text-center text-slate-900 dark:text-white"
            />
            {clearError && <p className="text-xs font-bold text-rose-600">{clearError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowClearModal(false);
                  setClearConfirmText('');
                  setClearError('');
                }}
                disabled={isClearing}
                className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-xs disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (clearConfirmText !== 'VIDER') {
                    setClearError('Tape exactement VIDER pour confirmer.');
                    return;
                  }
                  setIsClearing(true);
                  setClearError('');
                  const result = await store.clearOrderHistory();
                  setIsClearing(false);
                  if (!result.success) {
                    setClearError(result.message || 'Échec de la suppression.');
                    return;
                  }
                  setShowClearModal(false);
                  setClearConfirmText('');
                  loadHistory(daysBack);
                }}
                disabled={isClearing}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-2xl font-black text-xs shadow-md"
              >
                {isClearing ? 'Suppression...' : 'Tout Vider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
