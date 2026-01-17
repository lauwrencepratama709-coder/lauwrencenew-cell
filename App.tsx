
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Role, User, SembakoProduct, WasteTransaction, RedemptionTransaction, Promotion, AppSettings, OperatorStatus } from './types';
import { INITIAL_PRODUCTS, INITIAL_ADS, COLORS } from './constants';
import { verifyTransactionPhotos, verifyOperatorIdentity } from './services/geminiService';
import { 
  Home, 
  Trash2, 
  ShoppingBag, 
  User as UserIcon, 
  Settings, 
  LayoutDashboard, 
  CheckCircle, 
  XCircle, 
  LogOut, 
  Plus, 
  Camera, 
  QrCode,
  ArrowRight,
  TrendingUp,
  Package,
  ShieldCheck,
  AlertCircle,
  Menu,
  ChevronRight,
  Loader2,
  Trash,
  FileText,
  Clock,
  MapPin,
  RefreshCw,
  Image as ImageIcon,
  ExternalLink,
  Search,
  Maximize,
  PartyPopper,
  Sparkles,
  Zap
} from 'lucide-react';

// --- MOCK DATABASE HELPER ---
const useStorage = <T,>(key: string, initialValue: T) => {
  const [value, setValue] = useState<T>(() => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
};

export default function App() {
  // Global State
  const [currentUser, setCurrentUser] = useStorage<User | null>('currentUser', null);
  const [users, setUsers] = useStorage<User[]>('users', [
    { id: 'admin-1', username: 'POLTEKKES', fullName: 'Administrator Poltekkes', email: 'admin@poltekkes.ac.id', phone: '08123456789', address: 'Kampus Poltekkes', password: '#POLTEKKES7', role: Role.ADMIN, coins: 0 },
    { id: 'op-1', username: 'OPPOLTEKKES', fullName: 'Operator Poltekkes', email: 'operator@poltekkes.ac.id', phone: '08123456780', address: 'TPST Poltekkes', password: '#POLTEKKES7', role: Role.OPERATOR, coins: 0, operatorDetails: { status: OperatorStatus.ACTIVE, tpstLocation: 'TPST Pusat Poltekkes' } },
    { id: 'user-lauwrence', username: 'LAUWRENCE', fullName: 'Lauwrence', email: 'lauwrence@example.com', phone: '081299887766', address: 'Jl. EcoKoin No. 7', password: 'LAUWRENCE', role: Role.USER, coins: 0 }
  ]);
  const [products, setProducts] = useStorage<SembakoProduct[]>('products', INITIAL_PRODUCTS);
  const [transactions, setTransactions] = useStorage<WasteTransaction[]>('transactions', []);
  const [redemptions, setRedemptions] = useStorage<RedemptionTransaction[]>('redemptions', []);
  const [promotions, setPromotions] = useStorage<Promotion[]>('promotions', INITIAL_ADS);
  const [settings, setSettings] = useStorage<AppSettings>('settings', { coinConversionRate: 5 }); 
  
  // App Navigation
  const [currentView, setCurrentView] = useState('home');
  const [authError, setAuthError] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

  // Handle Login
  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const user = users.find(u => u.username === data.get('username') && u.password === data.get('password'));
    
    if (user) {
      if (user.role === Role.OPERATOR && user.operatorDetails?.status !== OperatorStatus.ACTIVE) {
        setAuthError('Akun Operator Anda belum disetujui Admin atau ditangguhkan.');
        return;
      }
      setCurrentUser(user);
      setCurrentView('home');
      setAuthError('');
    } else {
      setAuthError('Username atau password salah.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('login');
  };

  const updateUserProfile = (updatedUser: User) => {
    const updatedUsers = users.map(u => u.id === updatedUser.id ? updatedUser : u);
    setUsers(updatedUsers);
    if (currentUser?.id === updatedUser.id) setCurrentUser(updatedUser);
  };

  // Business Logic Handlers
  const handleNewTransaction = (transaction: WasteTransaction) => {
    // 1. Save Transaction to History (accessible by Admin, Operator, User)
    setTransactions([transaction, ...transactions]);
    
    // 2. Add Coins to User Automatically in the "Database"
    const updatedUsers = users.map(u => {
      if (u.id === transaction.userId) {
        return { ...u, coins: u.coins + transaction.coinsEarned };
      }
      return u;
    });
    setUsers(updatedUsers);

    // 3. Update current user session if the current user is the one receiving coins
    if (currentUser?.id === transaction.userId) {
       setCurrentUser({ ...currentUser, coins: currentUser.coins + transaction.coinsEarned });
    }
    
    // 4. Return to home view
    setCurrentView('home');
  };

  const handleRedemption = (product: SembakoProduct) => {
    if (!currentUser || currentUser.coins < product.priceInCoins) return;
    
    const newRedemption: RedemptionTransaction = {
      id: `RD-${Math.random().toString(36).substring(7).toUpperCase()}`,
      userId: currentUser.id,
      productId: product.id,
      productName: product.name,
      coinsSpent: product.priceInCoins,
      timestamp: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
      status: 'PENDING',
      qrCode: `ECRD-${Date.now()}-${currentUser.id}`
    };

    setRedemptions([newRedemption, ...redemptions]);
    setCurrentView('home');
  };

  const confirmRedemption = (id: string) => {
    const rIndex = redemptions.findIndex(r => r.id === id);
    if (rIndex === -1) return;
    
    const r = redemptions[rIndex];
    if (r.status !== 'PENDING' || Date.now() > r.expiresAt) {
      return false;
    }

    const user = users.find(u => u.id === r.userId);
    const product = products.find(p => p.id === r.productId);
    
    if (user && user.coins >= r.coinsSpent && product && product.stock > 0) {
      const updatedUsers = users.map(u => u.id === user.id ? { ...u, coins: u.coins - r.coinsSpent } : u);
      setUsers(updatedUsers);
      if (currentUser?.id === user.id) setCurrentUser({ ...currentUser, coins: currentUser.coins - r.coinsSpent });

      setProducts(products.map(p => p.id === r.productId ? { ...p, stock: p.stock - 1 } : p));
      
      const updatedRedemptions = [...redemptions];
      updatedRedemptions[rIndex].status = 'COMPLETED';
      setRedemptions(updatedRedemptions);

      setSelectedReceipt({ type: 'REDEMPTION', data: updatedRedemptions[rIndex] });
      return true;
    } else {
      return false;
    }
  };

  // Auth Routing
  if (!currentUser) {
    if (currentView === 'register') return <RegisterView onBack={() => setCurrentView('login')} onRegister={(u) => { setUsers([...users, u]); setCurrentView('login'); }} />;
    if (currentView === 'forgotPassword') return <OTPAuthView mode="FORGOT" onBack={() => setCurrentView('login')} users={users} setUsers={setUsers} />;
    return <LoginView onLogin={handleLogin} error={authError} onRegister={() => setCurrentView('register')} onForgot={() => setCurrentView('forgotPassword')} />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {selectedReceipt && <ReceiptModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}

      <aside className="hidden md:flex w-72 flex-col bg-slate-900 text-white h-screen sticky top-0 overflow-hidden shadow-2xl">
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-xl shadow-lg shadow-emerald-500/30">
              <Trash2 className="text-white" size={24} />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">EcoKoin</h1>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <SidebarItem icon={<Home size={20}/>} label="Beranda" active={currentView === 'home'} onClick={() => setCurrentView('home')} />
          {currentUser.role === Role.USER && (
            <>
              <SidebarItem icon={<ShoppingBag size={20}/>} label="Tukar Sembako" active={currentView === 'market'} onClick={() => setCurrentView('market')} />
              <SidebarItem icon={<TrendingUp size={20}/>} label="Riwayat & Koin" active={currentView === 'history'} onClick={() => setCurrentView('history')} />
            </>
          )}
          {currentUser.role === Role.OPERATOR && (
            <>
              <SidebarItem icon={<Camera size={20}/>} label="Timbang Sampah" active={currentView === 'weigh'} onClick={() => setCurrentView('weigh')} />
              <SidebarItem icon={<QrCode size={20}/>} label="Scan Penukaran" active={currentView === 'scan'} onClick={() => setCurrentView('scan')} />
            </>
          )}
          {currentUser.role === Role.ADMIN && (
            <>
              <SidebarItem icon={<LayoutDashboard size={20}/>} label="Dashboard Panel" active={currentView === 'adminDashboard'} onClick={() => setCurrentView('adminDashboard')} />
              <SidebarItem icon={<Package size={20}/>} label="Kelola Stok" active={currentView === 'manageProducts'} onClick={() => setCurrentView('manageProducts')} />
              <SidebarItem icon={<ShieldCheck size={20}/>} label="Verifikasi Operator" active={currentView === 'manageOperators'} onClick={() => setCurrentView('manageOperators')} />
              <SidebarItem icon={<ImageIcon size={20}/>} label="Kelola Iklan" active={currentView === 'manageAds'} onClick={() => setCurrentView('manageAds'} />
              <SidebarItem icon={<FileText size={20}/>} label="Laporan" active={currentView === 'reports'} onClick={() => setCurrentView('reports')} />
            </>
          )}
          <SidebarItem icon={<Settings size={20}/>} label="Pengaturan" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
        </nav>
        <div className="p-6 mt-auto">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:text-white hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all">
            <LogOut size={20} /> Keluar
          </button>
        </div>
      </aside>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-50 flex justify-around py-3 px-4 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
        <MobileNavItem icon={<Home size={22}/>} active={currentView === 'home'} onClick={() => setCurrentView('home')} />
        {currentUser.role === Role.USER && <MobileNavItem icon={<ShoppingBag size={22}/>} active={currentView === 'market'} onClick={() => setCurrentView('market')} />}
        {currentUser.role === Role.OPERATOR && <MobileNavItem icon={<Camera size={22}/>} active={currentView === 'weigh'} onClick={() => setCurrentView('weigh')} />}
        {currentUser.role === Role.ADMIN && <MobileNavItem icon={<LayoutDashboard size={22}/>} active={currentView === 'adminDashboard'} onClick={() => setCurrentView('adminDashboard')} />}
        <MobileNavItem icon={<Settings size={22}/>} active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
      </nav>

      <main className="flex-1 overflow-y-auto pb-24 md:pb-0 h-screen">
        <div className="max-w-5xl mx-auto p-6 md:p-10">
          {currentView === 'home' && <HomeView user={currentUser} ads={promotions} history={transactions} redemptions={redemptions} onAction={(view) => setCurrentView(view)} />}
          {currentView === 'market' && <MarketView products={products} user={currentUser} onRedeem={handleRedemption} />}
          {currentView === 'weigh' && <OperatorWeighView user={currentUser} users={users} onSubmit={handleNewTransaction} settings={settings} />}
          {currentView === 'scan' && <OperatorScanView redemptions={redemptions} onConfirm={confirmRedemption} users={users} />}
          {currentView === 'adminDashboard' && <AdminDashboardView users={users} transactions={transactions} products={products} settings={settings} setSettings={setSettings} />}
          {currentView === 'manageProducts' && <ManageProductsView products={products} setProducts={setProducts} />}
          {currentView === 'manageOperators' && <ManageOperatorsView users={users} setUsers={setUsers} />}
          {currentView === 'manageAds' && <ManageAdsView ads={promotions} setAds={setPromotions} />}
          {currentView === 'reports' && <ReportsView transactions={transactions} redemptions={redemptions} />}
          {currentView === 'settings' && <SettingsView user={currentUser} onUpdate={updateUserProfile} onNavigate={(v) => setCurrentView(v)} />}
          {currentView === 'changePassword' && <OTPAuthView mode="CHANGE" onBack={() => setCurrentView('settings')} users={users} setUsers={setUsers} currentUser={currentUser} />}
          {currentView === 'operatorRegistration' && <OperatorRegisterView user={currentUser} onUpdate={updateUserProfile} onBack={() => setCurrentView('settings')} />}
          {currentView === 'history' && <HistoryView transactions={transactions} redemptions={redemptions} user={currentUser} onReceipt={(type, data) => setSelectedReceipt({type, data})} />}
        </div>
      </main>
    </div>
  );
}

// --- SHARED COMPONENTS ---

function SidebarItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl transition-all duration-300 ${active ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
      {icon} <span className="font-semibold">{label}</span>
    </button>
  );
}

function MobileNavItem({ icon, active, onClick }: { icon: any, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`p-3 rounded-2xl transition-all ${active ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'}`}>
      {icon}
    </button>
  );
}

// --- AUTH VIEWS ---

function LoginView({ onLogin, error, onRegister, onForgot }: any) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-[40px] shadow-2xl w-full max-w-md border border-slate-100">
        <div className="text-center mb-10">
          <div className="bg-emerald-100 w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Trash2 className="text-emerald-600" size={48} />
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">EcoKoin</h2>
          <p className="text-slate-500 mt-2 font-medium">Ubah Sampah Menjadi Berkah</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm flex items-center gap-3 border border-red-100 font-medium animate-shake"><AlertCircle size={20} /> {error}</div>}

        <form onSubmit={onLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Username</label>
            <input name="username" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium" placeholder="Contoh: POLTEKKES" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
            <input name="password" type="password" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium" placeholder="••••••••" />
          </div>
          <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200">Masuk Sekarang</button>
        </form>

        <div className="mt-10 pt-8 border-t border-slate-50 text-center space-y-4">
          <button onClick={onForgot} className="text-sm font-bold text-slate-400 hover:text-emerald-600 transition-colors">Lupa Password?</button>
          <p className="text-sm text-slate-500">Belum punya akun? <button onClick={onRegister} className="text-emerald-600 font-black hover:underline underline-offset-4">Daftar Sekarang</button></p>
        </div>
      </div>
    </div>
  );
}

