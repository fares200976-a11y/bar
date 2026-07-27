import React, { useState } from 'react';
import {
  UtensilsCrossed,
  QrCode,
  Shield,
  Bell,
  Sun,
  Moon,
  LogOut,
  UserCheck,
  Volume2,
  VolumeX,
  Smartphone,
  ChevronDown,
  Trash2,
  X
} from 'lucide-react';
import { User, RestaurantSettings, CallNotification, Table } from '../../types';

interface HeaderProps {
  currentView: 'client' | 'admin';
  selectedTableId: number;
  tables: Table[];
  onSelectTable: (tableId: number) => void;
  onSwitchView: (view: 'client' | 'admin') => void;
  currentUser: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  settings: RestaurantSettings;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  notifications: CallNotification[];
  onClearNotifications: () => void;
  onDeleteNotification?: (id: string) => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  selectedTableId,
  tables,
  onSelectTable,
  onSwitchView,
  currentUser,
  onOpenLogin,
  onLogout,
  settings,
  darkMode,
  onToggleDarkMode,
  notifications,
  onClearNotifications,
  onDeleteNotification,
  audioEnabled,
  onToggleAudio,
}) => {
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const unreadNotifs = notifications.filter((n) => !n.read);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#1C1C16]/95 backdrop-blur-md border-b border-[#E5E2DD] dark:border-[#33332A] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5A5A40] flex items-center justify-center text-white shadow-xs">
              <UtensilsCrossed className="w-5 h-5 text-[#F5F2ED]" />
            </div>
            <div>
              <h1 className="font-serif font-medium text-[#5A5A40] dark:text-[#E2E0D8] text-xl leading-tight tracking-tight">
                {settings.name}
              </h1>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#9A948C] hidden sm:block font-medium">
                Gastronomie & Lounge • QR & POS
              </p>
            </div>
          </div>

          {/* Center Table Switcher Simulator for testing QR Scan */}
          <div className="flex items-center gap-2 bg-[#F5F2ED] dark:bg-[#26261E] p-1.5 rounded-xl border border-[#E5E2DD] dark:border-[#33332A]">
            <div className="flex items-center gap-1.5 px-2 text-xs font-medium text-[#5A5A40] dark:text-[#D1CECB]">
              <QrCode className="w-4 h-4 text-[#5A5A40] dark:text-[#A8A49C]" />
              <span className="hidden md:inline font-sans text-[11px] uppercase tracking-wider text-[#9A948C]">Table :</span>
            </div>
            <div className="relative">
              <select
                value={selectedTableId}
                onChange={(e) => {
                  const tableId = Number(e.target.value);
                  onSelectTable(tableId);
                  if (currentView !== 'client') onSwitchView('client');
                }}
                className="appearance-none bg-white dark:bg-[#1C1C16] text-[#1A1A1A] dark:text-white text-xs font-bold py-1.5 pl-3 pr-8 rounded-lg border border-[#E5E2DD] dark:border-[#33332A] focus:outline-none focus:ring-2 focus:ring-[#5A5A40] cursor-pointer shadow-2xs"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#9A948C] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              onClick={onToggleAudio}
              title={audioEnabled ? 'Sonorisation active' : 'Sonorisation désactivée'}
              className="p-2 text-[#5A5A40] dark:text-[#D1CECB] hover:bg-[#F5F2ED] dark:hover:bg-[#26261E] rounded-lg transition-colors"
            >
              {audioEnabled ? <Volume2 className="w-4 h-4 text-[#5A5A40]" /> : <VolumeX className="w-4 h-4 text-[#9A948C]" />}
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleDarkMode}
              className="p-2 text-[#5A5A40] dark:text-[#D1CECB] hover:bg-[#F5F2ED] dark:hover:bg-[#26261E] rounded-lg transition-colors"
              title="Changer le thème"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications Bell & Quick Clear Button */}
            <div className="relative flex items-center gap-1">
              {notifications.length > 0 && (
                <button
                  onClick={onClearNotifications}
                  className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded-xl font-black text-xs transition-colors cursor-pointer"
                  title="Effacer toutes les notifications"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Effacer ({notifications.length})</span>
                </button>
              )}

              <button
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                className="relative p-2 text-[#5A5A40] dark:text-[#D1CECB] hover:bg-[#F5F2ED] dark:hover:bg-[#26261E] rounded-lg transition-colors cursor-pointer"
                title="Notifications en direct"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#D95D39] rounded-full animate-ping" />
                )}
                {unreadNotifs.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#D95D39] rounded-full" />
                )}
              </button>

              {/* Notif Dropdown */}
              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Alertes & Notifications ({notifications.length})
                    </span>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => {
                          onClearNotifications();
                          setShowNotifMenu(false);
                        }}
                        className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-extrabold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Effacer tout</span>
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto py-2 space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4 font-bold">Aucune notification récente</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs flex items-start justify-between gap-2"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{n.message}</p>
                            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                              {new Date(n.timestamp).toLocaleTimeString('fr-FR')}
                            </span>
                          </div>
                          <button
                            onClick={() => onDeleteNotification && onDeleteNotification(n.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                            title="Effacer cette notification"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* View Switcher: Client vs Admin */}
            <div className="flex items-center bg-[#F5F2ED] dark:bg-[#26261E] p-1 rounded-xl">
              <button
                onClick={() => onSwitchView('client')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  currentView === 'client'
                    ? 'bg-white dark:bg-[#1C1C16] text-[#5A5A40] dark:text-[#E2E0D8] shadow-2xs font-bold'
                    : 'text-[#9A948C] hover:text-[#5A5A40]'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Espace Client</span>
              </button>
              <button
                onClick={() => {
                  if (!currentUser) {
                    onOpenLogin();
                  } else {
                    onSwitchView('admin');
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  currentView === 'admin'
                    ? 'bg-[#5A5A40] text-white shadow-2xs font-bold'
                    : 'text-[#9A948C] hover:text-[#5A5A40]'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Administration</span>
              </button>
            </div>

            {/* User Profile / Login */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-[#E5E2DD] dark:border-[#33332A]">
                <div className="text-right hidden lg:block">
                  <p className="text-xs font-bold text-[#1A1A1A] dark:text-white">{currentUser.name}</p>
                  <p className="text-[10px] text-[#5A5A40] dark:text-[#A8A49C] font-semibold capitalize">{currentUser.role}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 text-[#D95D39] hover:bg-[#F5F2ED] dark:hover:bg-[#26261E] rounded-lg transition-colors"
                  title="Déconnexion"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5E2DD] dark:border-[#33332A] text-xs font-medium text-[#5A5A40] dark:text-[#D1CECB] hover:bg-[#F5F2ED] dark:hover:bg-[#26261E] transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#5A5A40]" />
                <span>Connexion Staff</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
