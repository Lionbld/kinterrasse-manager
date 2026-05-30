
import React from 'react';
import { Table, TableStatus, Order, OrderStatus, User, UserRole } from '../types';
import { Users, Clock } from 'lucide-react';

interface DashboardProps {
  tables: Table[];
  orders: Order[];
  onTableClick: (table: Table) => void;
  currentUser: User;
  users?: User[];
}

import { motion } from 'motion/react';

const Dashboard: React.FC<DashboardProps> = ({ tables, orders, onTableClick, currentUser, users = [] }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Salles & Tables</h2>
            <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full animate-pulse ${currentUser.role === UserRole.ADMIN ? 'bg-indigo-500' : currentUser.role === UserRole.CAISSIER ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Mode {currentUser.role === UserRole.ADMIN ? 'Gérant' : currentUser.role === UserRole.CAISSIER ? 'Caisse' : 'Service'}
                </span>
            </div>
        </div>
        <div className="flex gap-2 text-[9px] md:text-[10px] items-center flex-wrap mt-2 md:mt-0">
            <span className="flex items-center gap-1 font-bold bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-full border border-emerald-500/20">
                Libre
            </span>
            <span className="flex items-center gap-1 font-bold bg-rose-500/10 text-rose-500 px-2 py-1 rounded-full border border-rose-500/20">
                <span className="w-2 h-2 rounded-full animate-pulse bg-rose-500" /> Non-payé
            </span>
            <span className="flex items-center gap-1 font-bold bg-indigo-500/10 text-indigo-500 px-2 py-1 rounded-full border border-indigo-500/20">
                <span className="w-2 h-2 rounded-full animate-pulse bg-indigo-500" /> Payé
            </span>
            <span className="flex items-center gap-1 font-bold bg-amber-500/10 text-amber-500 px-2 py-1 rounded-full border border-amber-500/20">
                Attente
            </span>
        </div>
      </div>

      <motion.div 
        className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4"
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.05 } }
        }}
      >
        {tables.map(table => {
          const activeOrder = orders.find(o => o.tableId === table.id && o.statut !== OrderStatus.PAYE);
          const serverName = activeOrder ? users.find(u => u.id === activeOrder.serveurId)?.nom : null;
          
          return (
            <motion.button 
              key={table.id}
              onClick={() => onTableClick(table)}
              variants={{
                hidden: { opacity: 0, scale: 0.8 },
                visible: { opacity: 1, scale: 1 }
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                relative flex flex-col items-center justify-center aspect-square rounded-3xl border-2 transition-all
                ${table.statut === TableStatus.LIBRE ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-600 dark:text-emerald-400' : ''}
                ${table.statut === TableStatus.OCCUPEE && activeOrder ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 shadow-lg shadow-rose-500/10 animate-pulse' : ''}
                ${table.statut === TableStatus.OCCUPEE && !activeOrder ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-lg shadow-indigo-500/10 animate-pulse' : ''}
                ${table.statut === TableStatus.ATTENTE_PAIEMENT ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 shadow-lg shadow-amber-500/10 animate-pulse' : ''}
              `}
            >
              <span className="text-3xl font-black">{table.numero}</span>
              <span className="text-[10px] font-bold uppercase mt-1 tracking-widest opacity-80">Table</span>
              
              {activeOrder && (
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                  <div className="flex items-center gap-0.5 text-[8px] font-bold bg-white/10 rounded-full px-1.5 py-0.5">
                      <Clock size={8} />
                      {new Date(activeOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {serverName && (
                    <div className="flex items-center gap-0.5 text-[7px] font-bold bg-white/10 rounded-full px-1.5 py-0.5 text-slate-900 dark:text-white whitespace-nowrap">
                        <Users size={7} />
                        {serverName}
                    </div>
                  )}
                </div>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
};

export default Dashboard;