function RegisterView({ onBack, onRegister }: any) {
  const handleSubmit = (e: any) => {
    e.preventDefault();
    const data = new FormData(e.target);
    onRegister({
      id: `USR-${Date.now()}`,
      username: data.get('username'),
      fullName: data.get('fullName'),
      email: data.get('email'),
      phone: data.get('phone'),
      address: data.get('address'),
      password: data.get('password'),
      role: Role.USER,
      coins: 0
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-[40px] shadow-2xl w-full max-w-2xl border border-slate-100">
        <button onClick={onBack} className="text-slate-400 mb-6 hover:text-slate-600 flex items-center gap-2 font-bold transition-all"><ArrowRight size={20} className="rotate-180" /> Kembali</button>
        <h2 className="text-3xl font-black mb-8 tracking-tight">Pendaftaran Anggota</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2"><Input label="Nama Lengkap" name="fullName" required /></div>
          <Input label="Username" name="username" required />
          <Input label="Email (Gmail Aktif)" name="email" type="email" required />
          <Input label="Nomor WhatsApp" name="phone" type="tel" required />
          <Input label="Password" name="password" type="password" required />
          <div className="md:col-span-2"><Input label="Alamat Lengkap (RT/RW/Desa)" name="address" required textarea /></div>
          <button type="submit" className="md:col-span-2 bg-emerald-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-emerald-700 mt-6 shadow-xl shadow-emerald-100">Daftar Akun Baru</button>
        </form>
      </div>
    </div>
  );
}

function Input({ label, name, type = 'text', required, textarea, defaultValue, onChange, value, placeholder, autoFocus }: any) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-700 ml-1 uppercase tracking-wider">{label}</label>
      {textarea ? (
        <textarea name={name} value={value} onChange={onChange} required={required} defaultValue={defaultValue} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium" rows={3} placeholder={placeholder} />
      ) : (
        <input name={name} value={value} onChange={onChange} type={type} required={required} defaultValue={defaultValue} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium" placeholder={placeholder} autoFocus={autoFocus} />
      )}
    </div>
  );
}

