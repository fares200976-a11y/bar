import React from 'react';
import { BellRing, VolumeX, ShieldAlert } from 'lucide-react';
import { ActiveAlarm } from '../../types';
import { store } from '../../services/store';

interface AlarmBannerProps {
  alarm: ActiveAlarm | null;
}

export const AlarmBanner: React.FC<AlarmBannerProps> = ({ alarm }) => {
  if (!alarm) return null;

  return (
    <div
      id="alarm-banner"
      className="bg-red-600 text-white shadow-2xl border-b-4 border-red-800 animate-pulse transition-all duration-300 z-50 sticky top-0 left-0 right-0"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3 text-center sm:text-left">
          <div className="p-2.5 bg-red-800 rounded-full animate-bounce shrink-0">
            <BellRing className="w-7 h-7 text-yellow-300" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start font-black text-lg sm:text-xl tracking-wide uppercase">
              <ShieldAlert className="w-6 h-6 text-yellow-300" />
              <span>ALERME EN COURS — SERVEURS & ADMIN</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1 justify-center sm:justify-start">
              <span className="bg-yellow-400 text-red-950 font-black text-lg sm:text-xl px-3 py-0.5 rounded-xl border border-yellow-300 shadow-md">
                TABLE {alarm.tableId}
              </span>
              <p className="text-base font-bold text-red-100">
                {alarm.orderNumber ? `(Commande #${alarm.orderNumber})` : ''} — {alarm.message}
              </p>
            </div>
          </div>
        </div>

        <button
          id="stop-alarm-button"
          onClick={() => store.stopAlarm()}
          className="w-full sm:w-auto px-6 py-3 bg-yellow-400 hover:bg-yellow-300 text-red-950 font-black rounded-xl shadow-xl transform active:scale-95 transition-all flex items-center justify-center space-x-2 text-base uppercase tracking-wider cursor-pointer border-2 border-yellow-300"
        >
          <VolumeX className="w-6 h-6 text-red-950" />
          <span>ARRÊTER L'ALARME ET MUSIQUE</span>
        </button>
      </div>
    </div>
  );
};
