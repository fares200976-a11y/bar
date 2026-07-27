import React, { useState } from 'react';
import { X, Clock, CheckCircle2, Receipt, Bell, Star } from 'lucide-react';
import { Order, RestaurantSettings } from '../../types';
import { formatCurrency, formatTimeOnly, getOrderStatusLabel } from '../../utils/formatters';

interface OrderStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: Order;
  settings: RestaurantSettings;
  onCallWaiter: () => void;
  onRequestBill: () => void;
  onSubmitReview: (rating: number, comment?: string) => Promise<{ success: boolean; message?: string }>;
}

export const OrderStatusModal: React.FC<OrderStatusModalProps> = ({
  isOpen,
  onClose,
  order,
  settings,
  onCallWaiter,
  onRequestBill,
  onSubmitReview,
}) => {
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  if (!isOpen || !order) return null;

  const handleSubmitReview = async () => {
    if (reviewRating === 0) return;
    setIsSubmittingReview(true);
    const result = await onSubmitReview(reviewRating, reviewComment || undefined);
    setIsSubmittingReview(false);
    if (result.success) {
      setReviewSubmitted(true);
    }
  };


  const total = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const steps = [
    { key: 'en_attente_validation', label: 'Envoyée', desc: 'Reçue par le serveur' },
    { key: 'nouvelle', label: 'Confirmée', desc: 'Transmise en cuisine' },
    { key: 'en_preparation', label: 'En préparation', desc: 'Le chef prépare vos plats' },
    { key: 'prete', label: 'Prête', desc: 'Vos assiettes sont prêtes' },
    { key: 'servie', label: 'Servie', desc: 'Bon appétit à table !' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === order.status);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400">
              <Clock className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="font-bold text-base">Suivi Commande #{order.orderNumber}</h3>
              <p className="text-xs text-slate-300">
                Table {order.tableId} • Enregistrée à {formatTimeOnly(order.createdAt)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Timeline */}
        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Étape Actuelle</span>
              <span className="text-xs font-extrabold text-amber-500 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 rounded-full border border-amber-200 dark:border-amber-900/50">
                {getOrderStatusLabel(order.status)}
              </span>
            </div>

            {/* Stepper */}
            <div className="relative flex items-center justify-between mt-6">
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 z-0" />
              <div
                className="absolute top-1/2 left-0 h-1 bg-amber-500 -translate-y-1/2 z-0 transition-all duration-500"
                style={{
                  width: `${(Math.max(0, currentStepIndex) / (steps.length - 1)) * 100}%`,
                }}
              />

              {steps.map((step, idx) => {
                const isCompleted = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div key={step.key} className="relative z-10 flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        isCurrent
                          ? 'bg-amber-500 text-white ring-4 ring-amber-100 dark:ring-amber-950 scale-110'
                          : isCompleted
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-2 text-center max-w-[70px]">
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ordered items summary */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 max-h-48 overflow-y-auto space-y-2">
            <p className="text-xs font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-700">
              Plats commandés :
            </p>
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs py-1">
                <span className="text-slate-800 dark:text-slate-200 font-medium">
                  {item.quantity}x {item.name}
                </span>
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {formatCurrency(item.unitPrice * item.quantity, settings.currency)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
              <span>Total Produits</span>
              <span className="text-rose-600 dark:text-rose-400">{formatCurrency(total, settings.currency)}</span>
            </div>
          </div>

          {/* Formulaire de satisfaction — uniquement une fois la commande servie */}
          {order.status === 'servie' && (
            <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 space-y-3">
              {reviewSubmitted ? (
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 text-center py-2">
                  Merci pour votre avis ! 🙏
                </p>
              ) : (
                <>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Votre avis nous intéresse :</p>
                  <div className="flex items-center justify-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} onClick={() => setReviewRating(star)} type="button">
                        <Star
                          className={`w-7 h-7 transition-colors ${
                            star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Un commentaire (facultatif)..."
                    className="w-full bg-white dark:bg-slate-900 text-xs p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50"
                  />
                  <button
                    onClick={handleSubmitReview}
                    disabled={reviewRating === 0 || isSubmittingReview}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs"
                  >
                    {isSubmittingReview ? 'Envoi...' : 'Envoyer mon avis'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Action Call / Bill Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={onCallWaiter}
              className="flex items-center justify-center gap-2 p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-bold text-xs transition-colors"
            >
              <Bell className="w-4 h-4 text-rose-500" />
              <span>Appeler Serveur</span>
            </button>

            <button
              onClick={onRequestBill}
              className="flex items-center justify-center gap-2 p-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-rose-500/20 transition-colors"
            >
              <Receipt className="w-4 h-4" />
              <span>Demander Addition</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