function OTPAuthView({ mode, onBack, users, setUsers, currentUser }: any) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(currentUser?.email || '');
  const [targetUser, setTargetUser] = useState<User | null>(currentUser || null);
  const [otpInput, setOtpInput] = useState('');
  const [newPass, setNewPass] = useState('');

  const sendCode = (e: any) => {
    e.preventDefault();
    const found = users.find((u: User) => u.email === email);
    if (found || mode === 'CHANGE') {
      if (!found && mode === 'FORGOT') return;
      setTargetUser(found || currentUser);
      setStep(2);
    }
  };

  const verifyOTP = (e: any) => {
    e.preventDefault();
    if (otpInput === '1234') setStep(3);
  };

  const finalize = (e: any) => {
    e.preventDefault();
    if (targetUser) {
      setUsers(users.map((u: User) => u.id === targetUser.id ? { ...u, password: newPass } : u));
      onBack();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-[40px] shadow-2xl w-full max-w-md text-center border border-slate-100">
        <h2 className="text-3xl font-black mb-4 tracking-tight">{mode === 'FORGOT' ? 'Reset Password' : 'Ganti Password'}</h2>
        {step === 1 && (
          <form onSubmit={sendCode} className="space-y-6">
            <p className="text-slate-500 font-medium">Masukkan email Gmail untuk menerima kode verifikasi.</p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email Anda" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-center text-lg font-bold" />
            <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black hover:bg-emerald-700 transition-all">Kirim Kode ke Gmail</button>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={verifyOTP} className="space-y-6">
            <p className="text-slate-500 font-medium">Kami telah mengirim kode ke <span className="text-emerald-600 font-bold">{email}</span></p>
            <div className="flex justify-center gap-3">
               <input maxLength={4} value={otpInput} onChange={(e) => setOtpInput(e.target.value)} required placeholder="••••" className="w-40 px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-center text-2xl font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <p className="text-[10px] text-slate-400">Gunakan kode simulasi: <b>1234</b></p>
            <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black hover:bg-emerald-700 transition-all">Verifikasi Kode</button>
          </form>
        )}
        {step === 3 && (
          <form onSubmit={finalize} className="space-y-6">
            <p className="text-slate-500 font-medium">Verifikasi berhasil! Silakan buat password baru.</p>
            <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required placeholder="Password Baru" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-center font-bold" />
            <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black hover:bg-emerald-700 transition-all">Perbarui Password</button>
          </form>
        )}
        <button onClick={onBack} className="mt-8 text-slate-400 font-bold hover:text-slate-600 transition-colors">Batal & Kembali</button>
      </div>
    </div>
  );
}

// --- MAIN VIEWS ---

