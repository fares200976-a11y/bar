import React from 'react';
import {
  LayoutDashboard,
  Grid,
  ChefHat,
  Receipt,
  UtensilsCrossed,
  Users,
  Calendar,
  History,
  QrCode,
  Settings as SettingsIcon,
  LogOut,
  ShieldAlert
} from 'lucide-react';
import { User, UserRole } from '../../types';

export type AdminTab =
  | 'dashboard'
  | 'tables'
  | 'kitchen'
  | 'cashier'
  | 'menu'
  | 'waiters'
  | 'reservations'
  | 'history'
  | 'qrcodes'
  | 'settings';

interface AdminLayoutProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  currentUser: User;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  activeTab,
  onTabChange,
  currentUser,
  onLogout,
  children,
}) => {
  // Check role-based access
  const hasAccess = (tab: AdminTab): boolean => {
    const role = currentUser.role;
    if (role === 'admin') return true;
    if (role === 'manager') return tab !== 'settings';
    if (role === 'cuisinier') return tab === 'kitchen' || tab === 'menu';
    if (role === 'caissier') return tab === 'cashier' || tab === 'tables' || tab === 'history';
    if (role === 'serveur') return tab === 'tables' || tab === 'kitchen' || tab === 'reservations';
    return true;
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'tables', label: 'Tables & Plan', icon: <Grid className="w-5 h-5" /> },
    { id: 'kitchen', label: 'Cuisine (KDS)', icon: <ChefHat className="w-5 h-5" /> },
    { id: 'cashier', label: 'Caisse & POS', icon: <Receipt className="w-5 h-5" /> },
    { id: 'menu', label: 'Carte & Plats', icon: <UtensilsCrossed className="w-5 h-5" /> },
    { id: 'waiters', label: 'Serveurs & Équipe', icon: <Users className="w-5 h-5" /> },
    { id: 'reservations', label: 'Réservations', icon: <Calendar className="w-5 h-5" /> },
    { id: 'history', label: 'Historique', icon: <History className="w-5 h-5" /> },
    { id: 'qrcodes', label: 'QR Codes Tables', icon: <QrCode className="w-5 h-5" /> },
    { id: 'settings', label: 'Paramètres', icon: <SettingsIcon className="w-5 h-5" /> },
  ];

  const allowedItems = navItems.filter((item) => hasAccess(item.id));

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 p-5 flex flex-col justify-between shadow-xs">
        <div className="space-y-6">
          {/* User Role Badge */}
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white font-black flex items-center justify-center text-lg shrink-0">
              {currentUser.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-black text-slate-900 dark:text-white truncate">{currentUser.name}</p>
              <p className="text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                Rôle : {currentUser.role}
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {allowedItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-black text-sm transition-all cursor-pointer ${
                    isActive
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Logout */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 mt-6">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-black text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {!hasAccess(activeTab) ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-800 max-w-md mx-auto my-12 shadow-md">
            <ShieldAlert className="w-14 h-14 text-rose-600 mx-auto mb-3" />
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Accès Non Autorisé</h3>
            <p className="text-sm font-bold text-slate-500 mt-1">
              Votre rôle ({currentUser.role}) ne possède pas la permission d'accéder à cette rubrique.
            </p>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
};
