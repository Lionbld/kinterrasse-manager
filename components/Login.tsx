
import React, { useState, useEffect } from 'react';
import { LogIn, UserCircle, ShieldCheck, ClipboardList, KeyRound, Mail } from 'lucide-react';
import { loginWithEmailAndPin, db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [identifiant, setIdentifiant] = useState('');
  const [pin, setPin] = useState('');
  const [loginMode, setLoginMode] = useState<'pin' | 'google'>('pin');

  // Anti Brute-Force
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  useEffect(() => {
    let interval: any;
    if (lockoutUntil) {
      interval = setInterval(() => {
        if (Date.now() > lockoutUntil) {
          setLockoutUntil(null);
          setFailedAttempts(0);
          setError('');
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const attemptPinLogin = async () => {
    if (lockoutUntil && Date.now() < lockoutUntil) {
        setError(`Trop de tentatives. Réessayez dans ${Math.ceil((lockoutUntil - Date.now()) / 1000)}s`);
        return;
    }
    if (!identifiant || !pin) {
        setError('Veuillez remplir votre identifiant et votre code PIN');
        return;
    }
    setLoading(true);
    setError('');
    try {
      const identifiantNormalized = identifiant.toLowerCase().replace(/\s/g, '');
      
      // Search the users collection by identifiant to find the restaurantId
      // This eliminates the need for the agent to know/type the restaurant name
      let restaurantId = '';
      
      const usersQuery = query(
        collection(db, 'users'),
        where('identifiant', '==', identifiantNormalized)
      );
      const usersSnap = await getDocs(usersQuery);

      if (!usersSnap.empty) {
        restaurantId = usersSnap.docs[0].data().restaurantId;
      } else {
        // Try case-insensitive match across all users
        const allUsers = await getDocs(collection(db, 'users'));
        const matched = allUsers.docs.find(d => 
          d.data().identifiant?.toLowerCase().replace(/\s/g, '') === identifiantNormalized
        );
        if (matched) {
          restaurantId = matched.data().restaurantId;
        }
      }

      if (!restaurantId) {
        // Last fallback: use stored restaurantId from previous session
        const storedRestaurantId = localStorage.getItem('pos_restaurant_id');
        if (storedRestaurantId) {
          restaurantId = storedRestaurantId;
        } else {
          setError('Identifiant introuvable. Contactez votre administrateur.');
          setLoading(false);
          return;
        }
      }

      const emailToUse = `${identifiantNormalized}@${restaurantId}.pos`;
      localStorage.setItem('pos_restaurant_id', restaurantId);

      await loginWithEmailAndPin(emailToUse, pin);
      setFailedAttempts(0);
      onLogin();
    } catch (err: any) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 3) {
          setLockoutUntil(Date.now() + 30000); // 30 seconds lockout
          setError('Trop de tentatives. Veuillez patienter 30 secondes.');
      } else {
          setError(`Identifiant ou code PIN incorrect (${3 - newAttempts} essais restants)`);
      }
      setPin(''); // Reset PIN for security
      setLoading(false);
    }
  };

  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const handleAdminEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutUntil && Date.now() < lockoutUntil) {
        setError(`Trop de tentatives. Réessayez dans ${Math.ceil((lockoutUntil - Date.now()) / 1000)}s`);
        return;
    }
    if (!adminEmail || !adminPassword) {
        setError('Veuillez remplir tous les champs');
        return;
    }
    setLoading(true);
    setError('');
    try {
        await loginWithEmailAndPin(adminEmail, adminPassword);
        setFailedAttempts(0);
        onLogin();
    } catch (err: any) {
        let errorMessage = 'Email ou mot de passe incorrect.';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
            errorMessage = 'Email ou mot de passe incorrect.';
        } else if (err.code === 'auth/too-many-requests') {
            errorMessage = 'Trop de tentatives échouées. Veuillez réessayer plus tard.';
        }
        
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        if (newAttempts >= 5) {
            setLockoutUntil(Date.now() + 30000);
            setError('Trop de tentatives. Veuillez patienter 30 secondes.');
        } else {
            setError(`${errorMessage} (${5 - newAttempts} essais restants)`);
        }
        setAdminPassword('');
        setLoading(false);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    attemptPinLogin();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-slate-950 p-6 text-slate-900 dark:text-slate-100">
      <div className="mb-8 text-center">
        <div className="inline-flex p-2 rounded-3xl bg-white mb-4 shadow-xl shadow-indigo-500/20">
            <img src="/logo.png" alt="KinTerrasse Manager Logo" className="w-24 h-24 object-contain" referrerPolicy="no-referrer" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-2">KinTerrasse</h1>
        <p className="text-slate-500 dark:text-slate-400">Système de Gestion Commerciale</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {/* Tabs */}
        <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-2xl mb-6">
            <button 
                onClick={() => setLoginMode('pin')}
                className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all ${loginMode === 'pin' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'}`}
            >
                Staff (Code PIN)
            </button>
            <button 
                onClick={() => setLoginMode('google')}
                className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all ${loginMode === 'google' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'}`}
            >
                Admin (Email)
            </button>
        </div>

        {error && <div className="p-3 bg-red-500/20 text-red-500 rounded-xl text-center text-sm">{error}</div>}
        
        {loginMode === 'pin' ? (
            <form onSubmit={handlePinLogin} className="space-y-4 bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800">
                <div className="text-center mb-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Entrez votre identifiant et code PIN</p>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Identifiant</label>
                    <div className="relative">
                        <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input 
                            type="text" 
                            value={identifiant}
                            onChange={(e) => setIdentifiant(e.target.value)}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            placeholder="ex: serveur1"
                            autoComplete="username"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Code PIN</label>
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input 
                            type="password" 
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors tracking-[0.5em] font-mono text-lg"
                            placeholder="••••"
                            autoComplete="current-password"
                        />
                    </div>
                </div>
                <button 
                    type="submit"
                    disabled={loading || !!lockoutUntil}
                    className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all disabled:opacity-50 mt-4 text-lg shadow-lg shadow-indigo-600/20"
                >
                    {loading ? 'Connexion en cours...' : 'Se Connecter'}
                </button>
            </form>
        ) : (
            <div className="space-y-6">
                <form onSubmit={handleAdminEmailLogin} className="space-y-4 bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Email Admin</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input 
                                type="email" 
                                value={adminEmail}
                                onChange={(e) => setAdminEmail(e.target.value)}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                placeholder="admin@exemple.com"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Mot de Passe</label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input 
                                type="password" 
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>
                    <button 
                        type="submit"
                        disabled={loading || !!lockoutUntil}
                        className="w-full py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all disabled:opacity-50 mt-4 text-sm shadow-lg"
                    >
                        {loading ? 'Connexion...' : 'Connexion par Email'}
                    </button>
                </form>
            </div>
        )}
      </div>

      <footer className="mt-12 text-slate-500 text-xs text-center leading-relaxed">
        Optimisé pour Kinshasa, RDC<br/>
        Gère USD / CDF / Mobile Money
      </footer>
    </div>
  );
};

export default Login;