function HomeView({ user, ads, history, redemptions, onAction }: any) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const pendingRedemption = redemptions.find((r: any) => r.userId === user.id && r.status === 'PENDING' && Date.now() < r.expiresAt);
  
  useEffect(() => {
    if (!pendingRedemption) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((pendingRedemption.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingRedemption]);

  const handleAdClick = (ad: Promotion) => {
    if (ad.link) {
      window.open(ad.link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-10 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Selamat Datang, {user.fullName.split(' ')[0]}! 👋</h2>
          <p className="text-slate-500 font-medium mt-1">Sistem ekonomi lingkungan modern POLTEKKES.</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-xl transition-all duration-500">
          <div className="bg-amber-100 p-4 rounded-2xl">
            <TrendingUp className="text-amber-600" size={28} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Saldo EcoKoin</p>
            <p className="text-3xl font-black text-slate-900">{user.coins} <span className="text-sm font-bold text-amber-500 tracking-normal">KOIN</span></p>
          </div>
        </div>
      </header>

      {/* Ads Carousel */}
      <div 
        onClick={() => handleAdClick(ads[0])}
        className={`relative group overflow-hidden rounded-[40px] shadow-2xl h-56 md:h-80 lg:h-[400px] bg-slate-200 border-4 border-white ${ads[0]?.link ? 'cursor-pointer' : ''}`}
      >
        <div className="absolute inset-0 flex transition-transform duration-700">
           <img src={ads[0]?.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" alt="Promotion" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8">
           <div className="flex items-center justify-between mb-3">
             <span className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Penawaran Spesial</span>
             {ads[0]?.link && <ExternalLink size={20} className="text-white opacity-80" />}
           </div>
           <h3 className="text-white text-2xl md:text-4xl lg:text-5xl font-black leading-tight max-w-2xl">{ads[0]?.title}</h3>
        </div>
      </div>

      {/* Actions Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <HomeActionCard color="emerald" icon={<Trash2/>} label="Setor Sampah" sub="Setiap 2kg = 10 Koin" onClick={() => onAction(user.role === Role.OPERATOR ? 'weigh' : 'home')} />
        <HomeActionCard color="amber" icon={<ShoppingBag/>} label="Tukar Sembako" sub="Mulai 10 Koin" onClick={() => onAction('market')} />
        <HomeActionCard color="blue" icon={<QrCode/>} label="Scan QR" sub="Verifikasi Cepat" onClick={() => onAction(user.role === Role.OPERATOR ? 'scan' : 'history')} />
        <HomeActionCard color="slate" icon={<UserIcon/>} label="Profil Saya" sub="Atur Akun" onClick={() => onAction('settings')} />
      </div>

      {/* Secure QR Code with Anti-Screenshot Measures */}
      {pendingRedemption && (
        <div className="bg-white p-8 rounded-[40px] border border-amber-100 shadow-xl shadow-amber-500/5 relative overflow-hidden text-center">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-50 rounded-full blur-3xl opacity-50" />
          <h3 className="font-black text-slate-900 text-xl mb-2 flex items-center justify-center gap-3">
             <div className="p-2 bg-amber-100 rounded-xl"><Clock size={20} className="text-amber-600"/></div>
             Penukaran {pendingRedemption.productName}
          </h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6">Berikan kode ini ke Operator TPST</p>
          
          <div className="relative inline-block p-8 bg-white rounded-[32px] shadow-inner border border-slate-100">
             {/* Anti-screenshot pulsing layer */}
             <div className="absolute inset-0 bg-emerald-500/5 animate-pulse rounded-[32px] pointer-events-none z-10" />
             <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center opacity-10">
                <span className="text-emerald-900 font-black text-4xl rotate-45 select-none uppercase tracking-[1em]">LIVENESS</span>
             </div>
             
             <div className="relative z-0">
                <QrCode size={200} className="text-slate-900" />
             </div>
             
             <div className="mt-4 py-2 px-6 bg-slate-900 text-white rounded-2xl inline-block">
                <p className="font-black text-lg tracking-widest uppercase">{pendingRedemption.id}</p>
             </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-2">
             <div className="flex items-center gap-2 text-amber-600 font-black text-xl tabular-nums">
                <Clock size={20} />
                {Math.floor(timeLeft! / 60)}:{(timeLeft! % 60).toString().padStart(2, '0')}
             </div>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Kode akan kedaluwarsa secara otomatis</p>
          </div>
        </div>
      )}
    </div>
  );
}

function HomeActionCard({ color, icon, label, sub, onClick }: any) {
  const colors: any = {
    emerald: 'bg-emerald-500 shadow-emerald-500/20 text-emerald-500',
    amber: 'bg-amber-500 shadow-amber-500/20 text-amber-500',
    blue: 'bg-blue-500 shadow-blue-500/20 text-blue-500',
    slate: 'bg-slate-800 shadow-slate-800/20 text-slate-800'
  };

  return (
    <button onClick={onClick} className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-left w-full group">
      <div className={`${colors[color].split(' ')[0]} w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
        {React.cloneElement(icon, { size: 28 })}
      </div>
      <p className="font-black text-slate-900 text-lg leading-tight">{label}</p>
      <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">{sub}</p>
    </button>
  );
}

// --- OPERATOR VIEWS ---

function OperatorWeighView({ user, users, onSubmit, settings }: any) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [scalePhoto, setScalePhoto] = useState<string | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [weight, setWeight] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.role === Role.USER && 
      (u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || u.phone.includes(searchQuery))
    );
  }, [users, searchQuery]);

  const handleFileChange = async (e: any, type: 'scale' | 'selfie') => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      if (type === 'scale') {
        setScalePhoto(base64);
      } else {
        setSelfiePhoto(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const finalize = async () => {
    if (!targetUser || weight <= 0 || !scalePhoto || !selfiePhoto) {
      alert("Pastikan semua data terisi: Foto Timbangan, Berat Sampah, dan Selfie.");
      return;
    }
    
    setIsLoading(true);
    try {
      // Analyze photo for humans - mandatory security verification
      const isValid = await verifyTransactionPhotos(selfiePhoto);
      if (isValid) {
        const coins = Math.floor(weight * settings.coinConversionRate);
        const transaction: WasteTransaction = {
          id: `TX-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          userId: targetUser.id,
          userName: targetUser.fullName,
          operatorId: user.id,
          weightKg: weight,
          coinsEarned: coins,
          timestamp: Date.now(),
          scalePhoto,
          verificationPhoto: selfiePhoto,
          location: user.operatorDetails?.tpstLocation || 'Lokasi TPST Poltekkes'
        };
        
        // Hide loader and immediately show Success Notification screen
        setIsLoading(false);
        setShowSuccess(true);
        
        // Return to Home Menu automatically after a short delay
        let timer = 3;
        const interval = setInterval(() => {
          timer -= 1;
          setCountdown(timer);
          if (timer <= 0) {
            clearInterval(interval);
            onSubmit(transaction); // This adds coins and redirects home
          }
        }, 1000);

      } else {
        setIsLoading(false);
        alert('Verifikasi wajah gagal. Pastikan foto selfie memperlihatkan wajah Nasabah dan Operator dengan jelas.');
      }
    } catch (err) {
      setIsLoading(false);
      console.error(err);
      alert('Gagal memverifikasi data. Harap periksa koneksi internet Anda.');
    }
  };

  // SUCCESS SCREEN OVERLAY - FIXED VISIBILITY
  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-10 animate-fade-in overflow-hidden">
         {/* Confetti Animation Background */}
         <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(24)].map((_, i) => (
              <div 
                key={i} 
                className="absolute animate-confetti-float opacity-70"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-10%`,
                  backgroundColor: ['#10b981', '#fbbf24', '#3b82f6', '#f472b6', '#a855f7'][i % 5],
                  width: `${Math.random() * 10 + 6}px`,
                  height: `${Math.random() * 10 + 6}px`,
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${3 + Math.random() * 3}s`
                }}
              />
            ))}
         </div>

         <div className="relative z-10 flex flex-col items-center text-center">
            <div className="bg-emerald-100 p-10 rounded-full mb-8 shadow-2xl shadow-emerald-500/20 animate-bounce-in relative">
               <CheckCircle size={100} className="text-emerald-600" />
               <div className="absolute -top-2 -right-2 bg-amber-400 p-3 rounded-full border-4 border-white animate-pulse shadow-lg">
                  <Sparkles size={24} className="text-white" />
               </div>
            </div>
            
            <h2 className="text-5xl font-black text-slate-900 tracking-tight mb-4 drop-shadow-sm">TRANSAKSI SUKSES!</h2>
            <p className="text-xl text-slate-500 font-bold max-w-md mb-10 leading-relaxed">
              Poin <span className="text-amber-500 font-black">+{Math.floor(weight * settings.coinConversionRate)}</span> otomatis masuk ke saldo <span className="text-slate-900 underline decoration-emerald-500 decoration-4 underline-offset-4">{targetUser?.fullName}</span>.
            </p>
            
            <div className="bg-slate-50 p-8 rounded-[44px] border border-slate-100 w-full max-w-sm space-y-4 shadow-xl animate-slide-up">
               <div className="flex justify-between items-center text-sm font-bold text-slate-400">
                  <span className="uppercase tracking-[0.2em]">Penyetor</span>
                  <span className="text-slate-900 font-black text-right">{targetUser?.fullName}</span>
               </div>
               <div className="flex justify-between items-center text-sm font-bold text-slate-400">
                  <span className="uppercase tracking-[0.2em]">Operator</span>
                  <span className="text-slate-900 font-black">{user.fullName.split(' ')[0]}</span>
               </div>
               <div className="pt-4 border-t border-dashed border-slate-200 flex flex-col gap-2 text-left">
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                     <MapPin size={12} className="text-emerald-500" /> {user.operatorDetails?.tpstLocation || 'TPST Poltekkes'}
                  </div>
                  <div className="flex justify-between items-end">
                     <span className="text-5xl font-black text-emerald-600 tabular-nums">{weight} <span className="text-sm font-bold uppercase tracking-normal">kg</span></span>
                     <div className="bg-amber-400 px-5 py-2.5 rounded-2xl flex items-center gap-2 shadow-lg shadow-amber-400/20">
                        <TrendingUp size={20} className="text-slate-900" />
                        <span className="font-black text-slate-900">+{Math.floor(weight * settings.coinConversionRate)} KOIN</span>
                     </div>
                  </div>
               </div>
            </div>
            
            <div className="mt-14 flex flex-col items-center gap-4">
               <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 animate-ping rounded-full border-4 border-emerald-500/20" />
                  <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center text-white font-black text-2xl relative z-10 shadow-xl">
                     {countdown}
                  </div>
               </div>
               <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] animate-pulse">Menuju Beranda Utama...</p>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Penimbangan Sampah</h2>
        <div className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-black uppercase tracking-widest shadow-sm">Langkah {step} dari 3</div>
      </div>
      
      {step === 1 && (
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 space-y-6 animate-slide-up">
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><Search size={20}/></div>
                 <p className="font-black text-slate-900 text-xl tracking-tight">Cari & Pilih Nasabah</p>
              </div>
              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik nama atau nomor HP..." 
                  className="w-full pl-16 pr-8 py-6 rounded-[28px] bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all font-bold text-xl placeholder-slate-300 shadow-inner"
                />
              </div>
           </div>

           <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
             {filteredUsers.map(u => (
               <button key={u.id} onClick={() => { setTargetUser(u); setStep(2); }} className="w-full flex items-center justify-between p-6 rounded-3xl border border-slate-100 hover:bg-emerald-50 hover:border-emerald-200 transition-all group text-left shadow-sm">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-[22px] bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-emerald-500 transition-all duration-500 shrink-0 shadow-inner">
                      <UserIcon size={32} />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-xl leading-tight group-hover:text-emerald-700 transition-colors">{u.fullName}</p>
                      <p className="text-xs text-slate-500 font-bold mt-1 opacity-70 uppercase tracking-widest">{u.phone}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                    <ChevronRight size={20} />
                  </div>
               </button>
             ))}
           </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white p-10 rounded-[44px] shadow-xl border border-slate-100 space-y-10 animate-slide-up">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-[22px] flex items-center justify-center shadow-inner"><Camera size={28}/></div>
                <h3 className="text-3xl font-black tracking-tight">Input Hasil Berat</h3>
             </div>
             <button onClick={() => setStep(1)} className="text-slate-400 hover:text-emerald-600 text-sm font-black flex items-center gap-1.5 transition-colors group">
               Ganti User <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
             </button>
          </div>
          
          <div className="flex flex-col items-center gap-10">
            {scalePhoto ? (
              <div className="relative w-full aspect-video rounded-[36px] overflow-hidden shadow-2xl bg-slate-100 border-4 border-white group">
                <img src={scalePhoto} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-8">
                   <p className="text-white font-black uppercase text-xs tracking-[0.3em]">Foto Bukti Timbangan</p>
                </div>
                <button onClick={() => { setScalePhoto(null); setWeight(0); }} className="absolute top-6 right-6 bg-white/95 p-4 rounded-full text-red-500 shadow-2xl backdrop-blur-md hover:bg-red-500 hover:text-white hover:scale-110 transition-all"><Trash size={24}/></button>
              </div>
            ) : (
              <label className="w-full aspect-video rounded-[48px] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 hover:border-emerald-100 transition-all duration-500 group shadow-inner">
                <div className="bg-slate-100 p-8 rounded-[36px] mb-6 group-hover:scale-110 group-hover:bg-white group-hover:text-emerald-500 transition-all duration-500 shadow-md">
                   <Camera size={56} />
                </div>
                <span className="text-xl font-black text-slate-400 group-hover:text-emerald-600 transition-colors">Ambil Foto Hasil Timbangan</span>
                <input type="file" capture="environment" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'scale')} />
              </label>
            )}

            {/* REAL-TIME COIN SIMULATION */}
            <div className="w-full space-y-6">
               <div className="bg-slate-900 text-white p-12 rounded-[52px] shadow-2xl relative overflow-hidden group border-b-8 border-emerald-500">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-emerald-500/20 transition-all duration-1000" />
                  
                  <div className="absolute top-8 right-8">
                     <div className="bg-amber-400 text-slate-900 px-7 py-3 rounded-2xl flex items-center gap-4 font-black shadow-2xl animate-bounce-in">
                        <TrendingUp size={24}/>
                        <span className="text-2xl">+{Math.floor(weight * settings.coinConversionRate)} <span className="text-[10px] font-black uppercase tracking-widest">Koin</span></span>
                     </div>
                  </div>

                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-6 opacity-70">Masukan Angka di Timbangan</p>
                  <div className="flex items-center gap-8">
                    <div className="relative flex-1">
                      <input 
                        type="number" 
                        step="0.1" 
                        value={weight || ''}
                        onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800/40 rounded-[32px] px-10 py-8 text-7xl font-black tabular-nums focus:outline-none focus:ring-4 focus:ring-emerald-500/40 transition-all placeholder-slate-700 shadow-inner"
                        placeholder="0.0"
                        autoFocus
                      />
                      <span className="absolute right-10 top-1/2 -translate-y-1/2 text-4xl text-slate-600 font-black">KG</span>
                    </div>
                  </div>
                  
                  <div className="mt-10 flex items-center gap-5 text-slate-400 bg-white/5 p-6 rounded-[28px] border border-white/5">
                    <Zap size={22} className="text-amber-400 animate-pulse" />
                    <p className="text-sm font-bold leading-relaxed italic opacity-80">Setiap 2 KG sampah bernilai {settings.coinConversionRate * 2} koin digital POLTEKKES.</p>
                  </div>
               </div>
            </div>
          </div>

          <button 
            disabled={weight <= 0 || !scalePhoto} 
            onClick={() => setStep(3)} 
            className="w-full bg-emerald-600 text-white py-7 rounded-[32px] font-black text-2xl hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-300 transition-all shadow-2xl shadow-emerald-500/30 flex items-center justify-center gap-4 group"
          >
            Lanjut ke Selfie <ArrowRight size={28} className="group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white p-12 rounded-[48px] shadow-2xl border border-slate-100 space-y-10 animate-slide-up">
           <div className="flex items-center gap-6">
             <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-[28px] flex items-center justify-center shadow-inner"><ShieldCheck size={32}/></div>
             <div>
                <h3 className="text-3xl font-black tracking-tight">Verifikasi Selfie Ganda</h3>
                <p className="text-slate-400 font-bold text-sm mt-1">Foto Bukti Penyerahan (Nasabah + Operator)</p>
             </div>
          </div>
          
          <div className="flex flex-col items-center gap-8 text-center">
             {selfiePhoto ? (
               <div className="relative w-full aspect-[4/3] rounded-[40px] overflow-hidden shadow-2xl border-4 border-white group">
                 <img src={selfiePhoto} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
                 <button onClick={() => setSelfiePhoto(null)} className="absolute top-6 right-6 bg-white/95 p-4 rounded-full text-red-500 shadow-2xl backdrop-blur-md hover:bg-red-500 hover:text-white hover:scale-110 transition-all"><Trash size={24}/></button>
               </div>
             ) : (
               <label className="w-full aspect-[4/3] rounded-[52px] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-100 transition-all duration-500 group shadow-inner">
                 <div className="bg-slate-100 p-10 rounded-[40px] mb-6 group-hover:scale-110 group-hover:bg-white group-hover:text-blue-500 transition-all duration-500 shadow-md">
                    <Camera size={56} />
                 </div>
                 <span className="text-xl font-black text-slate-400 group-hover:text-blue-600 transition-colors">Ambil Selfie Bersama Nasabah</span>
                 <input type="file" capture="user" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'selfie')} />
               </label>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
             <button onClick={() => setStep(2)} className="bg-slate-50 text-slate-600 py-7 rounded-[32px] font-black text-lg hover:bg-slate-100 transition-all border border-slate-100">Kembali</button>
             <button 
                disabled={!selfiePhoto || isLoading} 
                onClick={finalize} 
                className="bg-emerald-600 text-white py-7 rounded-[32px] font-black text-xl hover:bg-emerald-700 disabled:bg-slate-100 transition-all flex items-center justify-center gap-4 shadow-2xl shadow-emerald-500/30 group"
             >
               {isLoading ? <Loader2 className="animate-spin" size={28}/> : <CheckCircle size={28}/>}
               <span className="group-hover:scale-105 transition-transform">Konfirmasi & Simpan</span>
             </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OperatorScanView({ redemptions, onConfirm, users }: any) {
  const [scanning, setScanning] = useState(true);
  const [selectedRD, setSelectedRD] = useState<RedemptionTransaction | null>(null);
  const pending = redemptions.filter((r: any) => r.status === 'PENDING' && Date.now() < r.expiresAt);

  const handleScan = (r: RedemptionTransaction) => {
    setSelectedRD(r);
    setScanning(false);
  };

  const handleFinalConfirm = async () => {
    if (!selectedRD) return;
    const success = onConfirm(selectedRD.id);
    if (success) {
      alert(`PENYERAHAN BERHASIL! Sembako (${selectedRD.productName}) telah diserahkan.`);
      setSelectedRD(null);
      setScanning(true);
    }
  };

  const selectedUser = useMemo(() => {
    if (!selectedRD) return null;
    return users.find((u: User) => u.id === selectedRD.userId);
  }, [selectedRD, users]);

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl mx-auto">
      <h2 className="text-3xl font-black text-slate-900 tracking-tight">Scan Penukaran Sembako</h2>

      {scanning ? (
        <div className="bg-slate-900 rounded-[40px] overflow-hidden relative aspect-square md:aspect-video flex items-center justify-center border-4 border-slate-800 shadow-2xl">
           <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-emerald-500/50 rounded-3xl relative">
                 <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl" />
                 <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl" />
                 <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl" />
                 <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-emerald-500 rounded-br-xl" />
                 <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-500/50 animate-scan-line shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              </div>
              <p className="mt-8 text-emerald-500 font-black text-sm uppercase tracking-widest animate-pulse">Arahkan ke QR Nasabah</p>
           </div>
           
           <div className="absolute bottom-8 inset-x-8 space-y-3 max-h-48 overflow-y-auto">
             {pending.map((r: any) => (
               <button 
                  key={r.id} 
                  onClick={() => handleScan(r)}
                  className="w-full bg-emerald-500 text-white p-4 rounded-2xl font-black flex items-center justify-between animate-bounce-in shadow-xl"
               >
                  <div className="flex items-center gap-3">
                     <QrCode size={20} />
                     <span>QR Terdeteksi: {r.id}</span>
                  </div>
                  <ChevronRight size={20} />
               </button>
             ))}
             {pending.length === 0 && (
               <div className="text-white/40 text-center text-xs font-bold uppercase tracking-widest py-4">Menunggu Nasabah...</div>
             )}
           </div>
        </div>
      ) : (
        <div className="bg-white p-10 rounded-[40px] shadow-xl border border-slate-100 animate-slide-up space-y-8">
           <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-inner">
                 <Package size={32} />
              </div>
              <div className="flex-1">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Produk Penukaran</p>
                 <h4 className="text-2xl font-black text-slate-900">{selectedRD?.productName}</h4>
                 <p className="text-sm font-bold text-amber-600">Biaya: {selectedRD?.coinsSpent} Koin</p>
              </div>
           </div>

           <div className="space-y-4">
              <p className="text-sm font-bold text-slate-700 ml-1">Data Nasabah</p>
              <div className="p-6 rounded-3xl border border-slate-100 space-y-4">
                 <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Nama Nasabah</span>
                    <span className="text-slate-900 font-black">{selectedUser?.fullName}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Saldo Koin Saat Ini</span>
                    <span className="text-amber-600 font-black text-lg">{selectedUser?.coins} KOIN</span>
                 </div>
                 <div className="flex justify-between items-center py-3 border-t border-dashed border-slate-200">
                    <span className="text-slate-400 font-medium">Status Stock</span>
                    <span className="text-emerald-600 font-black uppercase text-sm">Tersedia ✓</span>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setScanning(true)} className="bg-slate-50 text-slate-600 py-6 rounded-[32px] font-black hover:bg-slate-100 transition-all">Batal</button>
              <button 
                onClick={handleFinalConfirm}
                className="bg-emerald-600 text-white py-6 rounded-[32px] font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100"
              >
                Konfirmasi Penyerahan
              </button>
           </div>
        </div>
      )}
    </div>
  );
}

