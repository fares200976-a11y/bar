import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Utensils, AlertCircle, X, Trash2 } from 'lucide-react';
import { CallNotification } from '../../types';

interface NotificationToastProps {
  notifications: CallNotification[];
  onClearNotifications?: () => void;
  onDeleteNotification?: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notifications,
  onClearNotifications,
  onDeleteNotification,
}) => {
  const [activeToast, setActiveToast] = useState<CallNotification | null>(null);

  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];
      // Show if less than 10 seconds old
      const timeDiff = Date.now() - new Date(latest.timestamp).getTime();
      if (timeDiff < 10000) {
        setActiveToast(latest);
        const timer = setTimeout(() => {
          setActiveToast(null);
        }, 6000);
        return () => clearTimeout(timer);
      }
    }
  }, [notifications]);

  if (!activeToast) return null;

  const handleDismiss = () => {
    if (activeToast && onDeleteNotification) {
      onDeleteNotification(activeToast.id);
    }
    setActiveToast(null);
  };

  const getIcon = () => {
    switch (activeToast.type) {
      case 'new_order':
        return <Utensils className="w-5 h-5 text-amber-500" />;
      case 'kitchen_ready':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'waiter_call':
      case 'bill_request':
        return <AlertCircle className="w-5 h-5 text-rose-500 animate-bounce" />;
      default:
        return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="fixed bottom-5 left-5 z-50 max-w-sm w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl p-4 shadow-2xl flex items-start gap-3 animate-slide-up">
      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
        {getIcon()}
      </div>
      <div className="flex-1 pr-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">Alerte Restaurant</p>
          {onClearNotifications && (
            <button
              onClick={() => {
                onClearNotifications();
                setActiveToast(null);
              }}
              className="text-[10px] font-black text-slate-400 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Tout effacer</span>
            </button>
          )}
        </div>
        <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{activeToast.message}</p>
        <p className="text-[10px] text-slate-400 font-bold mt-1">
          {new Date(activeToast.timestamp).toLocaleTimeString('fr-FR')}
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        title="Fermer et effacer la notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
