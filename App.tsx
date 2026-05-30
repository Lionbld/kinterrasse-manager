
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, logout, handleFirestoreError, OperationType, logStaffActivity } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, updateDoc, getDoc, getDocs, getDocFromServer, deleteDoc, query, where, addDoc } from 'firebase/firestore';
import { 
  User, UserRole, Table, TableStatus, Product, Order, Settings, 
  OrderStatus, PaymentMode, Expense, StaffActivity 
} from './types';
import { INITIAL_TABLES, INITIAL_PRODUCTS } from './constants';
import Dashboard from './components/Dashboard';
import OrderModal from './components/OrderModal';
import AdminPanel from './components/AdminPanel';
import KitchenView from './components/KitchenView';
import Login from './components/Login';
import { HistoryView } from './components/HistoryView';
import { 
  LayoutDashboard, 
  Settings as SettingsIcon, 
  LogOut, 
  PackageCheck,
  Moon,
  Sun,
  FileText
} from 'lucide-react';

const App: React.FC = () => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'admin' | 'stock' | 'kitchen' | 'history'>('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>((localStorage.getItem('theme') as 'dark' | 'light') || 'dark');

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Business State
  const [tables, setTables] = useState<Table[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [staffActivities, setStaffActivities] = useState<StaffActivity[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allSettings, setAllSettings] = useState<(Settings & { id: string })[]>([]);
  const [settings, setSettings] = useState<Settings>({ 
    tauxUSD_CDF: 2850, 
    taxeDGRK: 16,
    nomEtablissement: 'KinTerrasse',
    logoUrl: '/logo.png',
    idNat: '',
    rccm: '',
    nif: '',
    adresse: '',
    telephone: '',
    stockManagementEnabled: true
  });

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // Connection Test
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    async function testConnection() {
      try {
        // Try to get a document from the server to verify configuration
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firestore connection verified.");
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Connection test failed (offline), retrying in 2s... (${retryCount}/${maxRetries})`);
            setTimeout(testConnection, 2000);
          } else {
            console.error("Please check your Firebase configuration. The client is offline after multiple attempts.");
          }
        }
      }
    }
    
    // Wait a bit before testing to allow SDK to initialize
    const timer = setTimeout(testConnection, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Auth Listener
  useEffect(() => {
    let unsubUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Cleanup previous user listener if it exists
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }

      if (user) {
        // Check if we have a stored restaurant ID for staff login
        const storedRestaurantId = localStorage.getItem('pos_restaurant_id');

        const userDocRef = doc(db, 'users', user.uid);
        unsubUser = onSnapshot(userDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as User;
            const superAdmins = ['lionlnl21@gmail.com'];
            const isSuperAdmin = superAdmins.includes(user.email || '');
            
            let restaurantId = userData.restaurantId || user.uid;
            
            if (isSuperAdmin && storedRestaurantId) {
                restaurantId = storedRestaurantId;
            }

            const identifiant = userData.identifiant || user.email?.split('@')[0] || 'admin';
            
            if (!userData.restaurantId || !userData.identifiant) {
                // Update legacy user document
                updateDoc(userDocRef, { restaurantId: userData.restaurantId || user.uid, identifiant }).catch(e => console.error("Failed to update legacy user:", e));
            }

            setCurrentUser(prev => {
                if (!prev) {
                    logStaffActivity(user.uid, restaurantId, 'LOGIN');
                }
                return { id: user.uid, ...userData, restaurantId, identifiant, email: userData.email || user.email || '' };
            });
            // Save restaurantId to local storage for POS mode
            localStorage.setItem('pos_restaurant_id', restaurantId);
          } else {
            const superAdmins = ['lionlnl21@gmail.com'];
            const isSuperAdmin = superAdmins.includes(user.email || '');

            let assignedRestaurantId = storedRestaurantId || user.uid;
            let assignedRole = isSuperAdmin ? UserRole.ADMIN : UserRole.SERVEUR;
            
            if (!isSuperAdmin && user.email) {
                try {
                    const settingsQuery = query(collection(db, 'settings'), where('ownerEmail', '==', user.email));
                    const settingsSnap = await getDocs(settingsQuery);
                    if (!settingsSnap.empty) {
                        assignedRestaurantId = settingsSnap.docs[0].id;
                        assignedRole = UserRole.ADMIN;
                    }
                } catch (e) {
                    console.error("Error fetching matching settings for invitation", e);
                }
            }

            // Create default user profile if it doesn't exist
            const newUser: User = {
              id: user.uid,
              nom: user.displayName || 'Utilisateur',
              identifiant: user.email?.split('@')[0] || 'admin',
              telephone: '',
              role: assignedRole,
              email: user.email || '',
              restaurantId: assignedRestaurantId
            };
            try {
              await setDoc(userDocRef, { 
                nom: newUser.nom, 
                identifiant: newUser.identifiant,
                telephone: newUser.telephone, 
                role: newUser.role, 
                email: newUser.email,
                restaurantId: newUser.restaurantId
              });
              logStaffActivity(newUser.id, newUser.restaurantId, 'LOGIN');
              setCurrentUser(newUser);
              localStorage.setItem('pos_restaurant_id', newUser.restaurantId);
            } catch (e) {
              handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
            }
          }
          setIsAuthReady(true);
        }, (error) => {
          console.error("Auth status listener failed:", error);
          setAuthError(error instanceof Error ? error.message : String(error));
          setIsAuthReady(true);
        });
      } else {
        setCurrentUser(null);
        setIsAuthReady(true);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUser) unsubUser();
    };
  }, []);

  // Auto-Logout due to Inactivity (Security)
  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      // Auto-logout after 15 minutes of inactivity (900,000 ms)
      inactivityTimer = setTimeout(() => {
        if (currentUser && currentUser.restaurantId !== 'NOUVEAU') {
            logout(currentUser.id, currentUser.restaurantId).catch(console.error);
        }
      }, 15 * 60 * 1000); 
    };

    if (currentUser) {
        resetTimer();
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        activityEvents.forEach(evt => window.addEventListener(evt, resetTimer));

        return () => {
            clearTimeout(inactivityTimer);
            activityEvents.forEach(evt => window.removeEventListener(evt, resetTimer));
        };
    }
  }, [currentUser]);

  // Data Listeners
  useEffect(() => {
    if (!currentUser || !currentUser.restaurantId) return;

    const isSuperAdmin = currentUser.email?.toLowerCase() === 'lionlnl21@gmail.com';

    const unsubTables = onSnapshot(query(collection(db, 'tables'), where('restaurantId', '==', currentUser.restaurantId)), (snapshot) => {
      setTables(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'tables');
    });

    const unsubProducts = onSnapshot(query(collection(db, 'products'), where('restaurantId', '==', currentUser.restaurantId)), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    const unsubOrders = onSnapshot(query(collection(db, 'orders'), where('restaurantId', '==', currentUser.restaurantId)), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orders');
    });

    let unsubExpenses: () => void = () => {};
    if (isSuperAdmin || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.GERANT) {
        unsubExpenses = onSnapshot(query(collection(db, 'expenses'), where('restaurantId', '==', currentUser.restaurantId)), (snapshot) => {
          setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'expenses');
        });
    }

    let unsubStaffActivity: () => void = () => {};
    if (isSuperAdmin || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.GERANT) {
        unsubStaffActivity = onSnapshot(query(collection(db, 'staff_activity'), where('restaurantId', '==', currentUser.restaurantId)), (snapshot) => {
          setStaffActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffActivity)));
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'staff_activity');
        });
    }

    const unsubSettings = onSnapshot(doc(db, 'settings', currentUser.restaurantId), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as Settings);
      } else {
        // Initialize settings if missing
        const defaultSettings: Settings = { 
          tauxUSD_CDF: 2850, 
          taxeDGRK: 16,
          nomEtablissement: 'KinTerrasse',
          logoUrl: '/logo.png',
          idNat: '',
          rccm: '',
          nif: '',
          adresse: '',
          telephone: '',
          stockManagementEnabled: true
        };
        setDoc(doc(db, 'settings', currentUser.restaurantId), defaultSettings).catch(e => handleFirestoreError(e, OperationType.WRITE, `settings/${currentUser.restaurantId}`));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `settings/${currentUser.restaurantId}`);
    });

    let unsubUsers: (() => void) | null = null;

    if (isSuperAdmin) {
      unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'users_all');
      });
    } else if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.GERANT) {
      unsubUsers = onSnapshot(query(collection(db, 'users'), where('restaurantId', '==', currentUser.restaurantId)), (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'users');
      });
    }

    let unsubAllSettings: (() => void) | null = null;
    if (isSuperAdmin) {
      unsubAllSettings = onSnapshot(collection(db, 'settings'), (snapshot) => {
        setAllSettings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Settings & { id: string })));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings_all');
      });
    }

    // Initialize default tables and products if empty (for demo purposes)
    const initData = async () => {
      if (!isSuperAdmin && currentUser?.role !== UserRole.ADMIN) return;
      
      try {
        // Use getDoc but handle the case where it might be offline
        const tablesSnap = await getDoc(doc(db, 'tables', `${currentUser.restaurantId}_table-1`));
        if (!tablesSnap.exists()) {
          console.log("Initializing default data...");
          INITIAL_TABLES.forEach(t => setDoc(doc(db, 'tables', `${currentUser.restaurantId}_${t.id}`), { numero: t.numero, statut: t.statut, restaurantId: currentUser.restaurantId }).catch(e => console.warn(`Failed to init table ${t.id}:`, e.message)));
          INITIAL_PRODUCTS.forEach(p => setDoc(doc(db, 'products', `${currentUser.restaurantId}_${p.id}`), { nom: p.nom, categorie: p.categorie, prixUSD: p.prixUSD, stockActuel: p.stockActuel, seuilAlerte: p.seuilAlerte, besoinVidange: p.besoinVidange, restaurantId: currentUser.restaurantId }).catch(e => console.warn(`Failed to init product ${p.id}:`, e.message)));
        }
      } catch (e) {
        // If offline, we just skip initialization for now, it will happen when online
        console.warn("Could not check for data initialization (offline).");
      }
    };
    initData();

    return () => {
      unsubTables();
      unsubProducts();
      unsubOrders();
      unsubExpenses();
      unsubStaffActivity();
      unsubSettings();
      if (unsubUsers) unsubUsers();
      if (unsubAllSettings) unsubAllSettings();
    };
  }, [currentUser]);

  const handleUpdateTableStatus = async (tableId: string, status: TableStatus) => {
    try {
      await updateDoc(doc(db, 'tables', tableId), { statut: status });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `tables/${tableId}`);
    }
  };

  const handlePlaceOrder = async (tableId: string, items: { productId: string, quantite: number }[]) => {
    const table = tables.find(t => t.id === tableId);
    if (!table || !currentUser) return;

    const orderItems = items.map(item => {
      const p = products.find(prod => prod.id === item.productId);
      return {
        productId: item.productId,
        quantite: item.quantite,
        prixUnitaireUSD: p?.prixUSD || 0
      };
    });

    const vidanges = items.reduce((acc, item) => {
      const p = products.find(prod => prod.id === item.productId);
      return acc + (p?.besoinVidange ? item.quantite : 0);
    }, 0);

    const newOrder = {
      tableId,
      serveurId: currentUser.id,
      items: orderItems,
      statut: OrderStatus.EN_COURS,
      createdAt: Date.now(),
      vidangesDues: vidanges,
      restaurantId: currentUser.restaurantId
    };

    try {
      const orderRef = doc(collection(db, 'orders'));
      await setDoc(orderRef, newOrder);
      await handleUpdateTableStatus(tableId, TableStatus.OCCUPEE);
      
      // Decrease stock
      if (settings.stockManagementEnabled !== false) {
        for (const item of items) {
          const p = products.find(prod => prod.id === item.productId);
          if (p) {
            await updateDoc(doc(db, 'products', p.id), { 
              stockActuel: Math.max(0, p.stockActuel - item.quantite) 
            });
          }
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'orders');
    }
  };

  const handlePayment = async (orderId: string, mode: PaymentMode, txId?: string, clearTable: boolean = true) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      await updateDoc(doc(db, 'orders', orderId), { 
        statut: OrderStatus.PAYE, 
        modePaiement: mode, 
        transactionId: txId || null,
        paidAt: Date.now(),
        cashierId: currentUser.id
      });
      if (clearTable) {
        await handleUpdateTableStatus(order.tableId, TableStatus.LIBRE);
      } else {
        await handleUpdateTableStatus(order.tableId, TableStatus.OCCUPEE);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `orders/${orderId}`);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      // Revert stock
      if (settings.stockManagementEnabled !== false) {
        for (const item of order.items) {
          const p = products.find(prod => prod.id === item.productId);
          if (p) {
            await updateDoc(doc(db, 'products', p.id), { 
              stockActuel: p.stockActuel + item.quantite 
            });
          }
        }
      }
      // Delete order
      await deleteDoc(doc(db, 'orders', orderId));
      
      // Free table if no other active orders exist (handleUpdateTableStatus is simple)
      const otherOrders = orders.filter(o => o.tableId === order.tableId && o.id !== orderId && o.statut !== OrderStatus.PAYE);
      if (otherOrders.length === 0) {
          await handleUpdateTableStatus(order.tableId, TableStatus.LIBRE);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `orders/${orderId}`);
    }
  };

  const handleUpdateSettings = async (s: Settings) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'settings', currentUser.restaurantId), { ...s });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `settings/${currentUser.restaurantId}`);
    }
  };

  const handleUpdateProducts = async (pList: Product[]) => {
    try {
      for (const p of pList) {
        await updateDoc(doc(db, 'products', p.id), { ...p });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'products');
    }
  };

  const handleCreateUser = async (userData: Omit<User, 'id'>, uid: string) => {
    try {
      await setDoc(doc(db, 'users', uid), userData);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${uid}`);
    }
  };

  const handleUpdateUser = async (userId: string, data: Partial<User>) => {
    try {
      await updateDoc(doc(db, 'users', userId), data);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${userId}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // Note: This only deletes the Firestore document, not the Auth account
    // In a real app, you'd use a Cloud Function to delete the Auth account
    try {
      await setDoc(doc(db, 'users', userId), { ...allUsers.find(u => u.id === userId), role: 'DELETED' });
      // Or actually delete the doc
      // await deleteDoc(doc(db, 'users', userId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${userId}`);
    }
  };

  const handleAddProduct = async (p: Omit<Product, 'id' | 'restaurantId'>) => {
    if (!currentUser) return;
    try {
      const newRef = doc(collection(db, 'products'));
      await setDoc(newRef, { ...p, restaurantId: currentUser.restaurantId });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'products');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `products/${productId}`);
    }
  };

  const handleMarkReady = async (orderId: string) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        statut: OrderStatus.PRET,
        readyAt: Date.now(),
        kitchenId: currentUser.id
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const handleAddTable = async (numero: number) => {
    if (!currentUser) return;
    try {
      const newTableRef = doc(collection(db, 'tables'));
      await setDoc(newTableRef, { numero, statut: TableStatus.LIBRE, restaurantId: currentUser.restaurantId });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'tables');
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    try {
      await deleteDoc(doc(db, 'tables', tableId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `tables/${tableId}`);
    }
  };

  const handleDeleteEstablishment = async (estId: string) => {
    try {
      await deleteDoc(doc(db, 'settings', estId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `settings/${estId}`);
    }
  };

  const handleAddExpense = async (expenseData: Omit<Expense, 'id' | 'date' | 'createdBy' | 'restaurantId'>) => {
    if (!currentUser) return;
    try {
      const newExpenseRef = doc(collection(db, 'expenses'));
      await setDoc(newExpenseRef, {
        ...expenseData,
        date: Date.now(),
        createdBy: currentUser.id,
        restaurantId: currentUser.restaurantId
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'expenses');
    }
  };

  if (authError) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] bg-white dark:bg-slate-950 text-center p-6">
        <div className="bg-rose-500/10 border border-rose-500/20 p-8 rounded-3xl max-w-lg">
          <h2 className="text-2xl font-black text-rose-500 mb-4">Erreur d'accès à la base de données</h2>
          <p className="text-slate-700 dark:text-slate-300 mb-8 leading-relaxed">
            Une erreur est survenue lors de la récupération de votre profil utilisateur. <br/><br/>
            <strong>Détails :</strong> <code className="text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded block mt-2 text-left overflow-x-auto whitespace-pre-wrap">{authError}</code>
            <br/>
            Cela est généralement dû à des règles de sécurité Firestore incorrectes ou non configurées sur votre projet Firebase.
          </p>
          <div className="flex gap-4 justify-center">
            <button 
                onClick={() => { setAuthError(null); setIsAuthReady(false); window.location.reload(); }}
                className="bg-indigo-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors"
            >
                Réessayer
            </button>
            <button 
                onClick={async () => {
                  try {
                    await logout(auth.currentUser?.uid || '', localStorage.getItem('pos_restaurant_id') || '');
                  } catch (e) {
                    console.error("Logout failed:", e);
                  }
                  setAuthError(null);
                }}
                className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-6 py-3 rounded-xl hover:bg-slate-200 dark:bg-slate-700 transition-colors"
            >
                Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthReady) {
    return <div className="flex h-screen items-center justify-center bg-white dark:bg-slate-950 text-slate-900 dark:text-white">Chargement...</div>;
  }

  if (!currentUser) {
    return <Login onLogin={() => {}} />;
  }

  const isSuperAdmin = currentUser?.email?.toLowerCase() === 'lionlnl21@gmail.com';
  const sub = settings?.subscription;
  const isExpired = sub?.endsAt ? sub.endsAt < Date.now() : false;

  if (!isSuperAdmin && isExpired) {
    return (
        <div className="flex flex-col items-center justify-center h-[100dvh] bg-white dark:bg-slate-950 text-center p-6">
            <div className="bg-rose-500/10 border border-rose-500/20 p-8 rounded-3xl max-w-lg">
                <LogOut size={48} className="text-rose-500 mx-auto mb-6" />
                <h2 className="text-2xl font-black text-rose-500 mb-4">Abonnement Expiré</h2>
                <p className="text-slate-700 dark:text-slate-300 mb-8 leading-relaxed">
                    L'abonnement de votre établissement <strong>{settings?.nomEtablissement}</strong> est arrivé à échéance le {new Date(sub!.endsAt).toLocaleDateString()}. <br/><br/>
                    Veuillez contacter la direction pour renouveler votre accès au logiciel.
                </p>
                <button 
                    onClick={() => logout(currentUser.id, currentUser.restaurantId)}
                    className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-6 py-3 rounded-xl hover:bg-slate-200 dark:bg-slate-700 transition-colors"
                >
                    Se déconnecter
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      
      {/* Navigation (Sidebar on Desktop, Bottom bar on Mobile) */}
      <nav 
        className="order-last md:order-first md:w-24 lg:w-64 shrink-0 bg-slate-50 dark:bg-slate-900 border-t md:border-t-0 md:border-r border-slate-800 flex md:flex-col justify-around md:justify-between p-1 md:p-4 z-20 overflow-x-auto"
        style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="hidden md:block mb-8 text-center lg:text-left px-2">
            <img src={settings.logoUrl || "/logo.png"} alt="Logo" className="w-12 h-12 mx-auto lg:mx-0 mb-2 rounded-xl object-contain bg-white p-1" referrerPolicy="no-referrer" />
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white hidden lg:block">{settings.nomEtablissement || 'KinTerrasse'}</h1>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white lg:hidden">{settings.nomEtablissement ? settings.nomEtablissement.substring(0, 2).toUpperCase() : 'KT'}</h1>
        </div>
        
        <div className="flex md:flex-col gap-1 md:gap-2 w-full justify-start md:justify-start overflow-x-auto no-scrollbar md:overflow-visible">
            <button 
            onClick={() => setCurrentView('dashboard')}
            className={`shrink-0 flex flex-col lg:flex-row items-center lg:justify-start justify-center p-2 px-4 md:p-3 rounded-xl transition-all ${currentView === 'dashboard' ? 'bg-indigo-600 text-slate-900 dark:text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:bg-slate-800 hover:text-slate-900 dark:text-white'}`}
            >
            <LayoutDashboard size={20} className="md:size-6 lg:mr-3" />
            <span className="text-[9px] md:text-[10px] lg:text-sm font-bold mt-1 lg:mt-0">Salles</span>
            </button>

            {(isSuperAdmin || currentUser.role === UserRole.CUISINE || currentUser.role === UserRole.ADMIN) && (
              <button 
              onClick={() => setCurrentView('kitchen')}
              className={`shrink-0 flex flex-col lg:flex-row items-center lg:justify-start justify-center p-2 px-4 md:p-3 rounded-xl transition-all ${currentView === 'kitchen' ? 'bg-indigo-600 text-slate-900 dark:text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:bg-slate-800 hover:text-slate-900 dark:text-white'}`}
              >
              <PackageCheck size={20} className="md:size-6 lg:mr-3" />
              <span className="text-[9px] md:text-[10px] lg:text-sm font-bold mt-1 lg:mt-0">Cuisine</span>
              </button>
            )}

            <button 
              onClick={() => setCurrentView('stock')}
              className={`shrink-0 flex flex-col lg:flex-row items-center lg:justify-start justify-center p-2 px-4 md:p-3 rounded-xl transition-all ${currentView === 'stock' ? 'bg-indigo-600 text-slate-900 dark:text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:bg-slate-800 hover:text-slate-900 dark:text-white'}`}
              >
              <div className="relative">
                <PackageCheck size={20} className="md:size-6 lg:mr-3" />
                {settings.stockManagementEnabled !== false && products.filter(p => p.stockActuel <= p.seuilAlerte).length > 0 && (
                  <span className="absolute -top-1 -right-1 md:right-2 bg-red-500 text-white text-[8px] rounded-full w-3 h-3 flex items-center justify-center">
                    !
                  </span>
                )}
              </div>
              <span className="text-[9px] md:text-[10px] lg:text-sm font-bold mt-1 lg:mt-0">Stock</span>
              </button>

            <button 
            onClick={() => setCurrentView('history')}
            className={`shrink-0 flex flex-col lg:flex-row items-center lg:justify-start justify-center p-2 px-4 md:p-3 rounded-xl transition-all ${currentView === 'history' ? 'bg-indigo-600 text-slate-900 dark:text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:bg-slate-800 hover:text-slate-900 dark:text-white'}`}
            >
            <FileText size={20} className="md:size-6 lg:mr-3" />
            <span className="text-[9px] md:text-[10px] lg:text-sm font-bold mt-1 lg:mt-0">Historique</span>
            </button>

            {(currentUser.role === UserRole.SERVEUR) && (
              <button 
              onClick={() => logout(currentUser.id, currentUser.restaurantId)}
              className="shrink-0 flex flex-col lg:flex-row items-center lg:justify-start justify-center p-2 px-4 md:p-3 rounded-xl transition-all text-red-500 hover:bg-red-500/10"
              >
              <LogOut size={20} className="md:size-6 lg:mr-3" />
              <span className="text-[9px] md:text-[10px] lg:text-sm font-bold mt-1 lg:mt-0">Clôture</span>
              </button>
            )}

            {(isSuperAdmin || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CAISSIER || currentUser.role === UserRole.GERANT) && (
              <button 
              onClick={() => setCurrentView('admin')}
              className={`shrink-0 flex flex-col lg:flex-row items-center lg:justify-start justify-center p-2 px-4 md:p-3 rounded-xl transition-all ${currentView === 'admin' ? 'bg-indigo-600 text-slate-900 dark:text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:bg-slate-800 hover:text-slate-900 dark:text-white'}`}
              >
              <SettingsIcon size={20} className="md:size-6 lg:mr-3" />
              <span className="text-[9px] md:text-[10px] lg:text-sm font-bold mt-1 lg:mt-0">Admin</span>
              </button>
            )}
        </div>

        <div className="hidden md:flex flex-col items-center lg:items-start mt-auto pt-4 border-t border-slate-800">
            <div className="mb-4 text-center lg:text-left w-full px-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Taux du Jour</span>
                <span className="text-sm font-bold text-emerald-400">1$ = {settings.tauxUSD_CDF.toLocaleString()} FC</span>
            </div>
            
            <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                className="w-full flex items-center justify-center lg:justify-start p-3 rounded-xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-500 mb-2 transition-all"
            >
                {theme === 'dark' ? <Moon size={20} className="lg:mr-3" /> : <Sun size={20} className="lg:mr-3" />}
                <span className="hidden lg:block text-sm font-bold">{theme === 'dark' ? 'Mode Sombre' : 'Mode Clair'}</span>
            </button>

            <button 
                onClick={() => logout(currentUser.id, currentUser.restaurantId)} 
                className="w-full flex items-center justify-center lg:justify-start p-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-red-500/20 text-slate-500 dark:text-slate-400 hover:text-red-400 transition-all"
            >
                <LogOut size={20} className="lg:mr-3" />
                <span className="hidden lg:block text-sm font-bold">Déconnexion</span>
            </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header (Mobile only, or simplified on desktop) */}
        <header 
          className="md:hidden flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-800 shrink-0"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
            <div className="flex items-center gap-2">
                <img src={settings.logoUrl || "/logo.png"} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-white p-1" referrerPolicy="no-referrer" />
                <div className="flex flex-col">
                    <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate max-w-[120px]">{settings.nomEtablissement || 'KinTerrasse'}</h1>
                    <span className="text-[9px] text-slate-500 font-medium">{currentUser.role} : {currentUser.nom}</span>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="p-2 text-slate-500 dark:text-slate-400"
                >
                    {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                </button>
                <div className="text-right flex flex-col items-end">
                    <span className="text-[8px] text-slate-500 uppercase font-bold leading-none">Taux</span>
                    <span className="text-[10px] font-bold text-emerald-400 leading-none">{settings.tauxUSD_CDF} FC</span>
                </div>
                <button 
                    onClick={() => logout(currentUser.id, currentUser.restaurantId)} 
                    className="p-2 rounded-full bg-white dark:bg-slate-800 hover:bg-red-500/20 text-slate-500 dark:text-slate-400 hover:text-red-400 transition-all"
                >
                    <LogOut size={16} />
                </button>
            </div>
        </header>

        {/* Desktop Header Info */}
        <header className="hidden md:flex items-center justify-end p-4 bg-white dark:bg-slate-950 shrink-0">
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-full border border-slate-800">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-slate-900 dark:text-white font-bold">
                    {currentUser.nom.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-900 dark:text-white leading-none">{currentUser.nom}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase">{currentUser.role}</span>
                </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            {currentView === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <Dashboard 
                  tables={tables} 
                  orders={orders}
                  onTableClick={(t) => setSelectedTable(t)} 
                  currentUser={currentUser}
                  users={allUsers}
                />
              </motion.div>
            )}
            {currentView === 'kitchen' && (
              <motion.div
                key="kitchen"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <KitchenView 
                  orders={orders}
                  products={products}
                  currentUser={currentUser}
                  onMarkReady={handleMarkReady}
                />
              </motion.div>
            )}
            {currentView === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <HistoryView 
                  orders={orders}
                  users={allUsers}
                  products={products}
                  currentUser={currentUser}
                  isAdminOrGerant={isSuperAdmin || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.GERANT}
                />
              </motion.div>
            )}
            {currentView === 'admin' && (
              <motion.div
                key="admin"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full max-w-5xl mx-auto"
              >
                <AdminPanel 
                  settings={settings} 
                  allSettings={allSettings}
                  orders={orders}
                  products={products}
                  users={allUsers}
                  expenses={expenses}
                  tables={tables}
                  onUpdateSettings={handleUpdateSettings}
                  onUpdateProducts={handleUpdateProducts}
                  onAddProduct={handleAddProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onAddTable={handleAddTable}
                  onDeleteTable={handleDeleteTable}
                  onCreateUser={handleCreateUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                  onDeleteEstablishment={handleDeleteEstablishment}
                  onAddExpense={handleAddExpense}
                  staffActivity={staffActivities}
                  currentUser={currentUser}
                />
              </motion.div>
            )}
            {currentView === 'stock' && (
              <motion.div
                key="stock"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 max-w-5xl mx-auto"
              >
                  <h2 className="text-2xl font-bold mb-6">État du Stock</h2>
                  {settings.stockManagementEnabled === false && (
                      <div className="p-4 mb-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 text-xs font-bold text-center">
                          Mode Stock Infini activé.
                      </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {products.map(p => (
                          <div key={p.id} className={`p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border ${p.stockActuel <= p.seuilAlerte ? 'border-amber-500/50' : 'border-slate-800'}`}>
                              <div className="flex justify-between items-start mb-4">
                                  <div>
                                      <h3 className="font-bold text-lg">{p.nom}</h3>
                                      <span className="text-xs text-slate-500 px-2 py-1 bg-white dark:bg-slate-800 rounded-md mt-1 inline-block">{p.categorie}</span>
                                  </div>
                                  <div className="text-right">
                                      <span className={`text-2xl font-black ${p.stockActuel <= p.seuilAlerte ? 'text-amber-500' : 'text-emerald-500'}`}>
                                          {p.stockActuel}
                                      </span>
                                      <span className="text-[10px] block text-slate-500 uppercase font-bold">Unités</span>
                                  </div>
                              </div>
                              <div className="w-full bg-white dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                  <div 
                                      className={`h-full transition-all duration-500 ${p.stockActuel <= p.seuilAlerte ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                      style={{ width: `${Math.min(100, (p.stockActuel / 50) * 100)}%` }}
                                  />
                              </div>
                          </div>
                      ))}
                  </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selectedTable && (
          <OrderModal 
            table={selectedTable}
            orders={orders.filter(o => o.tableId === selectedTable.id)}
            products={products}
            settings={settings}
            onClose={() => setSelectedTable(null)}
            onPlaceOrder={(items) => handlePlaceOrder(selectedTable.id, items)}
            onPayment={handlePayment}
            onUpdateTableStatus={handleUpdateTableStatus}
            onCancelOrder={handleCancelOrder}
            currentUser={currentUser}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