// --- ADMIN & MANAGEMENT VIEWS ---

function ManageAdsView({ ads, setAds }: any) {
  const [editing, setEditing] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (editing?.image) setPreviewImage(editing.image);
    else setPreviewImage(null);
  }, [editing]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const saveAd = (e: any) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const newAd = {
      id: editing?.id || `AD-${Date.now()}`,
      title: data.get('title') as string,
      link: data.get('link') as string,
      image: previewImage || `https://picsum.photos/seed/${Date.now()}/1200/400`
    };
    if (editing?.id) setAds(ads.map((a:any) => a.id === editing.id ? newAd : a));
    else setAds([newAd, ...ads]);
    setEditing(null);
    setPreviewImage(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-900">Kelola Iklan & Promo</h2>
        <button onClick={() => setEditing({})} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-all"><Plus size={20}/> Tambah Promo</button>
      </div>

      <div className="grid gap-6">
        {ads.map((ad: any) => (
          <div key={ad.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 group hover:shadow-lg transition-all duration-500">
            <div className="relative w-full md:w-72 h-40 rounded-3xl overflow-hidden shadow-inner flex-shrink-0">
               <img src={ad.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
               {ad.link && (
                 <div className="absolute top-3 right-3 bg-white/90 p-2 rounded-xl text-emerald-600 shadow-xl backdrop-blur-md">
                   <ExternalLink size={16} />
                 </div>
               )}
            </div>
            <div className="flex-1 flex flex-col justify-center py-2">
              <h4 className="text-2xl font-black text-slate-900 leading-tight">{ad.title}</h4>
              {ad.link && (
                <div className="flex items-center gap-1.5 mt-2 text-emerald-600 font-bold text-sm">
                   <ExternalLink size={14} />
                   <p className="line-clamp-1 break-all">{ad.link}</p>
                </div>
              )}
              <div className="flex items-center gap-4 mt-6">
                 <button onClick={() => setEditing(ad)} className="text-emerald-600 font-black text-sm bg-emerald-50 px-6 py-2.5 rounded-2xl hover:bg-emerald-100 transition-colors">Edit Detail</button>
                 <button onClick={() => { if(confirm('Hapus iklan ini?')) setAds(ads.filter((a:any) => a.id !== ad.id)); }} className="text-red-500 font-black text-sm bg-red-50 px-6 py-2.5 rounded-2xl hover:bg-red-100 transition-colors">Hapus</button>
              </div>
            </div>
          </div>
        ))}
        {ads.length === 0 && <NoData message="Belum ada iklan aktif" />}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-6 overflow-y-auto">
           <form onSubmit={saveAd} className="bg-white p-10 rounded-[40px] shadow-2xl w-full max-w-lg space-y-6 my-auto animate-slide-up">
              <div className="flex items-center gap-4 mb-2">
                 <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center"><ImageIcon size={24}/></div>
                 <h3 className="text-3xl font-black">Detail Promosi</h3>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest ml-1">Banner Iklan (Responsive)</label>
                <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shadow-inner group">
                   {previewImage ? (
                     <img src={previewImage} className="w-full h-full object-cover" />
                   ) : (
                     <div className="flex flex-col items-center gap-3 text-slate-300">
                        <Camera size={48} />
                        <span className="font-bold">Unggah Gambar Banner</span>
                     </div>
                   )}
                   <label className="absolute inset-0 cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 text-white transition-opacity font-black">
                      Ganti Foto
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                   </label>
                </div>
              </div>

              <Input label="Judul Menarik" name="title" defaultValue={editing.title} required />
              <Input label="Target Tautan" name="link" defaultValue={editing.link} placeholder="https://..." />
              
              <div className="flex gap-4 pt-6">
                 <button type="button" onClick={() => { setEditing(null); setPreviewImage(null); }} className="flex-1 bg-slate-100 text-slate-600 py-5 rounded-[22px] font-black hover:bg-slate-200 transition-all">Batal</button>
                 <button type="submit" className="flex-1 bg-emerald-600 text-white py-5 rounded-[22px] font-black shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all">Simpan Iklan</button>
              </div>
           </form>
        </div>
      )}
    </div>
  );
}

