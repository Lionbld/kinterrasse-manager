import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Settings, Order, Product, OrderStatus, PaymentMode, User, UserRole, Expense, Table, TableStatus, StaffActivity } from '../types';
import { 
  FileText, TrendingUp, RefreshCcw, 
  ChevronRight, AlertCircle, BarChart3, 
  Settings as Cog, Settings as SettingsIcon, Save, Users, Package, 
  Plus, Trash2, Edit2, Check, X, Search,
  Wallet, BarChart
} from 'lucide-react';
import { 
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';

interface AdminPanelProps {
  settings: Settings;
  allSettings?: (Settings & { id: string })[];
  orders: Order[];
  products: Product[];
  users: User[];
  expenses: Expense[];
  tables: Table[];
  onUpdateSettings: (s: Settings) => Promise<void> | void;
  onUpdateProducts: (p: Product[]) => Promise<void> | void;
  onAddProduct: (p: Omit<Product, 'id' | 'restaurantId'>) => Promise<void> | void;
  onDeleteProduct: (id: string) => Promise<void> | void;
  onAddTable: (numero: number) => Promise<void> | void;
  onDeleteTable: (id: string) => Promise<void> | void;
  onCreateUser: (u: Omit<User, 'id'>, uid: string) => Promise<void> | void;
  onUpdateUser: (id: string, data: Partial<User>) => Promise<void> | void;
  onDeleteUser: (id: string) => Promise<void> | void;
  onDeleteEstablishment?: (id: string) => Promise<void> | void;
  onAddExpense: (e: Omit<Expense, 'id' | 'date' | 'createdBy' | 'restaurantId'>) => Promise<void> | void;
  staffActivity: StaffActivity[];
  currentUser: User;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  settings, allSettings = [], orders, products, users, expenses, tables,
  onUpdateSettings, onUpdateProducts, onAddProduct, onDeleteProduct,
  onAddTable, onDeleteTable,
  onCreateUser, onUpdateUser, onDeleteUser, onDeleteEstablishment, onAddExpense, staffActivity, currentUser 
}) => {
  const [localTaux, setLocalTaux] = useState(settings.tauxUSD_CDF);
  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [activeTab, setActiveTab] = useState<'cloture' | 'stock' | 'users' | 'config' | 'expenses' | 'performance' | 'staff' | 'saas' | 'tables' | 'logs' | 'history'>('cloture');
  const [showAddEstablishment, setShowAddEstablishment] = useState(false);
  const [newEstData, setNewEstData] = useState({
    nom: '',
    adresse: '',
    telephone: '',
    taux: 2850,
    ownerEmail: '',
    adminPassword: '',
    months: 1,
    stockManagementEnabled: true
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [performanceFilterUid, setPerformanceFilterUid] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [confirmDeleteEstId, setConfirmDeleteEstId] = useState<string | null>(null);
  const [editingProductData, setEditingProductData] = useState<Product | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const isSuperAdmin = ['lionlnl21@gmail.com'].includes(currentUser.email?.toLowerCase());
  const isAdminOrGerant = isSuperAdmin || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.GERANT;

  const [newProductData, setNewProductData] = useState<Omit<Product, 'id' | 'restaurantId'>>({
    nom: '',
    categorie: 'Bière',
    prixUSD: 0,
    stockActuel: 0,
    seuilAlerte: 5,
    besoinVidange: true
  });

  const [newUserData, setNewUserData] = useState({
    nom: '',
    identifiant: '',
    role: UserRole.SERVEUR,
    pin: ''
  });

  const handleExtendSubscription = async (id: string, months: number, currentEndsAt: number | undefined) => {
    try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        let startFrom = currentEndsAt || Date.now();
        if (startFrom < Date.now()) startFrom = Date.now();
        const newEndsAt = startFrom + (months * 30 * 24 * 60 * 60 * 1000);
        await updateDoc(doc(db, 'settings', id), {
            'subscription.endsAt': newEndsAt,
            'subscription.status': 'ACTIVE'
        });
        setNotification({ type: 'success', message: `Abonnement prolongé de ${months} mois` });
    } catch (err) {
        setNotification({ type: 'error', message: 'Erreur lors du renouvellement' });
    }
  };

  const handleToggleStockMode = async (id: string, currentVal: boolean) => {
    try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        await updateDoc(doc(db, 'settings', id), {
            stockManagementEnabled: !currentVal
        });
        setNotification({ message: `Préférence de stock mise à jour !`, type: 'success' });
        setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
        setNotification({ message: `Erreur: ${err.message}`, type: 'error' });
        setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleCreateEstablishment = async () => {
    if (!newEstData.nom || !newEstData.ownerEmail) return;
    
    const dataToSave = {
        nomEtablissement: newEstData.nom,
        adresse: newEstData.adresse,
        telephone: newEstData.telephone,
        tauxUSD_CDF: newEstData.taux,
        ownerEmail: newEstData.ownerEmail,
        stockManagementEnabled: newEstData.stockManagementEnabled,
        subscription: {
            status: 'ACTIVE' as const,
            endsAt: Date.now() + (newEstData.months * 30 * 24 * 60 * 60 * 1000)
        },
        logoUrl: '',
        idNat: '',
        rccm: '',
        nif: '',
        taxeDGRK: 0
    };

    const pwd = newEstData.adminPassword;
    const email = newEstData.ownerEmail;

    setShowAddEstablishment(false);
    setNewEstData({ nom: '', adresse: '', telephone: '', taux: 2850, ownerEmail: '', adminPassword: '', months: 1, stockManagementEnabled: true });

    try {
        const { collection, doc, setDoc } = await import('firebase/firestore');
        const { db, createStaffAccount } = await import('../firebase');
        const newEstRef = doc(collection(db, 'settings'));
        await setDoc(newEstRef, dataToSave);

        // Si le mot de passe est fourni, créer le compte Firebase Auth pour pouvoir se connecter par email
        if (pwd && pwd.length >= 6) {
           const uid = await createStaffAccount(email, pwd);
           await onCreateUser({
             nom: "Admin",
             identifiant: email.split('@')[0],
             email: email,
             telephone: dataToSave.telephone,
             role: UserRole.ADMIN,
             restaurantId: newEstRef.id
           }, uid);
        }

        setNotification({ type: 'success', message: 'Établissement créé avec succès' });
    } catch (err: any) {
        setNotification({ type: 'error', message: `Erreur lors de la création: ${err.message}` });
    }
  };

  const stats = React.useMemo(() => {
    const todayOrders = orders.filter(o => o.statut === OrderStatus.PAYE);
    
    let totalUSD = 0;
    let totalCDF = 0;
    let totalMobile = 0;
    let totalVidanges = orders.reduce((acc, o) => acc + o.vidangesDues, 0);

    const productSales: Record<string, number> = {};

    todayOrders.forEach(o => {
        const orderTotal = o.items.reduce((acc, item) => {
            productSales[item.productId] = (productSales[item.productId] || 0) + item.quantite;
            return acc + (item.prixUnitaireUSD * item.quantite);
        }, 0);
        const withTax = orderTotal * (1 + settings.taxeDGRK / 100);

        if (o.modePaiement === PaymentMode.CASH_USD) totalUSD += withTax;
        else if (o.modePaiement === PaymentMode.CASH_CDF) totalCDF += withTax * settings.tauxUSD_CDF;
        else if (o.modePaiement?.includes('MONEY')) totalMobile += withTax;
    });

    const topProducts = Object.entries(productSales)
        .map(([id, qty]) => ({ id, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

    return { totalUSD, totalCDF, totalMobile, totalVidanges, topProducts, productSales, todayOrders };
  }, [orders, settings]);

  useEffect(() => {
    setLocalSettings(settings);
    setLocalTaux(settings.tauxUSD_CDF);
  }, [settings]);

  const handleSaveTaux = async () => {
    try {
      await onUpdateSettings({ ...localSettings, tauxUSD_CDF: localTaux });
      setNotification({ message: "Paramètres mis à jour !", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ message: `Erreur: ${err.message}`, type: 'error' });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleCreateStaff = async () => {
    if (!newUserData.nom || !newUserData.identifiant || newUserData.pin.length < 6) {
      setNotification({ message: "Veuillez remplir tous les champs (PIN min 6 chiffres).", type: 'error' });
      return;
    }

    const userDataToSave = { ...newUserData };
    setShowAddUser(false);
    setNewUserData({ nom: '', identifiant: '', role: UserRole.SERVEUR, pin: '' });

    try {
      const { createStaffAccount } = await import('../firebase');
      const email = `${userDataToSave.identifiant.toLowerCase().replace(/\s/g, '')}@${currentUser.restaurantId}.pos`;
      const uid = await createStaffAccount(email, userDataToSave.pin);
      
      await onCreateUser({
        nom: userDataToSave.nom,
        identifiant: userDataToSave.identifiant,
        email: email,
        telephone: '',
        role: userDataToSave.role,
        restaurantId: currentUser.restaurantId
      }, uid);

      setNotification({ message: "Membre du staff ajouté !", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error: any) {
      let errorMessage = error.message;
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {}
      setNotification({ message: `Erreur: ${errorMessage}`, type: 'error' });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const generateReport = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Rapport de Clôture Détaillé', 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Établissement : ${settings.nomEtablissement || 'Non défini'}`, 14, 30);
      doc.text(`Date : ${new Date().toLocaleDateString()}`, 14, 36);

      // Financial Summary
      doc.setFontSize(14);
      doc.setTextColor(20);
      doc.text('Résumé Financier', 14, 50);
      doc.setFontSize(11);
      doc.setTextColor(50);
      doc.text(`Caisse USD : $${stats.totalUSD.toFixed(2)}`, 14, 60);
      doc.text(`Caisse CDF : ${stats.totalCDF.toLocaleString()} FC`, 14, 68);
      doc.text(`Mobile Money : $${stats.totalMobile.toFixed(2)}`, 14, 76);
      doc.text(`Vidanges Dues : ${stats.totalVidanges}`, 14, 84);

      // Sales Details
      doc.setFontSize(14);
      doc.setTextColor(20);
      doc.text('Détails des Ventes par Produit', 14, 100);

      const tableData = Object.entries(stats.productSales)
        .map(([productId, qty]) => {
            const product = products.find(p => p.id === productId);
            if (!product) return null;
            return [
                product.nom,
                product.categorie,
                `${qty}`,
                `$${(qty * product.prixUSD).toFixed(2)}`
            ];
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b[0].localeCompare(a[0]));

      (doc as any).autoTable({
        startY: 106,
        head: [['Produit', 'Catégorie', 'Qté Vendue', 'CA (USD)']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 10 }
      });

      // Today's Expenses
      const today = new Date().setHours(0,0,0,0);
      const todayExpenses = expenses.filter(e => e.date >= today);
      
      let finalY = (doc as any).lastAutoTable.finalY || 106;
      
      if (todayExpenses.length > 0) {
          doc.setFontSize(14);
          doc.setTextColor(20);
          doc.text('Dépenses du Jour', 14, finalY + 14);
          
          const expenseData = todayExpenses.map(e => [
              new Date(e.date).toLocaleTimeString(),
              e.description,
              e.categorie,
              `$${e.montantUSD.toFixed(2)}`
          ]);

          (doc as any).autoTable({
            startY: finalY + 20,
            head: [['Heure', 'Description', 'Catégorie', 'Montant']],
            body: expenseData,
            theme: 'grid',
            headStyles: { fillColor: [225, 29, 72] }, // rose-600
            styles: { fontSize: 10 }
          });
      }

      doc.save(`cloture_${new Date().toISOString().split('T')[0]}.pdf`);
      setNotification({ message: "Rapport PDF détaillé généré avec succès !", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ message: `Erreur: ${err.message}`, type: 'error' });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleSaveNewProduct = async () => {
    if (!newProductData.nom || newProductData.prixUSD <= 0) {
        setNotification({ message: "Veuillez remplir tous les champs correctement.", type: 'error' });
        return;
    }
    
    const productToSave = { ...newProductData };
    setShowAddProduct(false);
    setNewProductData({ nom: '', categorie: 'Bière', prixUSD: 0, stockActuel: 0, seuilAlerte: 5, besoinVidange: true });

    try {
      await onAddProduct(productToSave);
      setNotification({ message: "Produit ajouté !", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ message: `Erreur lors de l'ajout: ${err.message}`, type: 'error' });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleSaveEditProduct = async () => {
    if (!editingProductData) return;
    
    const productToUpdate = { ...editingProductData };
    setEditingProductData(null);

    try {
      await onUpdateProducts([productToUpdate]);
      setNotification({ message: "Produit mis à jour !", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ message: `Erreur de mise à jour: ${err.message}`, type: 'error' });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const generateStockReport = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Rapport de Stock', 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Généré le : ${new Date().toLocaleString()}`, 14, 30);

      const tableData = [...products].sort((a,b) => a.nom.localeCompare(b.nom)).map(p => [
        p.nom,
        p.categorie,
        `${p.stockActuel}`,
        `${p.seuilAlerte}`,
        p.stockActuel <= p.seuilAlerte ? 'CRITIQUE' : 'OK'
      ]);

      (doc as any).autoTable({
        startY: 40,
        head: [['Produit', 'Catégorie', 'Stock Actuel', 'Seuil Alerte', 'Statut']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 10 },
        columnStyles: {
            0: { fontStyle: 'bold' },
            4: { fontStyle: 'bold' }
        },
        willDrawCell: (data: any) => {
            if (data.row.section === 'body' && data.column.index === 4) {
                if (data.cell.raw === 'CRITIQUE') {
                    doc.setTextColor(220, 38, 38); // Text color rose-600
                } else {
                    doc.setTextColor(16, 185, 129); // Text color emerald-500
                }
            }
        }
      });

      doc.save(`rapport_stock_${new Date().toISOString().split('T')[0]}.pdf`);
      setNotification({ message: "Rapport PDF généré !", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ message: `Erreur lors de la génération: ${err.message}`, type: 'error' });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const filteredProducts = products.filter(p => 
    p.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.categorie.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Modals */}
      <AnimatePresence>
        {showAddEstablishment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white dark:bg-slate-950/80 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-slate-50 dark:bg-slate-900 w-full max-w-md rounded-3xl border-2 border-slate-200 dark:border-slate-800 p-6 shadow-2xl"
                >
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">Nouvel Établissement</h3>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nom</label>
                            <input 
                                type="text" 
                                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                                value={newEstData.nom}
                                onChange={(e) => setNewEstData({...newEstData, nom: e.target.value})}
                                placeholder="Nom du restaurant"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Email du Propriétaire (Obligatoire)</label>
                            <input 
                                type="email" 
                                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                                value={newEstData.ownerEmail}
                                onChange={(e) => setNewEstData({...newEstData, ownerEmail: e.target.value})}
                                placeholder="client@gmail.com"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Mot de passe Admin (Optionnel)</label>
                            <input 
                                type="password" 
                                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                                value={newEstData.adminPassword}
                                onChange={(e) => setNewEstData({...newEstData, adminPassword: e.target.value})}
                                placeholder="Min. 6 caractères"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Abonnement Initial (Mois)</label>
                            <input 
                                type="number" 
                                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                                value={newEstData.months}
                                onChange={(e) => setNewEstData({...newEstData, months: Number(e.target.value)})}
                                min="1"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Adresse</label>
                            <input 
                                type="text" 
                                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                                value={newEstData.adresse}
                                onChange={(e) => setNewEstData({...newEstData, adresse: e.target.value})}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Téléphone</label>
                            <input 
                                type="text" 
                                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                                value={newEstData.telephone}
                                onChange={(e) => setNewEstData({...newEstData, telephone: e.target.value})}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Taux (CDF)</label>
                            <input 
                                type="number" 
                                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                                value={newEstData.taux}
                                onChange={(e) => setNewEstData({...newEstData, taux: Number(e.target.value)})}
                            />
                        </div>
                        <div className="space-y-1 pt-2 md:col-span-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div className="relative">
                                    <input 
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={newEstData.stockManagementEnabled}
                                        onChange={(e) => setNewEstData({...newEstData, stockManagementEnabled: e.target.checked})}
                                    />
                                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                </div>
                                <div>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white block leading-none mb-1">Stock Stricte</span>
                                    <span className="text-xs text-slate-500">Si décoché, mode "Stock Infini" activé</span>
                                </div>
                            </label>
                        </div>
                    </div>
                    <div className="flex gap-3 mt-8">
                        <button 
                            onClick={() => setShowAddEstablishment(false)}
                            className="flex-1 p-3 rounded-xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 dark:bg-slate-700 transition-all"
                        >
                            Annuler
                        </button>
                    <button 
                        onClick={() => {
                            if (!newEstData.nom || !newEstData.ownerEmail) {
                                setNotification({ message: "Nom et Email obligatoires", type: 'error' });
                                return;
                            }
                            handleCreateEstablishment();
                        }}
                        className="flex-1 p-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                    >
                        Créer
                    </button>
                    </div>
                </motion.div>
            </div>
        )}

        {confirmDeleteEstId && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-6 shadow-2xl">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Confirmer</h3>
                        <button onClick={() => setConfirmDeleteEstId(null)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white">
                            <X size={24} />
                        </button>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Êtes-vous sûr de vouloir supprimer cet établissement définitivement ? Cette action est irréversible.</p>
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => setConfirmDeleteEstId(null)}
                            className="p-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:bg-slate-700"
                        >
                            Annuler
                        </button>
                        <button 
                            onClick={async () => {
                                if (onDeleteEstablishment) {
                                    try {
                                        await onDeleteEstablishment(confirmDeleteEstId);
                                        setNotification({ message: "Établissement supprimé", type: 'success' });
                                    } catch (e) {
                                        setNotification({ message: "Erreur de suppression", type: 'error' });
                                    }
                                    setConfirmDeleteEstId(null);
                                }
                            }}
                            className="p-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-500 shadow-lg shadow-rose-500/20"
                        >
                            Supprimer
                        </button>
                    </div>
                </div>
            </div>
        )}

        {(showAddProduct || editingProductData) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white dark:bg-slate-950/80 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 w-full max-w-lg shadow-2xl"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white">
                            {showAddProduct ? 'Ajouter un Produit' : 'Modifier le Produit'}
                        </h3>
                        <button onClick={() => { setShowAddProduct(false); setEditingProductData(null); }} className="p-2 text-slate-500 hover:text-slate-900 dark:text-white">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nom du Produit</label>
                            <input 
                                type="text" 
                                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-bold"
                                value={showAddProduct ? newProductData.nom : editingProductData?.nom}
                                onChange={(e) => showAddProduct ? setNewProductData({...newProductData, nom: e.target.value}) : setEditingProductData({...editingProductData!, nom: e.target.value})}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Catégorie</label>
                                <select 
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-bold"
                                    value={showAddProduct ? newProductData.categorie : editingProductData?.categorie}
                                    onChange={(e) => {
                                        const val = e.target.value as any;
                                        showAddProduct ? setNewProductData({...newProductData, categorie: val}) : setEditingProductData({...editingProductData!, categorie: val})
                                    }}
                                >
                                    <option value="Bière">Bière</option>
                                    <option value="Sucré">Sucré</option>
                                    <option value="Forte">Forte</option>
                                    <option value="Cuisine">Cuisine</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Prix (USD)</label>
                                <input 
                                    type="number" 
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-bold"
                                    value={showAddProduct ? newProductData.prixUSD : editingProductData?.prixUSD}
                                    onChange={(e) => showAddProduct ? setNewProductData({...newProductData, prixUSD: Number(e.target.value)}) : setEditingProductData({...editingProductData!, prixUSD: Number(e.target.value)})}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Stock Actuel</label>
                                <input 
                                    type="number" 
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-bold"
                                    value={showAddProduct ? newProductData.stockActuel : editingProductData?.stockActuel}
                                    onChange={(e) => showAddProduct ? setNewProductData({...newProductData, stockActuel: Number(e.target.value)}) : setEditingProductData({...editingProductData!, stockActuel: Number(e.target.value)})}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Seuil Alerte</label>
                                <input 
                                    type="number" 
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-bold"
                                    value={showAddProduct ? newProductData.seuilAlerte : editingProductData?.seuilAlerte}
                                    onChange={(e) => showAddProduct ? setNewProductData({...newProductData, seuilAlerte: Number(e.target.value)}) : setEditingProductData({...editingProductData!, seuilAlerte: Number(e.target.value)})}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl">
                            <input 
                                type="checkbox" 
                                id="vidange"
                                className="w-5 h-5 rounded accent-indigo-500"
                                checked={showAddProduct ? newProductData.besoinVidange : editingProductData?.besoinVidange}
                                onChange={(e) => showAddProduct ? setNewProductData({...newProductData, besoinVidange: e.target.checked}) : setEditingProductData({...editingProductData!, besoinVidange: e.target.checked})}
                            />
                            <label htmlFor="vidange" className="text-sm font-bold text-slate-700 dark:text-slate-300">Nécessite une vidange (bouteille consignée)</label>
                        </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                        <button 
                            onClick={() => { setShowAddProduct(false); setEditingProductData(null); }}
                            className="flex-1 p-4 rounded-2xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 dark:bg-slate-700 transition-all"
                        >
                            Annuler
                        </button>
                        <button 
                            onClick={showAddProduct ? handleSaveNewProduct : handleSaveEditProduct}
                            className="flex-1 p-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                        >
                            {showAddProduct ? 'Ajouter' : 'Enregistrer'}
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Administration</h2>
            {isSuperAdmin && localStorage.getItem('pos_restaurant_id') && (
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                    Mode SaaS : {settings.nomEtablissement}
                </span>
            )}
        </div>
        <div className="flex bg-white dark:bg-slate-800 rounded-xl p-1 overflow-x-auto max-w-full no-scrollbar">
            {[
                { id: 'cloture', label: 'Clôture', icon: <FileText size={14}/> },
                { id: 'tables', label: 'Tables', icon: <BarChart3 size={14}/> },
                { id: 'stock', label: 'Stock', icon: <Package size={14}/> },
                { id: 'expenses', label: 'Dépenses', icon: <Wallet size={14}/> },
                { id: 'staff', label: 'Staff', icon: <Users size={14}/> },
                { id: 'performance', label: 'Stats', icon: <BarChart size={14}/> },
                { id: 'history', label: 'Historique', icon: <FileText size={14}/> },
                { id: 'logs', label: 'Logs', icon: <FileText size={14}/> },
                { id: 'config', label: 'Config', icon: <Cog size={14}/> },
                { id: 'saas', label: 'SaaS', icon: <TrendingUp size={14}/> },
            ].filter(tab => {
                if (tab.id === 'saas') return isSuperAdmin;
                if (tab.id === 'stock') return true;
                
                if (isSuperAdmin || currentUser.role === UserRole.ADMIN) return true;
                if (currentUser.role === UserRole.GERANT) return ['cloture', 'tables', 'expenses', 'staff', 'performance', 'history', 'logs'].includes(tab.id);
                if (currentUser.role === UserRole.CAISSIER) return tab.id === 'cloture';
                if (currentUser.role === UserRole.SERVEUR) return ['history'].includes(tab.id);
                
                return false;
            }).map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)} 
                    className={`px-3 py-2 rounded-lg text-[10px] md:text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'}`}
                >
                    {tab.icon}
                    {tab.label}
                </button>
            ))}
        </div>
      </div>

      {notification && (
        <div className={`p-4 rounded-2xl text-sm font-bold text-center animate-in slide-in-from-top duration-300 ${notification.type === 'success' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
          {notification.message}
        </div>
      )}

      {activeTab === 'cloture' && (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-500 block mb-2 tracking-widest">Caisse USD</span>
                    <span className="text-2xl font-black text-emerald-500">${stats.totalUSD.toFixed(2)}</span>
                </div>
                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-500 block mb-2 tracking-widest">Caisse CDF</span>
                    <span className="text-lg font-black text-emerald-500 leading-tight">{stats.totalCDF.toLocaleString()} FC</span>
                </div>
                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-500 block mb-2 tracking-widest">Mobile Money</span>
                    <span className="text-2xl font-black text-blue-500">${stats.totalMobile.toFixed(2)}</span>
                </div>
                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-500 block mb-2 tracking-widest">Vidanges Dues</span>
                    <span className="text-2xl font-black text-amber-500">{stats.totalVidanges}</span>
                </div>
            </div>

            <button 
                onClick={generateReport}
                className="w-full p-5 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
            >
                <FileText size={24} />
                Exporter Clôture Détaillée (PDF)
            </button>

            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-6">
                    <BarChart3 className="text-indigo-400" size={20} />
                    <h3 className="font-bold">Top Produits Ventes (Aujourd'hui)</h3>
                </div>
                <div className="space-y-6">
                    {stats.topProducts.length > 0 ? stats.topProducts.map((item, i) => {
                        const p = products.find(prod => prod.id === item.id);
                        const maxQty = stats.topProducts[0].qty;
                        const percentage = (item.qty / maxQty) * 100;
                        
                        return (
                            <div key={item.id} className="flex items-center gap-4">
                                <span className="text-lg font-black text-slate-700 w-6">0{i+1}</span>
                                <div className="flex-1">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-bold block text-slate-800 dark:text-slate-200">{p?.nom || 'Produit inconnu'}</span>
                                        <span className="text-xs font-bold text-indigo-400">{item.qty} vdus</span>
                                    </div>
                                    <div className="h-2 w-full bg-white dark:bg-slate-800 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${percentage}%` }}
                                            className="h-full bg-indigo-500" 
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="text-center py-10 text-slate-500">
                            <BarChart3 size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="font-bold">Aucune vente enregistrée aujourd'hui</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {activeTab === 'tables' && (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex flex-col">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Gestion des Tables</h3>
                    <p className="text-slate-500 text-xs">Ajoutez ou supprimez des tables.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <input 
                        type="number" 
                        placeholder="N° table"
                        id="new-table-num"
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex-1 sm:w-32 rounded-2xl py-3 px-4 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                    />
                    <button 
                        onClick={async () => {
                            const input = document.getElementById('new-table-num') as HTMLInputElement;
                            const num = parseInt(input.value);
                            if (!isNaN(num)) {
                                try {
                                    await onAddTable(num);
                                    input.value = '';
                                    setNotification({ message: "Table ajoutée", type: 'success' });
                                    setTimeout(() => setNotification(null), 3000);
                                } catch (err: any) {
                                    setNotification({ message: `Erreur: ${err.message}`, type: 'error' });
                                    setTimeout(() => setNotification(null), 5000);
                                }
                            }
                        }}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                    >
                        Ajouter
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[...tables].sort((a,b) => a.numero - b.numero).map(t => (
                    <div key={t.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 flex flex-col items-center justify-center relative group">
                        <span className="text-2xl font-black text-slate-700 dark:text-slate-300 mb-1">{t.numero}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Table</span>
                        <button 
                            onClick={async () => {
                                try {
                                    await onDeleteTable(t.id);
                                    setNotification({ message: "Table supprimée", type: 'success' });
                                    setTimeout(() => setNotification(null), 3000);
                                } catch (err: any) {
                                    setNotification({ message: `Erreur: ${err.message}`, type: 'error' });
                                    setTimeout(() => setNotification(null), 5000);
                                }
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-rose-500/10 text-rose-500 rounded-lg opacity-0 md:group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-slate-900 dark:text-white"
                        >
                            <Trash2 size={14} />
                        </button>
                        <div className="absolute top-2 right-2 md:hidden">
                            <button 
                                onClick={async () => {
                                    try {
                                        await onDeleteTable(t.id);
                                        setNotification({ message: "Table supprimée", type: 'success' });
                                        setTimeout(() => setNotification(null), 3000);
                                    } catch (err: any) {
                                        setNotification({ message: `Erreur: ${err.message}`, type: 'error' });
                                        setTimeout(() => setNotification(null), 5000);
                                    }
                                }}
                                className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-slate-900 dark:text-white"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="relative flex-1 w-full max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                        type="text" 
                        placeholder="Rechercher un produit..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-slate-900 dark:text-white focus:border-indigo-500 outline-none font-medium"
                    />
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={generateStockReport}
                        className="bg-white dark:bg-slate-800 border-2 border-indigo-500 text-indigo-500 px-4 md:px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 active:scale-95 transition-all text-sm md:text-base"
                    >
                        <FileText size={20} />
                        Exporter
                    </button>
                    <button 
                        onClick={() => setShowAddProduct(true)}
                        className="bg-indigo-600 text-white px-4 md:px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all text-sm md:text-base whitespace-nowrap"
                    >
                        <Plus size={20} />
                        Nouveau
                    </button>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left min-w-[600px]">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Produit</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Catégorie</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Prix (USD)</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Stock</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {filteredProducts.map(p => (
                                <tr key={p.id} className="hover:bg-white dark:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{p.nom}</span>
                                        {p.stockActuel <= p.seuilAlerte && (
                                            <span className="ml-2 px-1.5 py-0.5 bg-rose-500/20 text-rose-500 text-[8px] font-black rounded uppercase">Alerte</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-bold text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded-md">{p.categorie}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-bold text-emerald-500">${p.prixUSD.toFixed(2)}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`font-black ${p.stockActuel <= p.seuilAlerte ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>{p.stockActuel}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => setEditingProductData(p)}
                                                className="p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-400 transition-all"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button 
                                                onClick={async () => {
                                                  try {
                                                    await onDeleteProduct(p.id);
                                                    setNotification({ message: "Produit supprimé", type: 'success' });
                                                    setTimeout(() => setNotification(null), 3000);
                                                  } catch (err: any) {
                                                    setNotification({ message: `Erreur: ${err.message}`, type: 'error' });
                                                    setTimeout(() => setNotification(null), 5000);
                                                  }
                                                }}
                                                className="p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-400 transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'staff' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-slate-900 dark:text-white font-bold">Gestion du Personnel</h3>
            <button 
              onClick={() => setShowAddUser(true)}
              className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm"
            >
              <Users size={16} />
              Ajouter Staff
            </button>
          </div>

          {showAddUser && (
            <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nom Complet</label>
                <input 
                  type="text" 
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  value={newUserData.nom}
                  onChange={(e) => setNewUserData({...newUserData, nom: e.target.value})}
                  placeholder="Ex: Jean Dupont"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Identifiant (Login)</label>
                <input 
                  type="text" 
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  value={newUserData.identifiant}
                  onChange={(e) => setNewUserData({...newUserData, identifiant: e.target.value})}
                  placeholder="Ex: jean"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Rôle</label>
                <select 
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({...newUserData, role: e.target.value as UserRole})}
                >
                  <option value={UserRole.SERVEUR}>Serveur</option>
                  <option value={UserRole.CAISSIER}>Caissier</option>
                  <option value={UserRole.CUISINE}>Cuisine</option>
                  {currentUser.role === UserRole.ADMIN && <option value={UserRole.GERANT}>Gérant</option>}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Code PIN (Connexion)</label>
                <input 
                  type="password" 
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  value={newUserData.pin}
                  onChange={(e) => setNewUserData({...newUserData, pin: e.target.value})}
                  placeholder="Min. 6 chiffres"
                />
              </div>
              <div className="md:col-span-2 flex gap-3 mt-2">
                <button 
                  onClick={() => setShowAddUser(false)}
                  className="px-6 py-3 rounded-xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 dark:bg-slate-700 transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleCreateStaff}
                  className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all"
                >
                  Créer le compte
                </button>
              </div>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="p-4">Nom</th>
                  <th className="p-4">Identifiant</th>
                  <th className="p-4">Rôle</th>
                  <th className="p-4">Statut</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {users.filter(u => u.role !== UserRole.DELETED && u.restaurantId === currentUser.restaurantId).map(u => (
                  <tr key={u.id} className="text-slate-700 dark:text-slate-300 text-sm">
                    <td className="p-4 font-bold">{u.nom}</td>
                    <td className="p-4">{u.identifiant}</td>
                    <td className="p-4">
                      <span className="bg-white dark:bg-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold">{u.role}</span>
                    </td>
                    <td className="p-4">
                      {u.role === UserRole.BLOCKED ? (
                        <span className="text-rose-500 font-bold text-xs">Bloqué</span>
                      ) : (
                        <span className="text-emerald-500 font-bold text-xs">Actif</span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setPerformanceFilterUid(u.id);
                          setActiveTab('performance');
                        }}
                        className="text-indigo-400 hover:text-indigo-300 text-xs font-bold mr-4"
                      >
                        Stats
                      </button>
                      {u.id !== currentUser.id && (currentUser.role === UserRole.ADMIN || (currentUser.role === UserRole.GERANT && u.role !== UserRole.ADMIN && u.role !== UserRole.GERANT)) && (
                        <>
                          {u.role === UserRole.BLOCKED ? (
                            <button 
                              onClick={async () => {
                                try {
                                  await onUpdateUser(u.id, { role: UserRole.SERVEUR });
                                  setNotification({ message: "Utilisateur mis à jour", type: 'success' });
                                  setTimeout(() => setNotification(null), 3000);
                                } catch (err: any) {
                                  setNotification({ message: `Erreur: ${err.message}`, type: 'error' });
                                  setTimeout(() => setNotification(null), 5000);
                                }
                              }}
                              className="text-emerald-400 hover:text-emerald-300 text-xs font-bold"
                            >
                              Débloquer
                            </button>
                          ) : (
                            <button 
                              onClick={async () => {
                                try {
                                  await onUpdateUser(u.id, { role: UserRole.BLOCKED });
                                  setNotification({ message: "Utilisateur bloqué", type: 'success' });
                                  setTimeout(() => setNotification(null), 3000);
                                } catch (err: any) {
                                  setNotification({ message: `Erreur: ${err.message}`, type: 'error' });
                                  setTimeout(() => setNotification(null), 5000);
                                }
                              }}
                              className="text-orange-400 hover:text-orange-300 text-xs font-bold"
                            >
                              Bloquer
                            </button>
                          )}
                          <button 
                            onClick={async () => {
                              try {
                                await onDeleteUser(u.id);
                                setNotification({ message: "Utilisateur supprimé", type: 'success' });
                                setTimeout(() => setNotification(null), 3000);
                              } catch (err: any) {
                                setNotification({ message: `Erreur: ${err.message}`, type: 'error' });
                                setTimeout(() => setNotification(null), 5000);
                              }
                            }}
                            className="text-rose-400 hover:text-rose-300 text-xs font-bold ml-4"
                          >
                            Supprimer
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {activeTab === 'config' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-50 dark:bg-slate-900 p-8 rounded-3xl border-2 border-slate-200 dark:border-slate-800 space-y-8"
        >
          <div>
            <h3 className="text-slate-900 dark:text-white font-bold mb-6">Paramètres Généraux</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nom de l'Établissement</label>
                <input 
                  type="text" 
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-bold"
                  value={localSettings.nomEtablissement || ''}
                  onChange={(e) => setLocalSettings({...localSettings, nomEtablissement: e.target.value})}
                  placeholder="Ex: KinTerrasse"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">URL du Logo</label>
                <input 
                  type="text" 
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-bold"
                  value={localSettings.logoUrl || ''}
                  onChange={(e) => setLocalSettings({...localSettings, logoUrl: e.target.value})}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">ID National</label>
                <input 
                  type="text" 
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-bold"
                  value={localSettings.idNat || ''}
                  onChange={(e) => setLocalSettings({...localSettings, idNat: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">RCCM</label>
                <input 
                  type="text" 
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-bold"
                  value={localSettings.rccm || ''}
                  onChange={(e) => setLocalSettings({...localSettings, rccm: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">NIF</label>
                <input 
                  type="text" 
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-bold"
                  value={localSettings.nif || ''}
                  onChange={(e) => setLocalSettings({...localSettings, nif: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Téléphone</label>
                <input 
                  type="text" 
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-bold"
                  value={localSettings.telephone || ''}
                  onChange={(e) => setLocalSettings({...localSettings, telephone: e.target.value})}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Adresse</label>
                <input 
                  type="text" 
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-bold"
                  value={localSettings.adresse || ''}
                  onChange={(e) => setLocalSettings({...localSettings, adresse: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Taux de Change (1 USD en CDF)</label>
                <input 
                  type="number" 
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-bold"
                  value={localTaux}
                  onChange={(e) => setLocalTaux(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2 md:col-span-2 mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50">
                  <div className="flex items-center justify-between">
                      <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Gestion des Stocks Stricte</h4>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm">Si désactivé (Stock Infini), les ventes ne décrémenteront pas le stock. Idéal pour fonctionnement 24h axé sur le chiffre d'affaires.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                              type="checkbox" 
                              className="sr-only peer"
                              checked={localSettings.stockManagementEnabled !== false}
                              onChange={(e) => setLocalSettings({...localSettings, stockManagementEnabled: e.target.checked})}
                          />
                          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                      </label>
                  </div>
              </div>

            </div>
            <button 
              onClick={handleSaveTaux}
              className="mt-6 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
            >
              Enregistrer les Paramètres
            </button>
          </div>
        </motion.div>
      )}

      {activeTab === 'expenses' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 p-6">
            <h3 className="text-slate-900 dark:text-white font-bold mb-4">Nouvelle Dépense</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input 
                type="text" 
                placeholder="Description"
                id="exp-desc"
                className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              />
              <input 
                type="number" 
                placeholder="Montant USD"
                id="exp-amount"
                className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              />
              <select 
                id="exp-cat"
                className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              >
                <option value="Personnel">Personnel</option>
                <option value="Achat Stock">Achat Stock</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Loyer/Charges">Loyer/Charges</option>
                <option value="Autre">Autre</option>
              </select>
              <button 
                onClick={async () => {
                  const desc = (document.getElementById('exp-desc') as HTMLInputElement).value;
                  const amount = Number((document.getElementById('exp-amount') as HTMLInputElement).value);
                  const cat = (document.getElementById('exp-cat') as HTMLSelectElement).value as any;
                  if (desc && amount > 0) {
                    try {
                      await onAddExpense({ description: desc, montantUSD: amount, categorie: cat });
                      (document.getElementById('exp-desc') as HTMLInputElement).value = '';
                      (document.getElementById('exp-amount') as HTMLInputElement).value = '';
                      setNotification({ message: "Dépense ajoutée", type: 'success' });
                      setTimeout(() => setNotification(null), 3000);
                    } catch (err: any) {
                      setNotification({ message: `Erreur: ${err.message}`, type: 'error' });
                      setTimeout(() => setNotification(null), 5000);
                    }
                  }
                }}
                className="md:col-span-3 bg-indigo-600 text-white font-bold p-3 rounded-xl hover:bg-indigo-500 transition-colors"
              >
                Ajouter la dépense
              </button>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Description</th>
                  <th className="p-4">Catégorie</th>
                  <th className="p-4 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {[...expenses].sort((a, b) => b.date - a.date).map(exp => (
                  <tr key={exp.id} className="text-slate-700 dark:text-slate-300 text-sm">
                    <td className="p-4">{new Date(exp.date).toLocaleDateString()}</td>
                    <td className="p-4 font-bold">{exp.description}</td>
                    <td className="p-4">
                      <span className="bg-white dark:bg-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold">{exp.categorie}</span>
                    </td>
                    <td className="p-4 text-right font-black text-rose-400">-{exp.montantUSD.toFixed(2)}$</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {activeTab === 'performance' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Global Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-800">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Chiffre d'Affaires Total</p>
              <p className="text-3xl font-black text-emerald-500">
                {orders.filter(o => o.statut === OrderStatus.PAYE).reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + (i.quantite * i.prixUnitaireUSD), 0), 0).toFixed(2)}$
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-800">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Dépenses Totales</p>
              <p className="text-3xl font-black text-rose-500">
                {expenses.reduce((acc, e) => acc + e.montantUSD, 0).toFixed(2)}$
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-800">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Bénéfice Net (Est.)</p>
              <p className="text-3xl font-black text-indigo-400">
                {(orders.filter(o => o.statut === OrderStatus.PAYE).reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + (i.quantite * i.prixUnitaireUSD), 0), 0) - expenses.reduce((acc, e) => acc + e.montantUSD, 0)).toFixed(2)}$
              </p>
            </div>
          </div>

          {/* Performance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-800 h-[400px]">
              <h3 className="text-slate-900 dark:text-white font-bold mb-6">Ventes par Serveur</h3>
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={users.filter(u => u.role === UserRole.SERVEUR && u.restaurantId === currentUser.restaurantId).map(u => ({
                  name: u.nom,
                  ventes: orders.filter(o => o.serveurId === u.id && o.statut === OrderStatus.PAYE).reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + (i.quantite * i.prixUnitaireUSD), 0), 0)
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
                  <Bar dataKey="ventes" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </ReBarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-800 h-[400px]">
              <h3 className="text-slate-900 dark:text-white font-bold mb-6">Ventes par Catégorie</h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={['Bière', 'Sucré', 'Forte', 'Cuisine'].map(cat => ({
                      name: cat,
                      value: orders.filter(o => o.statut === OrderStatus.PAYE).reduce((acc, o) => acc + o.items.reduce((sum, i) => {
                        const prod = products.find(p => p.id === i.productId);
                        return prod?.categorie === cat ? sum + (i.quantite * i.prixUnitaireUSD) : sum;
                      }, 0), 0)
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {['#6366f1', '#10b981', '#f59e0b', '#ef4444'].map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'saas' && isSuperAdmin && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h3 className="text-slate-900 dark:text-white font-bold text-xl">Gestion des Établissements</h3>
                    <p className="text-slate-500 text-xs">Vue d'ensemble de tous les clients SaaS</p>
                </div>
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    <button 
                        onClick={() => setShowAddEstablishment(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
                    >
                        <Plus size={14} />
                        Nouvel Établissement
                    </button>
                    <button 
                        onClick={() => {
                            localStorage.removeItem('pos_restaurant_id');
                            window.location.reload();
                        }}
                        className="bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-slate-900 dark:text-white px-4 py-2 rounded-xl text-[10px] font-bold transition-all"
                    >
                        Réinitialiser vers mon compte
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allSettings.map(est => {
                const owner = users.find(u => u.email === est.ownerEmail || (u.restaurantId === est.id && u.role === UserRole.ADMIN));
                const isSubExpired = est.subscription?.endsAt ? est.subscription.endsAt < Date.now() : true;
                const subDate = est.subscription?.endsAt ? new Date(est.subscription.endsAt).toLocaleDateString() : 'Non défini';

                return (
                  <div key={est.id} className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-300 dark:border-slate-700 flex flex-col hover:border-indigo-500 transition-all group">
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isSubExpired ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        <SettingsIcon size={24} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-slate-900 dark:text-white font-bold text-base truncate">{est.nomEtablissement || 'Sans Nom'}</h4>
                        <p className="text-slate-500 text-[10px] font-mono truncate">{est.ownerEmail || 'Email non défini'}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-6 flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="w-5 h-5 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-lg text-[10px]">📍</span>
                        <span className="truncate">{est.adresse || 'Adresse non définie'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="w-5 h-5 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-lg text-[10px]">👤</span>
                        <span className="truncate">{owner ? owner.nom : 'Pas encore connecté'}</span>
                      </div>
                      <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-900/50 p-2 rounded-lg mt-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`w-2 h-2 rounded-full ${isSubExpired ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                          <span className="text-slate-700 dark:text-slate-300 font-bold">{isSubExpired ? 'Expiré' : 'Actif'}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{subDate}</span>
                      </div>
                      
                      <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-900/50 p-2 rounded-lg mt-2">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-700 dark:text-slate-300 font-bold leading-tight">Gérer Stock</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                              type="checkbox" 
                              className="sr-only peer"
                              checked={est.stockManagementEnabled !== false}
                              onChange={() => handleToggleStockMode(est.id, est.stockManagementEnabled !== false)}
                          />
                          <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-500"></div>
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleExtendSubscription(est.id, 1, est.subscription?.endsAt)}
                        className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-900 dark:text-white text-[10px] font-bold py-3 px-2 rounded-xl transition-all flex-1 text-center"
                      >
                        +1 Mois
                      </button>
                      <button 
                        onClick={() => setConfirmDeleteEstId(est.id)}
                        className="bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-slate-900 dark:text-white text-[10px] font-bold py-3 px-2 rounded-xl transition-all flex-[0.5] text-center flex justify-center items-center"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button 
                        onClick={() => {
                            localStorage.setItem('pos_restaurant_id', est.id);
                            window.location.reload();
                        }}
                        className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white text-[10px] font-bold py-3 px-2 rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-center"
                      >
                        Gérer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 p-6">
            <h3 className="text-slate-900 dark:text-white font-bold mb-6">Tous les Administrateurs</h3>
            <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                        <tr>
                            <th className="p-4">Nom</th>
                            <th className="p-4">Email / Identifiant</th>
                            <th className="p-4">Établissement</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {allSettings.map(est => {
                            const owner = users.find(u => u.email === est.ownerEmail || (u.restaurantId === est.id && u.role === UserRole.ADMIN));
                            return (
                                <tr key={est.id} className="text-slate-700 dark:text-slate-300 text-sm hover:bg-white dark:bg-slate-800/30 transition-colors">
                                    <td className="p-4 font-bold">
                                        {owner ? owner.nom : <span className="text-slate-500 italic">En attente (Non connecté)</span>}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span>{est.ownerEmail}</span>
                                            {owner && <span className="text-[10px] text-emerald-500 font-mono">Enregistré</span>}
                                            {!owner && <span className="text-[10px] text-amber-500 font-mono">Doit se connecter avec Google</span>}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-lg text-[10px] font-bold">
                                            {est.nomEtablissement || 'Inconnu'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => {
                                                localStorage.setItem('pos_restaurant_id', est.id);
                                                window.location.reload();
                                            }}
                                            className="text-indigo-400 hover:text-indigo-300 text-xs font-bold"
                                        >
                                            Gérer l'accès
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'history' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 p-6">
            <h3 className="text-slate-900 dark:text-white font-bold mb-4">Historique des Ventes</h3>
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
                  {orders
                    .filter(o => {
                        const now = new Date();
                        const today = new Date(now).setHours(0,0,0,0);
                        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).setHours(0,0,0,0);
                        const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).setHours(0,0,0,0);

                        if (currentUser.role === UserRole.SERVEUR) return o.createdAt >= today && o.serveurId === currentUser.id;
                        if (currentUser.role === UserRole.GERANT) return o.createdAt >= lastWeek;
                        return true; 
                    })
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
                {isAdminOrGerant && (
                    <button 
                        onClick={async () => {
                            const { default: jsPDF } = await import('jspdf');
                            const { default: autoTable } = await import('jspdf-autotable');
                            const doc = new jsPDF();
                            doc.text(`Facture T-${selectedOrder.tableId}`, 10, 10);
                            autoTable(doc, { 
                                head: [['Produit', 'Qté', 'Prix']],
                                body: selectedOrder.items.map(item => [products.find(p => p.id === item.productId)?.nom || '?', item.quantite, item.prixUnitaireUSD])
                            });
                            doc.save(`facture_${selectedOrder.id}.pdf`);
                        }}
                        className="mt-6 w-full p-4 rounded-xl bg-emerald-600 text-white font-bold"
                    >
                        Exporter en PDF
                    </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'logs' && (isAdminOrGerant) && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 p-6">
            <h3 className="text-slate-900 dark:text-white font-bold mb-4">Logs d'Activité</h3>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="p-4">Utilisateur</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {staffActivity.sort((a,b) => b.timestamp - a.timestamp).map(log => {
                    const user = users.find(u => u.id === log.uid);
                    return (
                      <tr key={log.id} className="text-slate-700 dark:text-slate-300 text-sm">
                        <td className="p-4">{user ? user.nom : 'Inconnu'}</td>
                        <td className="p-4 font-mono text-xs">{log.action}</td>
                        <td className="p-4">{new Date(log.timestamp).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AdminPanel;
