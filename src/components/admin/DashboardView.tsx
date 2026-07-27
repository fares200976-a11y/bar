import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Grid,
  Clock,
  Award,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  UtensilsCrossed,
  GlassWater
} from 'lucide-react';
import { Bill, Order, Table, Waiter, RestaurantSettings, MenuItem } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/export';

interface DashboardViewProps {
  tables: Table[];
  orders: Order[];
  bills: Bill[];
  waiters: Waiter[];
  menu: MenuItem[];
  settings: RestaurantSettings;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  tables,
  orders,
  bills,
  waiters,
  menu,
  settings,
}) => {
  const [periodFilter, setPeriodFilter] = useState<'jour' | 'semaine' | 'mois' | 'annee'>('jour');

  const occupiedTablesCount = tables.filter((t) => t.status !== 'libre').length;
  const freeTablesCount = tables.filter((t) => t.status === 'libre').length;

  // Bornes de la période sélectionnée + de la période précédente équivalente
  // (pour calculer une vraie évolution en %, pas un chiffre fixe).
  const getPeriodRange = (period: typeof periodFilter) => {
    const now = new Date();
    let start: Date;
    let prevStart: Date;
    let prevEnd: Date;

    if (period === 'jour') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      prevEnd = new Date(start);
      prevStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    } else if (period === 'semaine') {
      const dayOfWeek = (now.getDay() + 6) % 7; // 0 = lundi
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      prevEnd = new Date(start);
      prevStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'mois') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      prevEnd = new Date(start);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    } else {
      start = new Date(now.getFullYear(), 0, 1);
      prevEnd = new Date(start);
      prevStart = new Date(now.getFullYear() - 1, 0, 1);
    }

    return { start, end: now, prevStart, prevEnd };
  };

  const { start: periodStart, end: periodEnd, prevStart, prevEnd } = getPeriodRange(periodFilter);

  const isWithin = (iso: string, from: Date, to: Date) => {
    const t = new Date(iso).getTime();
    return t >= from.getTime() && t <= to.getTime();
  };

  const periodBills = bills.filter((b) => isWithin(b.paidAt, periodStart, periodEnd));
  const previousPeriodBills = bills.filter((b) => isWithin(b.paidAt, prevStart, prevEnd));
  const periodOrders = orders.filter((o) => isWithin(o.createdAt, periodStart, periodEnd));

  const periodRevenue = periodBills.reduce((sum, b) => sum + b.total, 0);
  const previousPeriodRevenue = previousPeriodBills.reduce((sum, b) => sum + b.total, 0);
  const revenueGrowthPct =
    previousPeriodRevenue > 0
      ? ((periodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
      : periodRevenue > 0
      ? 100
      : 0;

  const totalOrdersCount = periodOrders.length;

  // Seules les commandes confirmées (donc réellement passées en cuisine) comptent
  // dans les statistiques de ventes — une commande annulée ou encore en attente de
  // validation par le serveur ne doit pas fausser le classement des plats/serveurs.
  const confirmedOrders = periodOrders.filter(
    (o) => o.status !== 'annulee' && o.status !== 'en_attente_validation'
  );

  // Calculate Top Plats
  const dishSalesMap: Record<string, { name: string; qty: number; revenue: number; isDrink: boolean }> = {};

  confirmedOrders.forEach((ord) => {
    ord.items.forEach((item) => {
      const menuItem = menu.find((m) => m.id === item.menuItemId);
      const isDrink = menuItem?.categoryId === 'cat-12' || menuItem?.categoryId === 'cat-13' || menuItem?.categoryId === 'cat-14';

      if (!dishSalesMap[item.name]) {
        dishSalesMap[item.name] = { name: item.name, qty: 0, revenue: 0, isDrink: Boolean(isDrink) };
      }
      dishSalesMap[item.name].qty += item.quantity;
      dishSalesMap[item.name].revenue += item.unitPrice * item.quantity;
    });
  });

  const allSales = Object.values(dishSalesMap);
  const top10Plats = allSales.filter((s) => !s.isDrink).sort((a, b) => b.qty - a.qty).slice(0, 10);
  const topBoissons = allSales.filter((s) => s.isDrink).sort((a, b) => b.qty - a.qty).slice(0, 5);

  // Top Waiter calculation
  const waiterSalesMap: Record<string, number> = {};
  confirmedOrders.forEach((o) => {
    if (o.waiterId) {
      const total = o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      waiterSalesMap[o.waiterId] = (waiterSalesMap[o.waiterId] || 0) + total;
    }
  });

  let topWaiterName: string | null = null;
  let topWaiterRevenue = 0;
  Object.entries(waiterSalesMap).forEach(([wId, rev]) => {
    if (rev > topWaiterRevenue) {
      topWaiterRevenue = rev;
      const waiterObj = waiters.find((w) => w.id === wId);
      topWaiterName = waiterObj ? waiterObj.name : null;
    }
  });

  // Temps de préparation moyen réel, pondéré par les quantités vendues sur la période.
  let prepWeightedTotal = 0;
  let prepQtyTotal = 0;
  confirmedOrders.forEach((ord) => {
    ord.items.forEach((item) => {
      const menuItem = menu.find((m) => m.id === item.menuItemId);
      if (menuItem) {
        prepWeightedTotal += menuItem.prepTimeMinutes * item.quantity;
        prepQtyTotal += item.quantity;
      }
    });
  });
  const avgPrepTimeMinutes = prepQtyTotal > 0 ? Math.round(prepWeightedTotal / prepQtyTotal) : null;

  // Handle Export triggers
  const handleExportPDF = () => {
    const exportData = orders.map((o) => ({
      Commande: `#${o.orderNumber}`,
      Table: `Table ${o.tableId}`,
      Statut: o.status,
      Date: new Date(o.createdAt).toLocaleTimeString('fr-FR'),
      Total: formatCurrency(
        o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
        settings.currency
      ),
    }));
    exportToPDF('Rapport_Ventes_Bar_Restaurant', ['Commande', 'Table', 'Statut', 'Date', 'Total'], exportData);
  };

  const handleExportExcel = () => {
    const exportData = orders.map((o) => ({
      'N° Commande': o.orderNumber,
      'Numéro Table': o.tableId,
      Statut: o.status,
      'Date & Heure': new Date(o.createdAt).toLocaleString('fr-FR'),
      Articles: o.items.map((i) => `${i.quantity}x ${i.name}`).join(', '),
      Total: o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    }));
    exportToExcel('Rapport_RestoBar', 'Commandes', exportData);
  };

  const handleExportCSV = () => {
    const exportData = bills.map((b) => ({
      'ID Addition': b.id,
      Table: b.tableId,
      SousTotal: b.subtotal,
      TVA: b.taxAmount,
      Service: b.serviceAmount,
      Total: b.total,
      ModePaiement: b.paymentMethod,
      DatePaiement: new Date(b.paidAt).toLocaleString('fr-FR'),
    }));
    exportToCSV('Addition_Export', exportData);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Period Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-semibold text-[#5A5A40] dark:text-[#E2E0D8]">Tableau de Bord & Analytics</h2>
          <p className="text-xs text-[#9A948C] mt-1">
            Performances du bar-restaurant en temps réel
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Filter */}
          <div className="flex items-center bg-white dark:bg-[#1C1C16] p-1 rounded-2xl border border-[#E5E2DD] dark:border-[#33332A] shadow-2xs">
            {(['jour', 'semaine', 'mois', 'annee'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodFilter(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                  periodFilter === p
                    ? 'bg-[#5A5A40] text-white shadow-2xs font-semibold'
                    : 'text-[#9A948C] hover:text-[#5A5A40]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Export Dropdown Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#F5F2ED] dark:bg-[#26261E] text-[#5A5A40] dark:text-[#D1CECB] hover:bg-[#EDEDE6] rounded-xl font-medium text-xs border border-[#E5E2DD] dark:border-[#33332A] transition-colors"
            >
              <FileText className="w-4 h-4 text-[#D95D39]" />
              <span>PDF</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#F5F2ED] dark:bg-[#26261E] text-[#5A5A40] dark:text-[#D1CECB] hover:bg-[#EDEDE6] rounded-xl font-medium text-xs border border-[#E5E2DD] dark:border-[#33332A] transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#486349]" />
              <span>Excel</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#F5F2ED] dark:bg-[#26261E] text-[#5A5A40] dark:text-[#D1CECB] hover:bg-[#EDEDE6] rounded-xl font-medium text-xs border border-[#E5E2DD] dark:border-[#33332A] transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Revenue */}
        <div className="bg-white dark:bg-[#1C1C16] p-5 rounded-3xl border border-[#E5E2DD] dark:border-[#33332A] shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[#9A948C] uppercase tracking-wider">Chiffre d'Affaires ({periodFilter})</span>
            <div className="p-2.5 rounded-2xl bg-[#F5F2ED] dark:bg-[#26261E] text-[#486349]">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-serif font-bold text-[#1A1A1A] dark:text-white mt-3">
            {formatCurrency(periodRevenue, settings.currency)}
          </p>
          <div
            className={`flex items-center gap-1 text-[11px] font-medium mt-2 ${
              revenueGrowthPct >= 0 ? 'text-[#486349]' : 'text-[#D95D39]'
            }`}
          >
            <TrendingUp className={`w-3.5 h-3.5 ${revenueGrowthPct < 0 ? 'rotate-180' : ''}`} />
            <span>
              {revenueGrowthPct >= 0 ? '+' : ''}
              {revenueGrowthPct.toFixed(1)}% vs période précédente
            </span>
          </div>
        </div>

        {/* Tables occupancy */}
        <div className="bg-white dark:bg-[#1C1C16] p-5 rounded-3xl border border-[#E5E2DD] dark:border-[#33332A] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[#9A948C] uppercase tracking-wider">Occupation des Tables</span>
            <div className="p-2.5 rounded-2xl bg-[#F5F2ED] dark:bg-[#26261E] text-[#5A5A40]">
              <Grid className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-2xl font-serif font-bold text-[#1A1A1A] dark:text-white">{occupiedTablesCount}</span>
            <span className="text-xs text-[#9A948C]">/ {tables.length} Tables occupées</span>
          </div>
          <div className="w-full bg-[#F5F2ED] dark:bg-[#26261E] h-2 rounded-full mt-3 overflow-hidden border border-[#E5E2DD] dark:border-[#33332A]">
            <div
              className="bg-[#5A5A40] h-full rounded-full transition-all duration-500"
              style={{ width: `${tables.length > 0 ? (occupiedTablesCount / tables.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white dark:bg-[#1C1C16] p-5 rounded-3xl border border-[#E5E2DD] dark:border-[#33332A] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[#9A948C] uppercase tracking-wider">Commandes Totales</span>
            <div className="p-2.5 rounded-2xl bg-[#F5F2ED] dark:bg-[#26261E] text-[#E0B580]">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-serif font-bold text-[#1A1A1A] dark:text-white mt-3">{totalOrdersCount}</p>
          <p className="text-[11px] text-[#9A948C] mt-2">Plats & Boissons servis</p>
        </div>

        {/* Top Waiter & Prep time */}
        <div className="bg-white dark:bg-[#1C1C16] p-5 rounded-3xl border border-[#E5E2DD] dark:border-[#33332A] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[#9A948C] uppercase tracking-wider">Top Serveur & Prépa</span>
            <div className="p-2.5 rounded-2xl bg-[#F5F2ED] dark:bg-[#26261E] text-[#5A5A40]">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <p className="text-base font-semibold text-[#1A1A1A] dark:text-white mt-2 truncate">
            {topWaiterName || 'Aucune vente sur cette période'}
          </p>
          <div className="flex items-center gap-2 text-xs text-[#9A948C] mt-2">
            <Clock className="w-3.5 h-3.5 text-[#E0B580]" />
            <span>
              Moy. Préparation :{' '}
              <span className="font-semibold text-[#1A1A1A] dark:text-white">
                {avgPrepTimeMinutes !== null ? `${avgPrepTimeMinutes} min` : '—'}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Rankings: Top 10 Plats & Top Boissons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Plats */}
        <div className="bg-white dark:bg-[#1C1C16] p-6 rounded-3xl border border-[#E5E2DD] dark:border-[#33332A] shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-[#5A5A40]" />
              <h3 className="font-serif font-semibold text-[#5A5A40] dark:text-[#E2E0D8] text-lg">Top 10 Plats Réclamés</h3>
            </div>
            <span className="text-xs text-[#9A948C] font-medium">Par volume</span>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {top10Plats.length === 0 ? (
              <p className="text-xs text-[#9A948C] text-center py-8">Aucune donnée de vente enregistrée</p>
            ) : (
              top10Plats.map((plat, index) => (
                <div
                  key={plat.name}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#F5F2ED] dark:bg-[#26261E] border border-[#E5E2DD] dark:border-[#33332A] text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#5A5A40] text-white font-medium flex items-center justify-center text-[10px]">
                      #{index + 1}
                    </span>
                    <span className="font-medium text-[#1A1A1A] dark:text-[#E2E0D8]">{plat.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#1A1A1A] dark:text-white">{plat.qty} vendus</p>
                    <p className="text-[10px] text-[#9A948C]">
                      {formatCurrency(plat.revenue, settings.currency)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Boissons */}
        <div className="bg-white dark:bg-[#1C1C16] p-6 rounded-3xl border border-[#E5E2DD] dark:border-[#33332A] shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <GlassWater className="w-5 h-5 text-[#5A5A40]" />
              <h3 className="font-serif font-semibold text-[#5A5A40] dark:text-[#E2E0D8] text-lg">Top Boissons & Cocktails</h3>
            </div>
            <span className="text-xs text-[#9A948C] font-medium">Par volume</span>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {topBoissons.length === 0 ? (
              <p className="text-xs text-[#9A948C] text-center py-8">Aucune boisson enregistrée</p>
            ) : (
              topBoissons.map((boisson, index) => (
                <div
                  key={boisson.name}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#F5F2ED] dark:bg-[#26261E] border border-[#E5E2DD] dark:border-[#33332A] text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#5A5A40] text-white font-medium flex items-center justify-center text-[10px]">
                      #{index + 1}
                    </span>
                    <span className="font-medium text-[#1A1A1A] dark:text-[#E2E0D8]">{boisson.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#1A1A1A] dark:text-white">{boisson.qty} servies</p>
                    <p className="text-[10px] text-[#9A948C]">
                      {formatCurrency(boisson.revenue, settings.currency)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