function MarketView({ products, user, onRedeem }: any) {
  return (
    <div className="space-y-10 animate-fade-in">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Pasar Sembako 🛒</h2>
          <p className="text-slate-500 font-medium">Tukarkan koin digital Anda dengan barang kebutuhan pokok.</p>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo Koin</p>
           <p className="text-3xl font-black text-amber-500">{user.coins}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {products.map((p: any) => (
          <div key={p.id} className="bg-white rounded-[40px] overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col group">
             <div className="relative h-56">
                <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute top-6 right-6">
                   <span className={`px-4 py-2 rounded-2xl text-[10px] font-black shadow-xl backdrop-blur-md uppercase tracking-widest border border-white/20 ${p.stock > 0 ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
                      {p.stock > 0 ? `STOK: ${p.stock}` : 'HABIS'}
                   </span>
                </div>
             </div>
             <div className="px-8 pb-10 flex-1 flex flex-col">
                <h4 className="text-2xl font-black text-slate-900 leading-tight mb-2 mt-6">{p.name}</h4>
                <p className="text-sm text-slate-500 font-medium flex-1 mb-8">{p.description}</p>
                <div className="flex items-center justify-between mt-auto">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Harga Tukar</p>
                      <p className="text-2xl font-black text-slate-900">{p.priceInCoins} <span className="text-sm text-amber-500">Koin</span></p>
                   </div>
                   <button 
                     disabled={p.stock <= 0 || user.coins < p.priceInCoins}
                     onClick={() => { if(confirm(`Tukar ${p.name} seharga ${p.priceInCoins} koin?`)) onRedeem(p); }}
                     className={`p-4 rounded-2xl shadow-xl transition-all duration-300 ${p.stock > 0 && user.coins >= p.priceInCoins ? 'bg-emerald-600 text-white shadow-emerald-500/20 hover:scale-110' : 'bg-slate-100 text-slate-300 grayscale'}`}
                   >
                     <ArrowRight size={24} />
                   </button>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryView({ transactions, redemptions, user, onReceipt }: any) {
  const [activeTab, setActiveTab] = useState('WASTE');
  const userWaste = transactions.filter((t:any) => t.userId === user.id);
  const userRedemptions = redemptions.filter((r:any) => r.userId === user.id);

  return (
    <div className="space-y-8 animate-fade-in">
      <h2 className="text-4xl font-black text-slate-900 tracking-tight">Riwayat Aktivitas</h2>
      
      <div className="flex p-2 bg-slate-100 rounded-[28px] max-w-sm">
         <button onClick={() => setActiveTab('WASTE')} className={`flex-1 py-4 rounded-[22px] font-black text-sm transition-all ${activeTab === 'WASTE' ? 'bg-white text-emerald-600 shadow-xl shadow-slate-900/5' : 'text-slate-500'}`}>Setor Sampah</button>
         <button onClick={() => setActiveTab('REDEMPTION')} className={`flex-1 py-4 rounded-[22px] font-black text-sm transition-all ${activeTab === 'REDEMPTION' ? 'bg-white text-amber-600 shadow-xl shadow-slate-900/5' : 'text-slate-500'}`}>Tukar Sembako</button>
      </div>

      <div className="grid gap-4">
        {activeTab === 'WASTE' ? (
          userWaste.length > 0 ? userWaste.map((t: any) => (
            <button key={t.id} onClick={() => onReceipt('WASTE', t)} className="bg-white p-6 rounded-[32px] border border-slate-50 shadow-sm flex items-center justify-between hover:shadow-xl hover:-translate-y-1 transition-all group">
               <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform"><CheckCircle size={28}/></div>
                  <div className="text-left">
                     <p className="font-black text-slate-900 text-lg">Setor {t.weightKg}kg</p>
                     <p className="text-xs font-bold text-slate-400">{new Date(t.timestamp).toLocaleString()}</p>
                     <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">
                       <MapPin size={10} /> {t.location}
                     </div>
                  </div>
               </div>
               <div className="text-right flex items-center gap-4">
                  <p className="text-2xl font-black text-emerald-600">+{t.coinsEarned}</p>
                  <ChevronRight size={20} className="text-slate-200" />
               </div>
            </button>
          )) : <NoData message="Belum ada setoran sampah" />
        ) : (
          userRedemptions.length > 0 ? userRedemptions.map((r: any) => (
            <button key={r.id} onClick={() => onReceipt('REDEMPTION', r)} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-xl hover:-translate-y-1 transition-all group">
               <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform"><ShoppingBag size={28}/></div>
                  <div className="text-left">
                     <p className="font-black text-slate-900 text-lg">{r.productName}</p>
                     <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${r.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{r.status}</span>
                  </div>
               </div>
               <div className="text-right flex items-center gap-4">
                  <p className="text-2xl font-black text-red-500">-{r.coinsSpent}</p>
                  <ChevronRight size={20} className="text-slate-200" />
               </div>
            </button>
          )) : <NoData message="Belum ada penukaran sembako" />
        )}
      </div>
    </div>
  );
}

function AdminDashboardView({ users, transactions, products, settings, setSettings }: any) {
  const stats = useMemo(() => ({
    nasabah: users.filter((u: any) => u.role === Role.USER).length,
    sampah: transactions.reduce((a: number, t: any) => a + t.weightKg, 0),
    koin: transactions.reduce((a: number, t: any) => a + t.coinsEarned, 0),
    operator: users.filter((u: any) => u.role === Role.OPERATOR && u.operatorDetails?.status === OperatorStatus.ACTIVE).length,
  }), [users, transactions]);

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Panel Admin</h2>
          <p className="text-slate-500 font-medium">Monitoring sistem ekonomi Poltekkes.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <AdminStat icon={<UserIcon/>} label="Total Nasabah" value={stats.nasabah} color="blue" />
        <AdminStat icon={<Trash2/>} label="Sampah (Kg)" value={stats.sampah.toFixed(1)} color="emerald" />
        <AdminStat icon={<TrendingUp/>} label="Koin Beredar" value={stats.koin} color="amber" />
        <AdminStat icon={<ShieldCheck/>} label="Operator Aktif" value={stats.operator} color="slate" />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-10 rounded-[40px] shadow-sm border border-slate-50 space-y-8">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner"><TrendingUp size={24}/></div>
              <h3 className="text-2xl font-black">Konversi Ekonomi</h3>
           </div>
           <div className="flex flex-col md:flex-row gap-8 items-center bg-slate-50 p-8 rounded-[32px] border border-slate-100">
              <div className="flex-1 space-y-2">
                 <p className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Koin per Kilogram</p>
                 <input type="number" value={settings.coinConversionRate} onChange={(e) => setSettings({...settings, coinConversionRate: parseInt(e.target.value) || 0})} className="w-full px-8 py-5 rounded-3xl bg-white border border-slate-200 text-4xl font-black focus:ring-4 ring-amber-100 focus:outline-none transition-all shadow-sm" />
              </div>
              <div className="flex-1 text-center bg-amber-500 p-8 rounded-3xl shadow-xl text-white">
                 <p className="text-[10px] font-black uppercase mb-2 opacity-80">Rumus</p>
                 <p className="text-4xl font-black">2 KG = {settings.coinConversionRate * 2} KOIN</p>
              </div>
           </div>
        </div>

        <div className="bg-slate-900 p-10 rounded-[40px] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/20 rounded-full -mr-20 -mt-20 blur-3xl" />
           <Package className="text-emerald-400 mb-6" size={48} />
           <h3 className="text-2xl font-black leading-tight">Gudang Sembako</h3>
           <div className="mt-8 space-y-4">
              <div className="flex justify-between text-sm">
                 <span className="text-slate-400">Barang Habis</span>
                 <span className="font-black text-red-400">{products.filter((p:any) => p.stock <= 0).length} Item</span>
              </div>
              <div className="flex justify-between text-sm">
                 <span className="text-slate-400">Total Varian</span>
                 <span className="font-black text-emerald-400">{products.length} Jenis</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function AdminStat({ icon, label, value, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-900'
  };

  return (
    <div className="bg-white p-8 rounded-[32px] border border-slate-50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
      <div className={`${colors[color]} w-14 h-14 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
        {React.cloneElement(icon, { size: 28 })}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function ManageOperatorsView({ users, setUsers }: any) {
  const pending = users.filter((u: User) => u.role === Role.OPERATOR && u.operatorDetails?.status === OperatorStatus.PENDING);

  const updateStatus = (id: string, status: OperatorStatus) => {
    setUsers(users.map((u: User) => u.id === id ? { ...u, operatorDetails: { ...u.operatorDetails!, status } } : u));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <h2 className="text-3xl font-black text-slate-900">Verifikasi Operator Baru</h2>
      <div className="grid gap-6">
        {pending.map((u: User) => (
          <div key={u.id} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
            <div className="flex justify-between items-start">
               <div>
                  <h4 className="text-2xl font-black text-slate-900">{u.fullName}</h4>
                  <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">TPST: {u.operatorDetails?.tpstLocation}</p>
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Foto KTP</p>
                <img src={u.operatorDetails?.ktpPhoto} className="w-full aspect-video object-cover rounded-[32px] border border-slate-100 shadow-inner" />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Selfie Verifikasi</p>
                <img src={u.operatorDetails?.selfiePhoto} className="w-full aspect-video object-cover rounded-[32px] border border-slate-100 shadow-inner" />
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
               <button onClick={() => updateStatus(u.id, OperatorStatus.ACTIVE)} className="flex-1 bg-emerald-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-emerald-700 transition-all">Terima Operator</button>
               <button onClick={() => updateStatus(u.id, OperatorStatus.REJECTED)} className="px-10 bg-red-50 text-red-500 py-5 rounded-2xl font-black text-lg hover:bg-red-100 transition-all">Tolak</button>
            </div>
          </div>
        ))}
        {pending.length === 0 && <NoData message="Tidak ada pengajuan operator baru" />}
      </div>
    </div>
  );
}

function ManageProductsView({ products, setProducts }: any) {
  const [editing, setEditing] = useState<any>(null);

  const saveProduct = (e: any) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const newProduct = {
      id: editing?.id || `PRD-${Date.now()}`,
      name: data.get('name') as string,
      description: data.get('description') as string,
      priceInCoins: parseInt(data.get('price') as string),
      stock: parseInt(data.get('stock') as string),
      image: `https://picsum.photos/seed/${Date.now()}/400/300`
    };
    if (editing?.id) setProducts(products.map((p: any) => p.id === editing.id ? newProduct : p));
    else setProducts([newProduct, ...products]);
    setEditing(null);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-900">Kelola Stok Sembako</h2>
        <button onClick={() => setEditing({})} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-all"><Plus size={20}/> Tambah Produk</button>
      </div>
      <div className="grid gap-4">
        {products.map((p: any) => (
          <div key={p.id} className="bg-white p-6 rounded-[32px] border border-slate-100 flex items-center justify-between hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <img src={p.image} className="w-20 h-20 rounded-2xl object-cover shadow-sm" />
              <div>
                <p className="font-black text-slate-900 text-lg">{p.name}</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{p.stock} Tersedia • {p.priceInCoins} Koin</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(p)} className="p-4 text-emerald-600 bg-emerald-50 rounded-2xl hover:bg-emerald-100 transition-colors"><Settings size={20}/></button>
              <button onClick={() => setProducts(products.filter((x:any) => x.id !== p.id))} className="p-4 text-red-500 bg-red-50 rounded-2xl hover:bg-red-100 transition-colors"><Trash size={20}/></button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 overflow-y-auto">
          <form onSubmit={saveProduct} className="bg-white p-10 rounded-[40px] w-full max-w-lg space-y-6 shadow-2xl animate-slide-up my-auto">
            <h3 className="text-2xl font-black mb-4">Detail Produk</h3>
            <Input label="Nama Produk" name="name" defaultValue={editing.name} required />
            <Input label="Deskripsi" name="description" defaultValue={editing.description} textarea required />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Harga (Koin)" name="price" type="number" defaultValue={editing.priceInCoins} required />
              <Input label="Stok" name="stock" type="number" defaultValue={editing.stock} required />
            </div>
            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 py-4 font-black bg-slate-100 text-slate-600 rounded-2xl">Batal</button>
              <button type="submit" className="flex-1 py-4 font-black bg-emerald-600 text-white rounded-2xl shadow-xl">Simpan</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ReportsView({ transactions, redemptions }: { transactions: WasteTransaction[], redemptions: RedemptionTransaction[] }) {
  const stats = useMemo(() => ({
    totalWeight: transactions.reduce((a, t) => a + t.weightKg, 0),
    totalCoinsGiven: transactions.reduce((a, t) => a + t.coinsEarned, 0),
    redemptionsCount: redemptions.filter(r => r.status === 'COMPLETED').length,
    coinsSpent: redemptions.filter(r => r.status === 'COMPLETED').reduce((a, r) => a + r.coinsSpent, 0)
  }), [transactions, redemptions]);

  return (
    <div className="space-y-10 animate-fade-in">
      <h2 className="text-4xl font-black text-slate-900 tracking-tight">Laporan & Rekapitulasi</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ReportStat label="Sampah Terkumpul" value={`${stats.totalWeight.toFixed(1)} Kg`} color="emerald" />
        <ReportStat label="Koin Terdistribusi" value={stats.totalCoinsGiven} color="amber" />
        <ReportStat label="Penukaran Selesai" value={stats.redemptionsCount} color="blue" />
        <ReportStat label="Total Koin Belanja" value={stats.coinsSpent} color="red" />
      </div>

      <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <h3 className="text-2xl font-black mb-6">Transaksi Terbaru</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nasabah</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Jenis</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nilai</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.slice(0, 15).map(t => (
                <tr key={t.id} className="text-sm font-medium">
                  <td className="py-4 font-bold text-slate-900">{t.userName}</td>
                  <td className="py-4 text-emerald-600">Setor Sampah ({t.weightKg}kg)</td>
                  <td className="py-4 font-black">+{t.coinsEarned}</td>
                  <td className="py-4 text-slate-400">{new Date(t.timestamp).toLocaleDateString()}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-300 font-black uppercase tracking-widest">Belum ada transaksi</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReportStat({ label, value, color }: any) {
  const colors: any = {
    emerald: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    blue: 'text-blue-600 bg-blue-50',
    red: 'text-red-600 bg-red-50'
  };
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-50 shadow-sm">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-3xl font-black ${colors[color].split(' ')[0]}`}>{value}</p>
    </div>
  );
}

function SettingsView({ user, onUpdate, onNavigate }: any) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ fullName: user.fullName, phone: user.phone, address: user.address });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({ ...user, ...formData });
    setEditing(false);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl mx-auto">
      <h2 className="text-4xl font-black text-slate-900 tracking-tight">Pengaturan</h2>
      
      <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-slate-100 rounded-[32px] flex items-center justify-center text-slate-400 border-4 border-white shadow-xl">
            <UserIcon size={48} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">{user.fullName}</h3>
            <p className="text-slate-500 font-medium">{user.email}</p>
            <span className="mt-2 inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-widest">{user.role}</span>
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-4 pt-4 border-t border-slate-50">
            <Input label="Nama Lengkap" value={formData.fullName} onChange={(e: any) => setFormData({...formData, fullName: e.target.value})} />
            <Input label="WhatsApp" value={formData.phone} onChange={(e: any) => setFormData({...formData, phone: e.target.value})} />
            <Input label="Alamat" textarea value={formData.address} onChange={(e: any) => setFormData({...formData, address: e.target.value})} />
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setEditing(false)} className="flex-1 bg-slate-50 text-slate-600 py-4 rounded-2xl font-black">Batal</button>
              <button type="submit" className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-xl">Simpan</button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 pt-4 border-t border-slate-50">
            <SettingsRow label="WhatsApp" value={user.phone} />
            <SettingsRow label="Alamat" value={user.address} />
            <button onClick={() => setEditing(true)} className="w-full bg-slate-50 text-slate-900 py-4 rounded-2xl font-black hover:bg-slate-100 transition-all">Edit Profil</button>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        <button onClick={() => onNavigate('changePassword')} className="w-full bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-all group">
          <div className="flex items-center gap-4 text-slate-900 font-black">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><Settings size={20}/></div>
            Ganti Password
          </div>
          <ChevronRight size={20} className="text-slate-300" />
        </button>

        {user.role === Role.USER && !user.operatorDetails && (
          <button onClick={() => onNavigate('operatorRegistration')} className="w-full bg-emerald-600 p-6 rounded-3xl text-white flex items-center justify-between hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition-all group">
            <div className="flex items-center gap-4 font-black">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><ShieldCheck size={20}/></div>
              Daftar Jadi Operator
            </div>
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

function SettingsRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">{label}</span>
      <span className="text-slate-900 font-bold">{value}</span>
    </div>
  );
}

function OperatorRegisterView({ user, onUpdate, onBack }: any) {
  const [ktp, setKtp] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleFile = (e: any, set: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => set(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const submit = (e: any) => {
    e.preventDefault();
    if (!ktp || !selfie || !location) return;
    const updatedUser = {
      ...user,
      operatorDetails: {
        ktpPhoto: ktp,
        selfiePhoto: selfie,
        status: OperatorStatus.PENDING,
        tpstLocation: location,
        phoneNumber: phoneNumber
      }
    };
    onUpdate(updatedUser);
    onBack();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-bold hover:text-slate-600 transition-all"><ArrowRight className="rotate-180" size={20}/> Kembali</button>
      <h2 className="text-3xl font-black text-slate-900">Daftar Operator TPST</h2>
      <form onSubmit={submit} className="bg-white p-10 rounded-[40px] shadow-xl border border-slate-100 space-y-8">
        <Input label="Nomor HP WhatsApp" value={phoneNumber} onChange={(e: any) => setPhoneNumber(e.target.value)} required />
        <Input label="Lokasi TPST" value={location} onChange={(e: any) => setLocation(e.target.value)} placeholder="Contoh: TPST Desa Maju Jaya" required />
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
             <label className="block text-sm font-bold text-slate-700">Upload KTP</label>
             {ktp ? <img src={ktp} className="w-full h-48 object-cover rounded-3xl" /> : (
               <label className="w-full h-48 border-4 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 transition-all">
                  <Camera className="text-slate-200" size={48} />
                  <input type="file" className="hidden" onChange={(e) => handleFile(e, setKtp)} />
               </label>
             )}
          </div>
          <div className="space-y-4">
             <label className="block text-sm font-bold text-slate-700">Upload Selfie (Liveness)</label>
             {selfie ? <img src={selfie} className="w-full h-48 object-cover rounded-3xl" /> : (
               <label className="w-full h-48 border-4 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 transition-all">
                  <Camera className="text-slate-200" size={48} />
                  <input type="file" className="hidden" onChange={(e) => handleFile(e, setSelfie)} />
               </label>
             )}
          </div>
        </div>
        <button type="submit" className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-black text-xl hover:bg-emerald-700 shadow-xl">Kirim Pengajuan</button>
      </form>
    </div>
  );
}

function ReceiptModal({ receipt, onClose }: any) {
  const { type, data } = receipt;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-slide-up">
        <div className="bg-emerald-600 p-8 text-white text-center relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition-colors"><XCircle size={24}/></button>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30"><FileText size={32}/></div>
          <h3 className="text-2xl font-black">Struk Digital</h3>
          <p className="text-white/70 font-medium text-sm mt-1 uppercase tracking-widest">{data.id}</p>
        </div>
        <div className="p-10 space-y-6">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 font-bold uppercase tracking-wider">Waktu</span>
            <span className="text-slate-900 font-black">{new Date(data.timestamp).toLocaleString()}</span>
          </div>
          <div className="border-t border-dashed border-slate-200 pt-6 space-y-4">
             {type === 'WASTE' ? (
               <>
                 <ReceiptRow label="Nasabah" value={data.userName} />
                 <ReceiptRow label="Berat Sampah" value={`${data.weightKg} KG`} />
                 <ReceiptRow label="Koin Didapat" value={`+${data.coinsEarned} KOIN`} highlight />
                 <ReceiptRow label="Lokasi" value={data.location} />
                 <div className="grid grid-cols-2 gap-3 mt-6">
                    <div className="space-y-1">
                       <p className="text-[8px] font-black uppercase text-slate-400">Timbangan</p>
                       <img src={data.scalePhoto} className="h-24 w-full object-cover rounded-xl border border-slate-100 shadow-sm" />
                    </div>
                    <div className="space-y-1">
                       <p className="text-[8px] font-black uppercase text-slate-400">Selfie</p>
                       <img src={data.verificationPhoto} className="h-24 w-full object-cover rounded-xl border border-slate-100 shadow-sm" />
                    </div>
                 </div>
               </>
             ) : (
               <>
                 <ReceiptRow label="Produk" value={data.productName} />
                 <ReceiptRow label="Koin Terpotong" value={`-${data.coinsSpent} KOIN`} highlight color="text-red-500" />
                 <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center">
                    <QrCode size={120} className="text-slate-900" />
                    <p className="text-[10px] font-black text-slate-400 mt-4 uppercase tracking-[0.4em]">POLTEKKES VERIFIED</p>
                 </div>
               </>
             )}
          </div>
          <button onClick={onClose} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg hover:bg-slate-800 transition-all mt-4">Tutup Struk</button>
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value, highlight, color }: any) {
  return (
    <div className="flex justify-between items-center">
       <span className="text-slate-400 font-medium">{label}</span>
       <span className={`${highlight ? 'text-2xl font-black' : 'text-slate-900 font-bold'} ${color || 'text-emerald-600'} text-right`}>{value}</span>
    </div>
  );
}

function NoData({ message }: any) {
  return (
    <div className="text-center py-24 opacity-30 grayscale space-y-4">
       <RefreshCw size={64} className="mx-auto animate-spin-slow" />
       <p className="text-xl font-black text-slate-500 uppercase tracking-[0.2em]">{message}</p>
    </div>
  );
}

// --- UTILS ---
const HomeActionCardStyle = `
  @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slide-up { from { opacity: 0; transform: translateY(100px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  @keyframes scan-line { 0% { top: 0%; } 100% { top: 100%; } }
  @keyframes bounce-in { 0% { opacity: 0; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
  @keyframes confetti-float { 
    0% { transform: translateY(0) rotate(0deg); opacity: 1; } 
    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } 
  }
  .animate-fade-in { animation: fade-in 0.6s ease-out forwards; }
  .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .animate-shake { animation: shake 0.3s ease-in-out; }
  .animate-spin-slow { animation: spin 4s linear infinite; }
  .animate-scan-line { animation: scan-line 2s linear infinite; }
  .animate-bounce-in { animation: bounce-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
  .animate-confetti-float { animation: confetti-float linear infinite; }
  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = HomeActionCardStyle;
  document.head.appendChild(style);
}
