
import React, { useState, useMemo } from 'react';
import { 
  Table, Product, Order, Settings, TableStatus, OrderStatus, PaymentMode, User, UserRole 
} from '../types';
// Added ShoppingBag to the imports from lucide-react
import { X, Plus, Minus, CreditCard, Receipt, Trash2, Smartphone, DollarSign, Wallet, ShoppingBag } from 'lucide-react';

interface OrderModalProps {
  table: Table;
  orders: Order[];
  products: Product[];
  settings: Settings;
  onClose: () => void;
  onPlaceOrder: (items: { productId: string, quantite: number }[]) => void;
  onPayment: (orderId: string, mode: PaymentMode, txId?: string, clearTable?: boolean) => void;
  onUpdateTableStatus: (tableId: string, status: TableStatus) => void;
  onCancelOrder: (orderId: string) => void;
  currentUser: User;
}

import { motion, AnimatePresence } from 'motion/react';

const OrderModal: React.FC<OrderModalProps> = ({ 
  table, orders, products, settings, onClose, onPlaceOrder, onPayment, onUpdateTableStatus, onCancelOrder, currentUser 
}) => {
  const [view, setView] = useState<'menu' | 'bill' | 'pay'>('menu');
  const [cart, setCart] = useState<{ productId: string, quantite: number }[]>([]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [clearTable, setClearTable] = useState(true);
  const [now, setNow] = useState(Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeOrder = orders.find(o => o.statut !== OrderStatus.PAYE);
  const unpaidOrders = orders.filter(o => o.statut !== OrderStatus.PAYE);
  const isPaidOccupied = unpaidOrders.length === 0 && table.statut === TableStatus.OCCUPEE;
  const lastPaidOrder = orders.filter(o => o.statut === OrderStatus.PAYE).sort((a,b) => b.createdAt - a.createdAt)[0];
  const canFreeTable = isPaidOccupied && (currentUser.role === UserRole.CAISSIER || currentUser.role === UserRole.ADMIN || (lastPaidOrder && lastPaidOrder.serveurId === currentUser.id));

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const p = products.find(prod => prod.id === item.productId);
      return acc + (p?.prixUSD || 0) * item.quantite;
    }, 0);
  }, [cart, products]);

  const billTotalUSD = useMemo(() => {
    return unpaidOrders.reduce((acc, order) => 
        acc + order.items.reduce((accItem, item) => accItem + (item.prixUnitaireUSD * item.quantite), 0), 
    0);
  }, [unpaidOrders]);

  const billTotalCDF = billTotalUSD * settings.tauxUSD_CDF;
  const taxeUSD = billTotalUSD * (settings.taxeDGRK / 100);
  const totalWithTaxeUSD = billTotalUSD + taxeUSD;

  const handleAddToCart = (pId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === pId);
      if (existing) {
        return prev.map(i => i.productId === pId ? { ...i, quantite: i.quantite + 1 } : i);
      }
      return [...prev, { productId: pId, quantite: 1 }];
    });
  };

  const handleRemoveFromCart = (pId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === pId);
      if (existing && existing.quantite > 1) {
        return prev.map(i => i.productId === pId ? { ...i, quantite: i.quantite - 1 } : i);
      }
      return prev.filter(i => i.productId !== pId);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4">
      <motion.div 
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-full max-w-md md:max-w-2xl bg-slate-50 dark:bg-slate-900 rounded-t-[3rem] md:rounded-[2rem] p-6 shadow-2xl flex flex-col max-h-[90vh] md:max-h-[85vh] border-t md:border border-slate-200 dark:border-slate-800"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6 px-2">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Table {table.numero}</h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {activeOrder ? 'Commande Active' : 'Nouvelle Commande'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400">
            <X size={24} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-2xl mb-6">
            <button 
                onClick={() => setView('menu')}
                className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${view === 'menu' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400'}`}
            >
                <Plus size={16} /> Menu
            </button>
            <button 
                onClick={() => setView('bill')}
                disabled={!activeOrder}
                className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${view === 'bill' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 disabled:opacity-30'}`}
            >
                <Receipt size={16} /> Facture
            </button>
            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CAISSIER) && (
              <button 
                  onClick={() => setView('pay')}
                  disabled={!activeOrder}
                  className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${view === 'pay' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 disabled:opacity-30'}`}
              >
                  <CreditCard size={16} /> Paiement
              </button>
            )}
        </div>

        {/* Views */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 px-1">
          <AnimatePresence mode="wait">
            {view === 'menu' && (
              <motion.div 
                key="menu"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {/* Products by category */}
                {['Bière', 'Sucré', 'Forte', 'Cuisine'].map(cat => (
                  <div key={cat}>
                    <h3 className="text-[10px] font-black uppercase text-slate-500 mb-3 tracking-[0.2em]">{cat}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {products.filter(p => p.categorie === cat).map(p => (
                        <div key={p.id} className="flex items-center bg-white dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100">{p.nom}</h4>
                            <div className="flex items-baseline gap-2 mt-0.5">
                              <span className="text-sm font-bold text-emerald-500">${p.prixUSD.toFixed(2)}</span>
                              <span className="text-[10px] font-medium text-slate-500">{(p.prixUSD * settings.tauxUSD_CDF).toLocaleString()} FC</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                              <button onClick={() => handleRemoveFromCart(p.id)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  <Minus size={16} />
                              </button>
                              <span className="font-bold w-4 text-center">{cart.find(i => i.productId === p.id)?.quantite || 0}</span>
                              <button onClick={() => handleAddToCart(p.id)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
                                  <Plus size={16} />
                              </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {view === 'bill' && unpaidOrders.length > 0 && (
              <motion.div 
                key="bill"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-white dark:bg-slate-800/40 rounded-3xl p-6 border border-slate-200 dark:border-slate-800">
                      <div className="space-y-6 mb-6">
                        {unpaidOrders.map((order, orderIdx) => (
                          <div key={orderIdx} className="space-y-2">
                             <h4 className="text-[10px] font-black uppercase text-slate-500">Commande {orderIdx+1} ({new Date(order.createdAt).toLocaleTimeString()})</h4>
                             {order.items.map((item, idx) => {
                                 const p = products.find(prod => prod.id === item.productId);
                                 return (
                                     <div key={idx} className="flex justify-between items-center text-sm">
                                         <span className="text-slate-500 dark:text-slate-400 font-medium">
                                             <b className="text-slate-800 dark:text-slate-200 mr-2">{item.quantite}x</b> {p?.nom}
                                         </span>
                                         <span className="font-bold">${(item.prixUnitaireUSD * item.quantite).toFixed(2)}</span>
                                     </div>
                                 )
                             })}
                          </div>
                        ))}
                      </div>
                      
                      <div className="border-t border-slate-700/50 pt-4 space-y-2">
                          <div className="flex justify-between items-center text-xs text-slate-500">
                              <span>Taxe de Consommation (DGRK {settings.taxeDGRK}%)</span>
                              <span>${taxeUSD.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-end pt-2">
                              <div>
                                  <span className="text-xs uppercase font-bold text-slate-500 block mb-1">Total à Payer</span>
                                  <span className="text-4xl font-black text-slate-900 dark:text-white">${totalWithTaxeUSD.toFixed(2)}</span>
                              </div>
                              <div className="text-right">
                                  <span className="text-lg font-black text-emerald-500">{(totalWithTaxeUSD * settings.tauxUSD_CDF).toLocaleString()} FC</span>
                                  <span className="text-[10px] block text-slate-500 uppercase font-bold">Francs Congolais</span>
                              </div>
                          </div>
                      </div>
                </div>

                {unpaidOrders.some(o => o.vidangesDues > 0) && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-4">
                      <div className="p-3 bg-amber-500/20 rounded-xl text-amber-500">
                          <ShoppingBag size={24} />
                      </div>
                      <div>
                          <h4 className="font-bold text-amber-500">Vidanges Dues: {unpaidOrders.reduce((acc, o) => acc + o.vidangesDues, 0)}</h4>
                          <p className="text-[10px] text-amber-500/80">Veuillez récupérer les bouteilles vides.</p>
                      </div>
                  </div>
                )}
              </motion.div>
            )}

            {view === 'pay' && (
              <motion.div 
                key="pay"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                  <h3 className="text-lg font-bold">Sélectionner Mode de Paiement</h3>
                  <div className="grid grid-cols-2 gap-3">
                      {[
                          { id: PaymentMode.CASH_USD, label: 'Cash USD', icon: <DollarSign size={20}/> },
                          { id: PaymentMode.CASH_CDF, label: 'Cash CDF', icon: <Wallet size={20}/> },
                          { id: PaymentMode.M_PESA, label: 'M-Pesa', icon: <Smartphone size={20}/> },
                          { id: PaymentMode.AIRTEL_MONEY, label: 'Airtel Money', icon: <Smartphone size={20}/> },
                          { id: PaymentMode.ORANGE_MONEY, label: 'Orange Money', icon: <Smartphone size={20}/> },
                      ].map(mode => (
                          <button 
                              key={mode.id}
                              onClick={() => setPaymentMode(mode.id)}
                              className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${paymentMode === mode.id ? 'bg-indigo-600 border-indigo-400 shadow-xl' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'}`}
                          >
                              {mode.icon}
                              <span className="text-xs font-bold">{mode.label}</span>
                          </button>
                      ))}
                  </div>

                  {(paymentMode && paymentMode.includes('MONEY')) && (
                      <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase">Numéro de Transaction</label>
                          <input 
                              type="text" 
                              placeholder="Entrez ID de transaction..." 
                              value={transactionId}
                              onChange={(e) => setTransactionId(e.target.value)}
                              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                          />
                      </div>
                  )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Actions */}
        <div className="pt-6 shrink-0">
          {view === 'menu' && (
            <div className="space-y-4">
                <div className="text-center text-[10px] text-rose-500 font-bold bg-rose-500/10 p-2 rounded-xl">
                    ⚠️ Toute facture envoyée ne peut être annulée que par la caisse dans les 5 minutes. Passé ce délai, elle doit impérativement être payée.
                </div>
                {isPaidOccupied ? (
                    <>
                        {canFreeTable ? (
                            <button 
                                onClick={() => {
                                    onUpdateTableStatus(table.id, TableStatus.LIBRE);
                                    onClose();
                                }}
                                className="w-full p-4 rounded-2xl border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center gap-2 hover:bg-emerald-500/10 transition-colors"
                            >
                                Libérer la table (Note Règlée)
                            </button>
                        ) : (
                            <div className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-center text-slate-500 text-xs font-bold uppercase tracking-widest border-2 border-indigo-500/20 text-indigo-500">
                                Accès restreint: Note déjà payée
                            </div>
                        )}
                    </>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {activeOrder && (currentUser.role === UserRole.SERVEUR || currentUser.role === UserRole.ADMIN) && (
                              <button 
                                onClick={() => {
                                    onUpdateTableStatus(table.id, TableStatus.ATTENTE_PAIEMENT);
                                    onClose();
                                }}
                                className="p-4 rounded-2xl border-2 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold flex items-center justify-center gap-2"
                            >
                                Demander Facture
                            </button>
                        )}
                        {(currentUser.role === UserRole.SERVEUR || currentUser.role === UserRole.ADMIN) ? (
                          <button 
                              onClick={() => {
                                  onPlaceOrder(cart);
                                  setCart([]);
                                  onClose();
                              }}
                              disabled={cart.length === 0}
                              className={`col-span-${(activeOrder && (currentUser.role === UserRole.SERVEUR || currentUser.role === UserRole.ADMIN)) ? '1' : '2'} flex-1 p-4 rounded-2xl bg-indigo-600 text-white font-black text-lg shadow-xl shadow-indigo-500/20 disabled:opacity-50 transition-all hover:scale-[1.02]`}
                          >
                              Envoyer ({cartTotal.toFixed(2)}$)
                          </button>
                        ) : (
                          <div className="col-span-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-center text-slate-500 text-xs font-bold uppercase tracking-widest">
                              Lecture Seule
                          </div>
                        )}
                    </div>
                )}
            </div>
          )}

          {view === 'bill' && activeOrder && (currentUser.role === UserRole.CAISSIER || currentUser.role === UserRole.ADMIN) && (
              <div className="space-y-4">
                  {Date.now() - activeOrder.createdAt <= 5 * 60 * 1000 ? (
                      <button 
                          onClick={() => {
                              onCancelOrder(activeOrder.id);
                              onClose();
                          }}
                          className="w-full flex items-center justify-center gap-2 text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-900/20 py-2 rounded-xl text-xs font-bold transition-colors"
                      >
                          <Trash2 size={16} /> Annuler la commande (Temps restant: {Math.max(0, Math.ceil((5 * 60 * 1000 - (Date.now() - activeOrder.createdAt)) / 1000))}s)
                      </button>
                  ) : (
                      <div className="w-full text-center text-[10px] text-rose-500 font-bold bg-rose-500/10 p-2 rounded-xl">
                          Le délai d'annulation (5 min) est dépassé. Cette commande doit être payée.
                      </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mt-2">
                      <button 
                          onClick={() => {
                              import('../utils/printReceipt').then(m => {
                                  m.printReceipt(activeOrder, products, settings, table, currentUser.nom);
                              });
                          }}
                          className="p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-700 hover:bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold transition-all"
                      >
                          Imprimer Note
                      </button>
                      <button 
                        onClick={() => setView('pay')}
                        className="p-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white font-black text-xl shadow-xl shadow-emerald-500/20 transition-all"
                    >
                        Payer
                    </button>
                  </div>
              </div>
          )}

          {view === 'pay' && (
              <div className="space-y-4">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer hover:bg-white dark:bg-slate-800 transition-colors">
                      <input 
                          type="checkbox" 
                          checked={clearTable}
                          onChange={(e) => setClearTable(e.target.checked)}
                          className="w-5 h-5 rounded bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                      />
                      <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Libérer la table</span>
                          <span className="text-[10px] text-slate-500">Décochez si le client a payé mais continue de consommer.</span>
                      </div>
                  </label>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => setView('bill')}
                        className="p-4 rounded-2xl border-2 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold"
                    >
                        Retour
                    </button>
                    <button 
                        onClick={() => {
                            if (paymentMode && activeOrder) {
                                // @ts-ignore - The parent component will handle passing the 4th argument
                                onPayment(activeOrder.id, paymentMode, transactionId, clearTable);
                                import('../utils/printReceipt').then(m => {
                                    m.printReceipt(activeOrder, products, settings, table, currentUser.nom, undefined, paymentMode);
                                });
                                onClose();
                            }
                        }}
                        disabled={!paymentMode || (paymentMode.includes('MONEY') && !transactionId)}
                        className="p-4 rounded-2xl bg-emerald-600 text-white font-black shadow-xl shadow-emerald-500/20 disabled:opacity-50"
                    >
                        Valider & Imprimer
                    </button>
                  </div>
              </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default OrderModal;
