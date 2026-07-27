import React, { useState } from 'react';
import { History, Search, Printer } from 'lucide-react';
import { Bill, Order, RestaurantSettings } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { printThermalReceipt } from '../../utils/export';

interface OrderHistoryViewProps {
  orders: Order[];
  bills: Bill[];
  settings: RestaurantSettings;
}

export const OrderHistoryView: React.FC<OrderHistoryViewProps> = ({
  orders,
  bills,
  settings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('tous');

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
          <option value="en_attente_validation">À valider (Serveur)</option>
          <option value="terminee">Terminées / Payées</option>
          <option value="annulee">Annulées</option>
          <option value="servie">Servies</option>
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
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Aucune commande ne correspond aux critères
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const bill = bills.find((b) => b.orderId === ord.id);
                  const total = ord.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

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
    </div>
  );
};
