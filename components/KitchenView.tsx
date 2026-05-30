
import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, Product, User, UserRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, CheckCircle, AlertCircle, Bell } from 'lucide-react';

interface KitchenViewProps {
  orders: Order[];
  products: Product[];
  currentUser: User;
  onMarkReady: (orderId: string) => void;
}

const KitchenView: React.FC<KitchenViewProps> = ({ orders, products, currentUser, onMarkReady }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeKitchenOrders = orders
    .filter(o => o.statut === OrderStatus.EN_COURS)
    .sort((a, b) => a.createdAt - b.createdAt);

  const getProductName = (id: string) => products.find(p => p.id === id)?.nom || 'Produit inconnu';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Cuisine</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Commandes en attente de préparation
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700">
          <span className="text-indigo-400 font-black text-xl">{activeKitchenOrders.length}</span>
          <span className="text-slate-500 text-[10px] font-bold uppercase ml-2">En attente</span>
        </div>
      </div>

      {activeKitchenOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-100 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 mb-4">
            <CheckCircle size={32} />
          </div>
          <p className="text-slate-500 font-bold">Aucune commande en cours</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {activeKitchenOrders.map(order => {
              const elapsedMs = now - order.createdAt;
              const elapsedMins = Math.floor(elapsedMs / 60000);
              const isLate = elapsedMins >= 15;

              return (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 overflow-hidden flex flex-col ${isLate ? 'border-rose-500/50 shadow-lg shadow-rose-500/5' : 'border-slate-200 dark:border-slate-800'}`}
                >
                  <div className={`p-4 flex justify-between items-center ${isLate ? 'bg-rose-500/10' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg ${isLate ? 'bg-rose-500 text-slate-900 dark:text-white' : 'bg-indigo-600 text-white'}`}>
                        {order.id.slice(-3).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-slate-900 dark:text-white font-bold text-sm">Table {order.tableId.slice(-2)}</p>
                        <p className="text-slate-500 text-[10px] font-bold uppercase">ID: {order.id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs ${isLate ? 'bg-rose-500 text-slate-900 dark:text-white animate-pulse' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                      <Clock size={14} />
                      {elapsedMins}m
                    </div>
                  </div>

                  <div className="p-5 flex-1 space-y-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-indigo-400">
                            {item.quantite}
                          </div>
                          <span className="text-slate-800 dark:text-slate-200 font-medium text-sm">{getProductName(item.productId)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-white dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => onMarkReady(order.id)}
                      className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white font-black flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/20"
                    >
                      <Bell size={18} />
                      SIGNALER PRÊT
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Late Orders Alert */}
      {activeKitchenOrders.some(o => (now - o.createdAt) >= 15 * 60000) && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50 border-2 border-rose-400"
        >
          <AlertCircle size={20} />
          <span className="font-black text-sm uppercase tracking-wider">Attention: Commandes en retard !</span>
        </motion.div>
      )}
    </div>
  );
};

export default KitchenView;
