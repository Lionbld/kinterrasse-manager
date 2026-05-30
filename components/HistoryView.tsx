import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { Order, Product, User, UserRole } from '../types';

interface HistoryViewProps {
  orders: Order[];
  users: User[];
  products: Product[];
  currentUser: User;
  isAdminOrGerant: boolean;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ orders, users, products, currentUser, isAdminOrGerant }) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filterUserId, setFilterUserId] = useState<string>('all');

  const filteredOrders = orders.filter(o => {
    const now = new Date();
    const today = new Date(now).setHours(0,0,0,0);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).setHours(0,0,0,0);
    
    // Role-based baseline filtering
    let roleFilter = true;
    if (currentUser.role === UserRole.SERVEUR) roleFilter = o.createdAt >= today && o.serveurId === currentUser.id;
    else if (currentUser.role === UserRole.GERANT) roleFilter = o.createdAt >= lastWeek;
    
    // User filter
    const userFilter = filterUserId === 'all' || o.serveurId === filterUserId || o.cashierId === filterUserId;
    
    return roleFilter && userFilter;
  });

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-slate-900 dark:text-white font-bold">Historique des Ventes</h3>
          <select 
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-700 dark:text-slate-200"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
          >
            <option value="all">Tous les utilisateurs</option>
            {users.map(u => (
                <option key={u.id} value={u.id}>{u.nom}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase tracking-widest text-slate-500">
              <tr>
                <th className="p-4">Utilisateur</th>
                <th className="p-4">Table</th>
                <th className="p-4">Total</th>
                <th className="p-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredOrders
                .sort((a,b) => b.createdAt - a.createdAt)
                .map(o => {
                  const user = users.find(u => u.id === o.serveurId || u.id === o.cashierId);
                  const total = o.items.reduce((acc, item) => acc + (item.prixUnitaireUSD * item.quantite), 0);
                  return (
                    <tr 
                      key={o.id} 
                      className="text-slate-700 dark:text-slate-300 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      onClick={() => setSelectedOrder(o)}
                    >
                      <td className="p-4">{user ? user.nom : 'Inconnu'}</td>
                      <td className="p-4">T-{o.tableId}</td>
                      <td className="p-4 font-bold text-emerald-500">${total.toFixed(2)}</td>
                      <td className="p-4">{new Date(o.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
             onClick={() => setSelectedOrder(null)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 w-full max-w-lg shadow-2xl"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Détails de la Facture</h3>
              <button onClick={() => setSelectedOrder(null)} className="p-2 text-slate-500"><X size={24}/></button>
            </div>
            <div className="space-y-4">
              {selectedOrder.items.map((item, i) => {
                const product = products.find(p => p.id === item.productId);
                return (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="font-bold">{product?.nom || 'Produit inconnu'} x{item.quantite}</span>
                    <span>${(item.prixUnitaireUSD * item.quantite).toFixed(2)}</span>
                  </div>
                )
              })}
              <div className="border-t pt-4 font-bold flex justify-between">
                <span>Total</span>
                <span>${selectedOrder.items.reduce((acc, item) => acc + (item.prixUnitaireUSD * item.quantite), 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
