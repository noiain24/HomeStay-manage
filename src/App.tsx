/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Calendar, 
  Bed, 
  Tag, 
  Plus, 
  TrendingUp, 
  Users, 
  DollarSign,
  ChevronRight,
  Menu,
  X,
  Loader2,
  Printer,
  FileText,
  Receipt,
  Settings,
  Copy,
  LogOut,
  LogIn,
  User as UserIcon,
  ShieldCheck,
  AlertCircle,
  Database,
  RefreshCw,
  Save,
  Mail,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval, 
  parseISO, 
  startOfDay, 
  endOfDay, 
  startOfYear, 
  endOfYear,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  addDays
} from 'date-fns';
import { th } from 'date-fns/locale';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc,
  getDocs,
  getDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';

// --- Types ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Booking {
  id?: string;
  ownerId?: string;
  status: string;
  bookingDate: string;
  guestName: string;
  phone: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  amount: number;
  roomStatus: string;
  slip: string;
  note: string;
  source: string;
  createdAt?: number;
  promoCode?: string;
  discountApplied?: number;
  originalAmount?: number;
}

interface Promo {
  id?: string;
  name: string;
  code: string;
  discount: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface Room {
  id: string;
  roomId: string; // Business ID from Sheets (e.g., R01)
  name: string;
  capacity: string;
  price: number;
  status: string;
  imageUrl: string;
  description: string;
  amenities: string;
}

// --- Components ---

const LoginScreen = ({ 
  onGoogleLogin, 
  onEmailLogin, 
  onEmailSignUp,
  homestayName = 'Loei'
}: { 
  onGoogleLogin: () => void,
  onEmailLogin: (e: string, p: string) => Promise<void>,
  onEmailSignUp: (e: string, p: string) => Promise<void>,
  homestayName?: string
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        await onEmailSignUp(email, password);
      } else {
        await onEmailLogin(email, password);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let message = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      }
      if (err.code === 'auth/email-already-in-use') message = 'อีเมลนี้ถูกใช้งานแล้ว';
      if (err.code === 'auth/weak-password') message = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
      if (err.code === 'auth/invalid-email') message = 'รูปแบบอีเมลไม่ถูกต้อง';
      if (err.code === 'auth/operation-not-allowed') message = 'ระบบยังไม่เปิดใช้งานการเข้าสู่ระบบด้วยอีเมล';
      if (err.code === 'auth/too-many-requests') message = 'ลองใหม่อีกครั้งในภายหลัง (ถูกระงับชั่วคราว)';
      if (err.code === 'auth/user-disabled') message = 'บัญชีนี้ถูกระงับการใช้งาน';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-luxury-cream overflow-hidden relative p-4">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-luxury-gold blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-mountain-forest blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: [0.21, 0.45, 0.32, 0.9] }}
        className="luxury-card p-8 md:p-12 max-w-md w-full flex flex-col items-center gap-6 relative z-10"
      >
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-1">{homestayName} Homestay</h1>
          <p className="text-sm uppercase tracking-widest text-luxury-stone font-medium">ระบบจัดการที่พัก</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-luxury-stone font-bold">อีเมล</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-luxury-stone" />
              <input 
                type="email" 
                required
                className="luxury-input pl-12" 
                placeholder="example@resort.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-luxury-stone font-bold">รหัสผ่าน</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-luxury-stone" />
              <input 
                type={showPassword ? "text" : "password"} 
                required
                className="luxury-input pl-12 pr-12" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-luxury-stone hover:text-luxury-ink"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-[10px] uppercase tracking-widest font-bold text-center">{error}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-luxury-ink text-white font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:bg-mountain-forest transition-all duration-500 shadow-xl disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSignUp ? 'สร้างบัญชี' : 'เข้าสู่ระบบ')}
          </button>
        </form>

        <div className="w-full flex items-center gap-4">
          <div className="flex-1 h-[1px] bg-luxury-stone/20" />
          <span className="text-[10px] text-luxury-stone uppercase tracking-widest">หรือ</span>
          <div className="flex-1 h-[1px] bg-luxury-stone/20" />
        </div>

        <button 
          type="button"
          onClick={onGoogleLogin}
          className="w-full py-4 border border-luxury-ink/10 text-luxury-ink font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:bg-luxury-cream transition-all duration-500 group"
        >
          <LogIn className="w-4 h-4 group-hover:scale-110 transition-transform" />
          เข้าสู่ระบบด้วย Google
        </button>

        <button 
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError('');
          }}
          className="text-[10px] uppercase tracking-widest text-luxury-stone hover:text-luxury-ink transition-colors font-bold"
        >
          {isSignUp ? 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สร้างบัญชีใหม่'}
        </button>
      </motion.div>
    </div>
  );
};

const LuxuryCard = ({ title, value, icon: Icon, trend, delay = 0 }: { title: string, value: string, icon: any, trend?: string, delay?: number }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.8, delay, ease: [0.21, 0.45, 0.32, 0.9] }}
    className="luxury-card p-8 flex flex-col gap-6"
  >
    <div className="flex justify-between items-start">
      <div className="p-3 bg-luxury-cream rounded-full">
        <Icon className="w-6 h-6 text-luxury-ink" />
      </div>
      {trend && (
        <span className="text-xs font-bold tracking-widest text-luxury-gold uppercase bg-luxury-gold/5 px-3 py-1">
          {trend}
        </span>
      )}
    </div>
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-luxury-stone font-semibold mb-2">{title}</p>
      <p className="text-4xl font-serif leading-none">{value}</p>
    </div>
  </motion.div>
);

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [data, setData] = useState<{ 
    bookings: Booking[], 
    promos: Promo[], 
    rooms: Room[], 
    settings: Record<string, string>,
    spreadsheetId?: string,
    serviceAccountEmail?: string,
    actualSheetNames?: Record<string, string>
  }>({ 
    bookings: [], 
    promos: [], 
    rooms: [], 
    settings: {
      'Resort Name': 'เดอะ แซงชัวรี เมาเท่น',
      'Subtitle': 'นิยามใหม่แห่งการพักผ่อนท่ามกลางขุนเขา'
    },
    actualSheetNames: {}
  });
  const [loading, setLoading] = useState(true);
  const [bookingForm, setBookingForm] = useState({
    guestName: '',
    phone: '',
    roomType: '',
    checkIn: format(new Date(), 'yyyy-MM-dd'),
    checkOut: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    amount: '',
    promoCode: '',
    discountApplied: 0,
    originalAmount: 0
  });
  const [submitting, setSubmitting] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomForm, setRoomForm] = useState({
    name: '',
    capacity: '',
    price: '',
    status: '',
    imageUrl: '',
    description: '',
    amenities: ''
  });
  const [promoForm, setPromoForm] = useState({
    name: '',
    code: '',
    discount: '',
    startDate: '',
    endDate: '',
    status: 'Active'
  });
  const [showPromoForm, setShowPromoForm] = useState(false);

  useEffect(() => {
    const testConnection = async () => {
      try {
        const { getDocFromServer } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        fetchFirestoreData(currentUser.uid);
      } else {
        fetchData(); // Public view or fallback
      }
    });
    return () => unsubscribe();
  }, []);

  const [initialSyncDone, setInitialSyncDone] = useState(false);

  useEffect(() => {
    if (user && !initialSyncDone) {
      syncFromSheets(true);
      setInitialSyncDone(true);
    }
  }, [user, initialSyncDone]);

  const fetchFirestoreData = (uid: string) => {
    setLoading(true);
    
    // Real-time listeners for Firestore
    const bookingsQuery = query(collection(db, 'bookings'), where('ownerId', '==', uid));
    const roomsQuery = query(collection(db, 'rooms'), where('ownerId', '==', uid));
    const promosQuery = query(collection(db, 'promos'), where('ownerId', '==', uid));
    const settingsQuery = query(collection(db, 'settings'), where('ownerId', '==', uid));

    const unsubBookings = onSnapshot(bookingsQuery, (snapshot) => {
      const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
      setData(prev => ({ ...prev, bookings }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bookings');
    });

    const unsubRooms = onSnapshot(roomsQuery, (snapshot) => {
      const rooms = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          ...data, 
          id: doc.id, 
          roomId: data.roomId || data.id || doc.id 
        } as Room;
      });
      if (rooms.length > 0) setData(prev => ({ ...prev, rooms }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'rooms');
    });

    const unsubPromos = onSnapshot(promosQuery, (snapshot) => {
      const promos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Promo));
      if (promos.length > 0) setData(prev => ({ ...prev, promos }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'promos');
    });

    const unsubSettings = onSnapshot(settingsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const settings = snapshot.docs[0].data() as Record<string, string>;
        setData(prev => ({ ...prev, settings }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings');
    });

    setLoading(false);
    return () => {
      unsubBookings();
      unsubRooms();
      unsubPromos();
      unsubSettings();
    };
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleEmailLogin = async (email: string, p: string) => {
    await signInWithEmailAndPassword(auth, email, p);
  };

  const handleEmailSignUp = async (email: string, p: string) => {
    await createUserWithEmailAndPassword(auth, email, p);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setData(prev => ({ ...prev, bookings: [] })); // Clear private data
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const seedInitialData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      // Sample Rooms
      const sampleRooms = [
        {
          ownerId: user.uid,
          id: 'R101',
          name: 'Mountain View Suite',
          description: 'ห้องพักสุดหรูพร้อมวิวภูเขาแบบพาโนรามา',
          amenities: 'WiFi, Air Con, King Bed, Bathtub',
          price: 3500,
          status: 'Available',
          imageUrl: 'https://picsum.photos/seed/mountain/800/600',
          capacity: '2 ท่าน'
        },
        {
          ownerId: user.uid,
          id: 'R102',
          name: 'Forest Cabin',
          description: 'บ้านพักส่วนตัวท่ามกลางป่าสน',
          amenities: 'WiFi, Fan, Queen Bed, Balcony',
          price: 2200,
          status: 'Available',
          imageUrl: 'https://picsum.photos/seed/forest/800/600',
          capacity: '2 ท่าน'
        }
      ];

      sampleRooms.forEach(room => {
        const docRef = doc(collection(db, 'rooms'));
        batch.set(docRef, room);
      });

      // Initial Settings
      const settingsRef = doc(collection(db, 'settings'));
      batch.set(settingsRef, {
        ownerId: user.uid,
        'Homestay_Name': 'เดอะ แซงชัวรี เมาเท่น',
        'Homestay_Suffix': 'Management System',
        'Hero_Slogan_Top': 'นิยามใหม่แห่งการพักผ่อนท่ามกลางขุนเขา',
        'Hero_Description': 'เริ่มต้นจัดการที่พักของคุณด้วยระบบที่ทันสมัยและปลอดภัย',
        'Contact_Phone': '081-234-5678',
        'Contact_Email': user.email || '',
        'Contact_Line_ID': '@thesanctuary',
        'Contact_Facebook_URL': 'https://facebook.com/thesanctuary',
        'Contact_Address': '123 หมู่ 1 ต.เชียงคาน อ.เชียงคาน จ.เลย',
        'Bank_Name': 'กสิกรไทย',
        'Bank_Account_No': '123-4-56789-0',
        'Bank_Account_Name': 'เดอะ แซงชัวรี เมาเท่น',
        'PromptPay_ID': '0812345678',
        themePreset: 'luxury-gold',
        fontStyle: 'serif'
      });

      await batch.commit();
      alert('สร้างข้อมูลเริ่มต้นสำเร็จ!');
    } catch (err) {
      console.error("Seed failed:", err);
      alert('เกิดข้อผิดพลาดในการสร้างข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const syncFromSheets = async (silent = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Failed to fetch from Sheets');
      const json = await res.json();
      
      // 1. Clear existing data for this user to prevent duplicates
      const clearCollection = async (colName: string) => {
        const q = query(collection(db, colName), where('ownerId', '==', user.uid));
        let snap;
        try {
          snap = await getDocs(q);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, colName);
          return;
        }
        if (snap.empty) return;
        
        // Delete in batches of 500 (Firestore limit)
        let batch = writeBatch(db);
        let count = 0;
        for (const d of snap.docs) {
          batch.delete(d.ref);
          count++;
          if (count === 500) {
            try {
              await batch.commit();
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, 'batch_clear');
            }
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          try {
            await batch.commit();
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'batch_clear_final');
          }
        }
      };

      await clearCollection('bookings');
      await clearCollection('rooms');
      await clearCollection('promos');
      
      const batch = writeBatch(db);
      
      // Sync Bookings
      if (json.bookings && Array.isArray(json.bookings)) {
        const now = Date.now();
        json.bookings.slice(1).forEach((row: any, index: number) => {
          // Create a deterministic ID based on guest name, check-in, and room type
          const guestName = (row[2] || '').toString().trim();
          const checkIn = (row[5] || '').toString().trim();
          const roomType = (row[4] || '').toString().trim();
          
          if (!guestName) return; // Skip empty rows

          const bookingId = btoa(unescape(encodeURIComponent(`${guestName}-${checkIn}-${roomType}`)))
            .replace(/[/+=]/g, '')
            .substring(0, 50);
            
          const docRef = doc(db, 'bookings', `${user.uid}_${bookingId}`);
          batch.set(docRef, {
            ownerId: user.uid,
            status: row[0] || '',
            bookingDate: row[1] || '',
            guestName: guestName,
            phone: row[3] || '',
            roomType: roomType,
            checkIn: checkIn,
            checkOut: row[6] || '',
            amount: parseFloat(row[7]?.toString().replace(/[^0-9.]/g, '')) || 0,
            roomStatus: row[8] || '',
            slip: row[9] || '',
            note: row[10] || '',
            source: row[11] || '',
            createdAt: now + index,
            promoCode: row[14] || '',
            discountApplied: parseFloat(row[15]) || 0,
            originalAmount: parseFloat(row[16]) || parseFloat(row[7]) || 0
          });
        });
      }

      // Sync Rooms
      if (json.rooms && Array.isArray(json.rooms)) {
        json.rooms.slice(1).forEach((row: any) => {
          const roomId = (row[0] || `R${Math.floor(Math.random() * 1000)}`).toString().trim();
          const docRef = doc(db, 'rooms', `${user.uid}_${roomId}`);
          batch.set(docRef, {
            ownerId: user.uid,
            roomId: roomId, // Store as roomId
            name: row[1] || '',
            description: row[2] || '',
            amenities: row[3] || '',
            price: parseFloat(row[4]?.toString().replace(/[^0-9.]/g, '')) || 0,
            status: row[5] || '',
            imageUrl: getImageUrl(row[6]),
            capacity: row[7] || '',
          });
        });
      }

      // Sync Promos
      if (json.promos && Array.isArray(json.promos)) {
        json.promos.slice(1).forEach((row: any) => {
          const promoName = (row[0] || '').toString().trim();
          if (!promoName) return;
          
          const promoId = btoa(unescape(encodeURIComponent(promoName))).replace(/[/+=]/g, '');
          const docRef = doc(db, 'promos', `${user.uid}_${promoId}`);
          batch.set(docRef, {
            ownerId: user.uid,
            name: promoName,
            discount: row[1] || '',
            code: row[2] || '',
            startDate: row[3] || '',
            endDate: row[4] || '',
            status: row[5] || '',
          });
        });
      }

      // Sync Settings (Horizontal Layout)
      if (json.settings && Array.isArray(json.settings) && json.settings.length >= 2) {
        const headers = json.settings[0];
        const values = json.settings[1];
        const settings: Record<string, any> = { ownerId: user.uid };
        
        headers.forEach((header: string, index: number) => {
          if (header && values[index] !== undefined) {
            settings[header] = values[index];
          }
        });

        const docRef = doc(db, 'settings', user.uid);
        batch.set(docRef, settings);
      }

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'sync_batch_commit');
      }
    } catch (err) {
      console.error("Sync failed:", err);
      if (!silent) {
        if (err instanceof Error && err.message.includes('permission')) {
          alert('เกิดข้อผิดพลาด: สิทธิ์ในการเข้าถึง Firestore ไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ');
        } else {
          alert('เกิดข้อผิดพลาดในการนำเข้าข้อมูล: กรุณาตรวจสอบการตั้งค่า Google Sheets');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const settingsRef = doc(db, 'settings', user.uid);
      const settingsToSave = {
        ...data.settings,
        ownerId: user.uid
      };
      
      // 1. Save to Firebase
      try {
        await setDoc(settingsRef, settingsToSave);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'settings');
      }

      // 2. Sync to Google Sheets
      try {
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data.settings)
        });
      } catch (sheetErr) {
        console.error("Failed to sync settings to Sheets:", sheetErr);
      }

      alert('บันทึกการตั้งค่าสำเร็จ!');
    } catch (err) {
      console.error("Settings update failed:", err);
      alert('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/data');
      const json = await res.json();
      
      // Transform raw sheets data with safety checks
      const bookings = (json.bookings && Array.isArray(json.bookings) && json.bookings.length > 0) 
        ? json.bookings.slice(1).map((row: any, index: number) => ({
            status: row[0] || '',
            bookingDate: row[1] || '',
            guestName: row[2] || '',
            phone: row[3] || '',
            roomType: row[4] || '',
            checkIn: row[5] || '',
            checkOut: row[6] || '',
            amount: parseFloat(row[7]) || 0,
            roomStatus: row[8] || '',
            slip: row[9] || '',
            note: row[10] || '',
            source: row[11] || '',
            createdAt: Date.now() + index,
            promoCode: row[14] || '',
            discountApplied: parseFloat(row[15]) || 0,
            originalAmount: parseFloat(row[16]) || parseFloat(row[7]) || 0
          }))
        : [];

      const promos = (json.promos && Array.isArray(json.promos) && json.promos.length > 0)
        ? json.promos.slice(1).map((row: any) => ({
            name: row[0] || '',
            discount: row[1] || '',
            code: row[2] || '',
            startDate: row[3] || '',
            endDate: row[4] || '',
            status: row[5] || '',
          }))
        : [];

      const rooms = (json.rooms && Array.isArray(json.rooms) && json.rooms.length > 0)
        ? json.rooms.slice(1).map((row: any) => ({
            id: row[0] || '',
            roomId: row[0] || '',
            name: row[1] || '',
            description: row[2] || '',
            amenities: row[3] || '',
            price: parseFloat(row[4]?.toString().replace(/[^0-9.]/g, '')) || 0,
            status: row[5] || '',
            imageUrl: row[6] || 'https://picsum.photos/seed/room/800/600',
            capacity: row[7] || '',
          }))
        : [];

      const settings: Record<string, string> = {};
      if (json.settings && Array.isArray(json.settings) && json.settings.length >= 2) {
        const headers = json.settings[0];
        const values = json.settings[1];
        headers.forEach((header: string, index: number) => {
          if (header && values[index] !== undefined) {
            settings[header] = values[index];
          }
        });
      }

      setData({ bookings, promos, rooms, settings: { ...data.settings, ...settings } });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to handle Google Drive image links
  const getImageUrl = (url: string) => {
    if (!url || typeof url !== 'string') return 'https://picsum.photos/seed/room/800/600';
    const trimmedUrl = url.trim();
    if (trimmedUrl.includes('google.com')) {
      // Handle /file/d/.../view or /open?id=... or /uc?id=... formats
      const fileId = trimmedUrl.match(/\/d\/([^/]+)/)?.[1] || trimmedUrl.match(/id=([^&]+)/)?.[1];
      if (fileId) {
        // Using lh3.googleusercontent.com/d/ID is more reliable for direct embedding
        return `https://lh3.googleusercontent.com/d/${fileId}`;
      }
    }
    return trimmedUrl;
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('กรุณาเข้าสู่ระบบก่อนดำเนินการ');
      return;
    }
    setSubmitting(true);
    try {
      const newBooking: Omit<Booking, 'id'> = {
        ownerId: user.uid,
        status: 'โอนแล้ว',
        bookingDate: new Date().toISOString().split('T')[0],
        guestName: bookingForm.guestName,
        phone: bookingForm.phone,
        roomType: bookingForm.roomType,
        checkIn: bookingForm.checkIn,
        checkOut: bookingForm.checkOut,
        amount: parseFloat(bookingForm.amount) || 0,
        roomStatus: 'จองแล้ว',
        slip: '',
        note: 'On-site booking',
        source: 'Web Dashboard',
        createdAt: Date.now(),
        promoCode: bookingForm.promoCode,
        discountApplied: bookingForm.discountApplied,
        originalAmount: bookingForm.originalAmount
      };

      // 1. Save to Firestore (Primary)
      try {
        await addDoc(collection(db, 'bookings'), newBooking);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'bookings');
      }

      // 2. Sync to Google Sheets (Secondary/Backup)
      try {
        await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingForm)
        });
      } catch (sheetErr) {
        console.error("Failed to sync to Sheets:", sheetErr);
        // We don't alert here because Firestore succeeded
      }

      setBookingForm({ 
        guestName: '', 
        phone: '', 
        roomType: '', 
        checkIn: format(new Date(), 'yyyy-MM-dd'), 
        checkOut: format(addDays(new Date(), 1), 'yyyy-MM-dd'), 
        amount: '',
        promoCode: '',
        discountApplied: 0,
        originalAmount: 0
      });
      setActiveTab('calendar');
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoomUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom || !user) return;
    setSubmitting(true);
    try {
      const updatedRoom = {
        ...roomForm,
        price: parseFloat(roomForm.price) || 0,
        ownerId: user.uid,
        roomId: editingRoom.roomId || editingRoom.id // Preserve or set business ID
      };

      // 1. Save to Firestore
      let finalId = editingRoom.id;
      try {
        if (editingRoom.id) {
          await updateDoc(doc(db, 'rooms', editingRoom.id), updatedRoom);
        } else {
          const docRef = await addDoc(collection(db, 'rooms'), updatedRoom);
          finalId = docRef.id;
        }
      } catch (error) {
        handleFirestoreError(error, editingRoom.id ? OperationType.UPDATE : OperationType.CREATE, 'rooms');
      }

      // 2. Sync to Google Sheets
      try {
        await fetch(`/api/rooms/${editingRoom.roomId ? editingRoom.roomId : 'new'}`, {
          method: editingRoom.roomId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...roomForm, id: finalId, roomId: editingRoom.roomId || finalId })
        });
      } catch (sheetErr) {
        console.error("Failed to sync to Sheets:", sheetErr);
      }

      setEditingRoom(null);
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลห้องพัก');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const promoId = btoa(unescape(encodeURIComponent(promoForm.name))).replace(/[/+=]/g, '');
      const docRef = doc(db, 'promos', `${user.uid}_${promoId}`);
      try {
        await setDoc(docRef, {
          ownerId: user.uid,
          ...promoForm
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'promos');
      }

      // 2. Sync to Google Sheets
      try {
        await fetch('/api/promos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(promoForm)
        });
      } catch (sheetErr) {
        console.error("Failed to sync promo to Sheets:", sheetErr);
      }

      alert('สร้างโปรโมชั่นสำเร็จ!');
      setPromoForm({ name: '', code: '', discount: '', startDate: '', endDate: '', status: 'Active' });
      setShowPromoForm(false);
    } catch (err) {
      console.error("Promo creation failed:", err);
      alert('เกิดข้อผิดพลาดในการสร้างโปรโมชั่น');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyPromo = () => {
    const promo = data.promos.find(p => p.code.toUpperCase() === bookingForm.promoCode.toUpperCase() && p.status === 'Active');
    if (!promo) {
      alert('ไม่พบโค้ดโปรโมชั่นนี้ หรือโปรโมชั่นหมดอายุแล้ว');
      return;
    }
    
    const today = startOfDay(new Date());
    const start = startOfDay(new Date(promo.startDate));
    const end = endOfDay(new Date(promo.endDate));
    
    if (today < start || today > end) {
      alert('โปรโมชั่นนี้ยังไม่เริ่ม หรือหมดอายุแล้ว');
      return;
    }

    const currentAmount = parseFloat(bookingForm.amount) || 0;
    if (currentAmount <= 0) {
      alert('กรุณาเลือกห้องพักก่อนใช้โค้ด');
      return;
    }

    let discount = 0;
    if (promo.discount.includes('%')) {
      const percent = parseFloat(promo.discount.replace('%', '')) || 0;
      discount = (currentAmount * percent) / 100;
    } else {
      discount = parseFloat(promo.discount.replace(/[^0-9.]/g, '')) || 0;
    }

    const newAmount = Math.max(0, currentAmount - discount);
    setBookingForm({
      ...bookingForm,
      amount: newAmount.toString(),
      discountApplied: discount,
      originalAmount: currentAmount
    });
    alert(`ใช้โค้ดสำเร็จ! ลดไป ฿${discount.toLocaleString()}`);
  };

  const handlePrint = (booking: Booking, type: 'invoice' | 'receipt') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const title = type === 'invoice' ? 'ใบกำกับภาษี (Tax Invoice)' : 'ใบเสร็จรับเงิน (Receipt)';
    const resortName = data.settings['Homestay_Name'] || 'เดอะ แซงชัวรี เมาเท่น';
    
    const html = `
      <html>
        <head>
          <title>${title}</title>
          <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Sarabun', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #1a4731; padding-bottom: 20px; }
            .resort-name { font-size: 28px; font-weight: bold; color: #1a4731; }
            .title { font-size: 22px; margin-top: 10px; text-transform: uppercase; letter-spacing: 2px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .label { font-weight: bold; color: #1a4731; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th, td { border: 1px solid #ddd; padding: 15px; text-align: left; }
            th { background: #f4f7f5; color: #1a4731; }
            .total-section { margin-left: auto; width: 300px; }
            .total-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .grand-total { font-size: 20px; font-weight: bold; color: #1a4731; border-bottom: 2px double #1a4731; }
            .footer { margin-top: 80px; display: flex; justify-content: space-between; }
            .sig-box { text-align: center; width: 250px; }
            .sig-line { border-bottom: 1px solid #333; margin-bottom: 10px; height: 40px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="resort-name">${resortName}</div>
            <div class="title">${title}</div>
          </div>
          <div class="info-grid">
            <div>
              <p><span class="label">ชื่อลูกค้า:</span> ${booking.guestName}</p>
              <p><span class="label">เบอร์โทรศัพท์:</span> ${booking.phone}</p>
              <p><span class="label">ที่อยู่:</span> ....................................................................</p>
            </div>
            <div style="text-align: right;">
              <p><span class="label">วันที่:</span> ${format(new Date(), 'dd/MM/yyyy')}</p>
              <p><span class="label">เลขที่:</span> ${Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
              <p><span class="label">สถานะ:</span> ${booking.status === 'โอนแล้ว' ? 'ชำระเงินแล้ว' : 'รอดำเนินการ'}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>รายการ</th>
                <th>เช็คอิน</th>
                <th>เช็คเอาท์</th>
                <th style="text-align: right;">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>ค่าที่พัก: ${booking.roomType}</td>
                <td>${booking.checkIn}</td>
                <td>${booking.checkOut}</td>
                <td style="text-align: right;">฿${booking.amount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          <div class="total-section">
            <div class="total-row">
              <span>ยอดรวม</span>
              <span>฿${booking.amount.toLocaleString()}</span>
            </div>
            <div class="total-row">
              <span>ภาษีมูลค่าเพิ่ม (7%)</span>
              <span>฿${(booking.amount * 0.07).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div class="total-row grand-total">
              <span>ยอดรวมสุทธิ</span>
              <span>฿${(booking.amount * 1.07).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          </div>
          <div class="footer">
            <div class="sig-box">
              <div class="sig-line"></div>
              <p>ผู้รับเงิน / Cashier</p>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <p>ผู้จ่ายเงิน / Customer</p>
            </div>
          </div>
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Calculations
  const now = new Date();
  const dailyRevenue = data.bookings
    .filter(b => b.checkIn === format(now, 'yyyy-MM-dd'))
    .reduce((sum, b) => sum + b.amount, 0);

  const monthlyRevenue = data.bookings
    .filter(b => {
      const date = parseISO(b.checkIn);
      return isWithinInterval(date, { start: startOfMonth(now), end: endOfMonth(now) });
    })
    .reduce((sum, b) => sum + b.amount, 0);

  const yearlyRevenue = data.bookings
    .filter(b => {
      const date = parseISO(b.checkIn);
      return isWithinInterval(date, { start: startOfYear(now), end: endOfYear(now) });
    })
    .reduce((sum, b) => sum + b.amount, 0);

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = format(d, 'yyyy-MM-dd');
    const revenue = data.bookings
      .filter(b => b.checkIn === dateStr)
      .reduce((sum, b) => sum + b.amount, 0);
    return { name: format(d, 'EEE'), revenue };
  });

  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-luxury-cream">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-luxury-ink" />
          <p className="font-serif italic text-luxury-ink/60">กำลังเตรียมพื้นที่ส่วนตัวของคุณ...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen 
        onGoogleLogin={handleLogin} 
        onEmailLogin={handleEmailLogin} 
        onEmailSignUp={handleEmailSignUp} 
        homestayName={data.settings['Homestay_Name']}
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-mountain-mist relative">
      {/* Top-Left Menu Button - Persistent for all sizes */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
        className={`fixed top-4 left-4 z-[70] p-4 bg-mountain-forest text-white shadow-2xl hover:bg-mountain-gold transition-all duration-300 rounded-2xl ${isSidebarOpen ? 'lg:flex' : ''}`}
      >
        {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-luxury-ink/60 backdrop-blur-sm z-[55]"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ duration: 0.5, ease: [0.21, 0.45, 0.32, 0.9] }}
            className="fixed z-[60] h-screen w-72 bg-mountain-forest text-white flex flex-col shadow-2xl"
          >
            <div className="p-10 pt-24 flex flex-col gap-8">
              <div className="flex flex-col gap-1">
                <span className="text-4xl font-bold tracking-tight">
                  {data.settings['Homestay_Name'] || 'Loei'} Homestay
                </span>
                <span className="text-sm uppercase tracking-widest text-white/40">ระบบจัดการที่พัก</span>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-2 hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-4 lg:px-6 py-8 lg:py-12 space-y-2 lg:space-y-4">
              {[
                { id: 'dashboard', icon: LayoutDashboard, label: 'ภาพรวม' },
                { id: 'calendar', icon: Calendar, label: 'ปฏิทินการจอง' },
                { id: 'bookings', icon: Calendar, label: 'รายการจอง' },
                { id: 'rooms', icon: Bed, label: 'ห้องพัก' },
                { id: 'promos', icon: Tag, label: 'โปรโมชั่น' },
                { id: 'settings-system', icon: Settings, label: 'ตั้งค่าระบบ' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-5 px-6 py-4 lg:py-5 transition-all duration-500 group border-l-2 ${activeTab === item.id ? 'bg-mountain-mist text-mountain-forest border-mountain-gold' : 'text-white/60 hover:text-white border-transparent hover:bg-white/5'}`}
                >
                  <item.icon className={`w-5 h-5 transition-transform duration-500 ${activeTab === item.id ? 'text-mountain-gold' : 'group-hover:scale-110'}`} />
                  <span className="text-xs font-bold uppercase tracking-[0.3em]">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* User Profile & Logout */}
            <div className="p-6 border-t border-white/10 bg-black/20">
              <div className="flex items-center gap-4 mb-4">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} className="w-10 h-10 rounded-full border border-mountain-gold" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-mountain-gold flex items-center justify-center text-mountain-forest font-bold">
                    {user.displayName?.[0] || 'U'}
                  </div>
                )}
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-bold truncate">{user.displayName}</span>
                  <span className="text-[10px] text-white/40 truncate">{user.email}</span>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full py-3 border border-white/20 text-[10px] uppercase tracking-widest hover:bg-white hover:text-mountain-forest transition-all duration-300 flex items-center justify-center gap-2"
              >
                <LogOut className="w-3 h-3" />
                ออกจากระบบ
              </button>
            </div>

            <div className="p-8 lg:p-10 border-t border-white/5">
              <p className="text-[9px] uppercase tracking-[0.3em] text-white/20">© 2024 ระบบจัดการรีสอร์ทขุนเขา</p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={`flex-1 h-screen overflow-y-auto p-6 md:p-12 lg:p-20 bg-mountain-mist transition-all duration-500 ${isSidebarOpen ? 'lg:pl-12' : ''}`}>
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12 lg:mb-20">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1 }}
            className="max-w-xl pt-12 lg:pt-0"
          >
            <h1 className="text-4xl md:text-6xl lg:text-7xl mb-4 tracking-tight text-mountain-forest">
              {data.settings['Homestay_Name'] || 'เดอะ แซงชัวรี'} {data.settings['Homestay_Suffix'] || 'เมาเท่น'}
            </h1>
            <p className="text-mountain-earth italic text-lg md:text-xl font-medium">
              {data.settings['Hero_Slogan_Top'] || 'นิยามใหม่แห่งการพักผ่อนท่ามกลางขุนเขา'}
            </p>
            {data.settings['Hero_Description'] && (
              <p className="text-mountain-slate mt-4 text-sm md:text-base leading-relaxed">
                {data.settings['Hero_Description']}
              </p>
            )}
          </motion.div>
          
          <div className="flex items-center gap-4 md:gap-6">
            <button 
              onClick={() => {
                setActiveTab('new-booking');
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className="luxury-button group relative overflow-hidden flex-1 md:flex-none text-center"
            >
              <span className="relative z-10 flex items-center justify-center gap-4">
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">จองห้องพักใหม่</span>
                <span className="sm:hidden">จองใหม่</span>
              </span>
              <div className="absolute inset-0 bg-mountain-earth translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'settings-system' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-12"
            >
              <div className="flex flex-col gap-4">
                <h2 className="text-4xl font-serif italic text-mountain-forest">ตั้งค่าระบบ & การเชื่อมต่อ</h2>
                <p className="text-mountain-slate">ตรวจสอบสถานะการเชื่อมต่อกับ Google Sheets และข้อมูลที่จำเป็นสำหรับการตั้งค่า</p>
              </div>

              <div className="flex flex-col gap-12">
                <div className="luxury-card p-10 space-y-10">
                  <div className="flex items-center gap-4 border-b border-mountain-forest/5 pb-6">
                    <div className="w-12 h-12 bg-mountain-gold/10 flex items-center justify-center rounded-2xl">
                      <Settings className="w-6 h-6 text-mountain-gold" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-mountain-forest">ข้อมูลที่พัก</h3>
                      <p className="text-xs text-mountain-slate mt-1">ตั้งค่าข้อมูลพื้นฐานและการติดต่อของรีสอร์ท</p>
                    </div>
                  </div>

                  <form onSubmit={handleSettingsUpdate} className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-mountain-gold font-bold">ชื่อที่พัก (Homestay_Name)</label>
                        <input 
                          type="text" 
                          className="luxury-input" 
                          value={data.settings['Homestay_Name'] || ''}
                          onChange={e => setData({...data, settings: {...data.settings, 'Homestay_Name': e.target.value}})}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-mountain-gold font-bold">สร้อยชื่อ (Homestay_Suffix)</label>
                        <input 
                          type="text" 
                          className="luxury-input" 
                          value={data.settings['Homestay_Suffix'] || ''}
                          onChange={e => setData({...data, settings: {...data.settings, 'Homestay_Suffix': e.target.value}})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-mountain-gold font-bold">สโลแกน (Hero_Slogan_Top)</label>
                        <input 
                          type="text" 
                          className="luxury-input" 
                          value={data.settings['Hero_Slogan_Top'] || ''}
                          onChange={e => setData({...data, settings: {...data.settings, 'Hero_Slogan_Top': e.target.value}})}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-mountain-gold font-bold">คำอธิบาย (Hero_Description)</label>
                        <input 
                          type="text" 
                          className="luxury-input" 
                          value={data.settings['Hero_Description'] || ''}
                          onChange={e => setData({...data, settings: {...data.settings, 'Hero_Description': e.target.value}})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-mountain-gold font-bold">เบอร์โทรศัพท์ (Contact_Phone)</label>
                        <input 
                          type="text" 
                          className="luxury-input" 
                          value={data.settings['Contact_Phone'] || ''}
                          onChange={e => setData({...data, settings: {...data.settings, 'Contact_Phone': e.target.value}})}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-mountain-gold font-bold">อีเมล (Contact_Email)</label>
                        <input 
                          type="email" 
                          className="luxury-input" 
                          value={data.settings['Contact_Email'] || ''}
                          onChange={e => setData({...data, settings: {...data.settings, 'Contact_Email': e.target.value}})}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-mountain-gold font-bold">Line ID (Contact_Line_ID)</label>
                        <input 
                          type="text" 
                          className="luxury-input" 
                          value={data.settings['Contact_Line_ID'] || ''}
                          onChange={e => setData({...data, settings: {...data.settings, 'Contact_Line_ID': e.target.value}})}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] uppercase tracking-widest text-mountain-gold font-bold">Facebook URL (Contact_Facebook_URL)</label>
                      <input 
                        type="text" 
                        className="luxury-input" 
                        value={data.settings['Contact_Facebook_URL'] || ''}
                        onChange={e => setData({...data, settings: {...data.settings, 'Contact_Facebook_URL': e.target.value}})}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] uppercase tracking-widest text-mountain-gold font-bold">ที่อยู่ (Contact_Address)</label>
                      <textarea 
                        className="luxury-input h-32 resize-none" 
                        value={data.settings['Contact_Address'] || ''}
                        onChange={e => setData({...data, settings: {...data.settings, 'Contact_Address': e.target.value}})}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-mountain-gold font-bold">ชื่อธนาคาร (Bank_Name)</label>
                        <input 
                          type="text" 
                          className="luxury-input" 
                          value={data.settings['Bank_Name'] || ''}
                          onChange={e => setData({...data, settings: {...data.settings, 'Bank_Name': e.target.value}})}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-mountain-gold font-bold">เลขที่บัญชี (Bank_Account_No)</label>
                        <input 
                          type="text" 
                          className="luxury-input" 
                          value={data.settings['Bank_Account_No'] || ''}
                          onChange={e => setData({...data, settings: {...data.settings, 'Bank_Account_No': e.target.value}})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-mountain-gold font-bold">ชื่อบัญชี (Bank_Account_Name)</label>
                        <input 
                          type="text" 
                          className="luxury-input" 
                          value={data.settings['Bank_Account_Name'] || ''}
                          onChange={e => setData({...data, settings: {...data.settings, 'Bank_Account_Name': e.target.value}})}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-mountain-gold font-bold">PromptPay ID</label>
                        <input 
                          type="text" 
                          className="luxury-input" 
                          value={data.settings['PromptPay_ID'] || ''}
                          onChange={e => setData({...data, settings: {...data.settings, 'PromptPay_ID': e.target.value}})}
                        />
                      </div>
                    </div>

                    <div className="pt-6">
                      <button 
                        type="submit"
                        disabled={submitting}
                        className="luxury-button w-full flex items-center justify-center gap-4"
                      >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        <span>บันทึกการตั้งค่าทั้งหมด</span>
                      </button>
                    </div>
                  </form>
                </div>

                <div className="luxury-card p-10 space-y-8">
                  <div className="flex items-center gap-4 border-b border-mountain-forest/5 pb-6">
                    <div className="w-12 h-12 bg-mountain-gold/10 flex items-center justify-center rounded-2xl">
                      <Database className="w-6 h-6 text-mountain-gold" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-mountain-forest">ข้อมูลการเชื่อมต่อ Sheets</h3>
                      <p className="text-xs text-mountain-slate mt-1">รายละเอียดการเชื่อมต่อกับ Google Spreadsheet</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] uppercase tracking-widest text-mountain-gold font-bold">Spreadsheet ID</label>
                      <div className="p-4 bg-mountain-mist rounded-xl border border-mountain-forest/10 font-mono text-xs break-all">
                        {data.spreadsheetId || 'ไม่พบข้อมูล'}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] uppercase tracking-widest text-mountain-gold font-bold">Service Account Email</label>
                      <div className="p-4 bg-mountain-mist rounded-xl border border-mountain-forest/10 font-mono text-xs break-all flex items-center justify-between gap-4">
                        <span className="truncate">{data.serviceAccountEmail || 'ไม่พบข้อมูล'}</span>
                        <button 
                          onClick={() => {
                            if (data.serviceAccountEmail) {
                              navigator.clipboard.writeText(data.serviceAccountEmail);
                              alert('คัดลอกอีเมลแล้ว!');
                            }
                          }}
                          className="p-2 bg-white rounded-lg shadow-sm text-mountain-gold hover:text-mountain-forest transition-all active:scale-90"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="mt-2 text-[10px] text-mountain-slate italic leading-relaxed">
                        * ต้องแชร์ Google Sheet ให้กับอีเมลนี้และให้สิทธิ์เป็น "Editor" เพื่อให้ระบบทำงานได้
                      </p>
                    </div>
                  </div>
                </div>

                <div className="luxury-card p-10 space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-mountain-gold/10 flex items-center justify-center rounded-full">
                        <LayoutDashboard className="w-5 h-5 text-mountain-gold" />
                      </div>
                      <h3 className="text-xl font-bold text-mountain-forest">สถานะชีต (Sheet Names)</h3>
                    </div>
                    <button 
                      onClick={() => syncFromSheets(false)}
                      disabled={loading}
                      className="px-4 py-2 bg-mountain-gold text-mountain-forest text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-mountain-forest hover:text-white transition-all duration-300 flex items-center gap-2"
                    >
                      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      นำเข้าข้อมูล
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {Object.entries(data.actualSheetNames || {}).map(([key, name]) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-mountain-mist rounded-lg border border-mountain-forest/5">
                        <span className="text-xs font-bold uppercase tracking-wider text-mountain-forest/60">{key}</span>
                        <span className={`text-xs font-mono ${name ? 'text-green-600' : 'text-red-500'}`}>
                          {name ? `✓ ${name}` : '✗ ไม่พบชีต'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-20"
            >
              {data.rooms.length === 0 && !loading && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="luxury-card p-10 bg-luxury-ink text-white flex flex-col md:flex-row items-center justify-between gap-8"
                >
                  <div className="space-y-4 text-center md:text-left">
                    <h2 className="text-3xl font-serif">ยินดีต้อนรับสู่ระบบใหม่ของคุณ</h2>
                    <p className="text-sm text-white/70 max-w-xl">
                      ดูเหมือนว่าคุณยังไม่มีข้อมูลในระบบ Firebase คุณสามารถเลือกที่จะนำเข้าข้อมูลจาก Google Sheets เดิม 
                      หรือสร้างข้อมูลเริ่มต้นเพื่อทดลองใช้งานระบบได้ทันที
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={() => syncFromSheets(false)}
                      className="px-8 py-4 bg-luxury-gold text-luxury-ink font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-all duration-300"
                    >
                      นำเข้าจาก Google Sheets
                    </button>
                    <button 
                      onClick={seedInitialData}
                      className="px-8 py-4 border border-white/20 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all duration-300"
                    >
                      สร้างข้อมูลตัวอย่าง
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <LuxuryCard title="รายได้รายวัน" value={`฿${dailyRevenue.toLocaleString()}`} icon={DollarSign} trend="+12.5%" delay={0.1} />
                <LuxuryCard title="รายได้รายเดือน" value={`฿${monthlyRevenue.toLocaleString()}`} icon={TrendingUp} trend="+4.2%" delay={0.2} />
                <LuxuryCard title="ประมาณการรายปี" value={`฿${yearlyRevenue.toLocaleString()}`} icon={Users} delay={0.3} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-16">
                <div className="lg:col-span-3">
                  <div className="flex justify-between items-end mb-10">
                    <h3 className="text-3xl font-serif">ประสิทธิภาพรายได้</h3>
                    <p className="text-[10px] uppercase tracking-widest text-luxury-stone">7 วันล่าสุด</p>
                  </div>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#c5a059" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#c5a059" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8e8e8e', letterSpacing: '0.1em' }} dy={15} />
                        <YAxis hide />
                        <Tooltip 
                          cursor={{ stroke: '#c5a059', strokeWidth: 1 }}
                          contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', color: '#f5f2ed', borderRadius: '0', padding: '12px' }}
                          itemStyle={{ color: '#c5a059', fontSize: '12px', fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#c5a059" fillOpacity={1} fill="url(#colorRev)" strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-10">
                  <h3 className="text-3xl font-bold text-mountain-forest">การเข้าพักล่าสุด</h3>
                  <div className="space-y-6">
                    {data.bookings
                      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                      .slice(0, 5)
                      .map((booking, i) => (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + (i * 0.1) }}
                        key={`dash-book-${i}-${booking.guestName}`} 
                        className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group"
                      >
                        <div className="flex-1">
                          <p className="text-xl font-bold text-mountain-forest group-hover:text-mountain-gold transition-colors">{booking.guestName}</p>
                          <p className="text-sm text-mountain-slate mt-1 font-medium">
                            {booking.roomType} <span className="mx-2 text-mountain-mist">•</span> {booking.checkIn}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-xl font-bold text-mountain-forest">฿{booking.amount.toLocaleString()}</p>
                          <div className="flex items-center gap-2 justify-end mt-1">
                            <div className={`w-2 h-2 rounded-full ${booking.status === 'โอนแล้ว' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                            <span className="text-xs font-bold text-mountain-slate uppercase tracking-wider">
                              {booking.status === 'โอนแล้ว' ? 'โอนแล้ว' : 'ยกเลิกเรียบร้อย'}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'calendar' && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 xl:grid-cols-3 gap-8 lg:gap-12"
            >
              <div className="xl:col-span-2 luxury-card p-6 md:p-10">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-10">
                  <h3 className="text-2xl md:text-3xl font-serif">
                    {format(currentMonth, 'MMMM yyyy', { locale: th })}
                  </h3>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      className="p-3 hover:bg-luxury-cream transition-colors border border-luxury-ink/5"
                    >
                      <ChevronRight className="w-5 h-5 rotate-180" />
                    </button>
                    <button 
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      className="p-3 hover:bg-luxury-cream transition-colors border border-luxury-ink/5"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 mb-4">
                  {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                    <div key={day} className="text-center text-[10px] font-bold text-luxury-stone uppercase tracking-widest py-4">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-px bg-luxury-ink/5 border border-luxury-ink/5">
                  {(() => {
                    const monthStart = startOfMonth(currentMonth);
                    const monthEnd = endOfMonth(monthStart);
                    const startDate = startOfWeek(monthStart);
                    const endDate = endOfWeek(monthEnd);
                    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

                    return calendarDays.map((day, i) => {
                      const dayBookings = data.bookings.filter(b => isSameDay(parseISO(b.checkIn), day));
                      const isCurrentMonth = isSameDay(startOfMonth(day), startOfMonth(currentMonth));
                      const isSelected = isSameDay(day, selectedDate);
                      const isToday = isSameDay(day, new Date());

                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedDate(day)}
                          className={`
                            aspect-square p-1 md:p-2 flex flex-col items-center justify-between transition-all relative
                            ${isCurrentMonth ? 'bg-white' : 'bg-luxury-cream/30 text-luxury-stone/40'}
                            ${isSelected ? 'ring-1 ring-inset ring-luxury-gold z-10' : 'hover:bg-luxury-cream/50'}
                          `}
                        >
                          <span className={`
                            text-xs md:text-sm font-serif
                            ${isToday ? 'w-5 h-5 md:w-6 md:h-6 bg-luxury-ink text-luxury-cream flex items-center justify-center rounded-full' : ''}
                            ${isSelected && !isToday ? 'text-luxury-gold' : ''}
                          `}>
                            {format(day, 'd')}
                          </span>
                          
                          <div className="flex gap-0.5 md:gap-1">
                            {dayBookings.slice(0, 3).map((_, idx) => (
                              <div key={idx} className="w-1 h-1 rounded-full bg-luxury-gold"></div>
                            ))}
                            {dayBookings.length > 3 && <div className="w-1 h-1 rounded-full bg-luxury-stone"></div>}
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="space-y-8 lg:space-y-10">
                <div className="luxury-card p-6 md:p-10">
                  <h4 className="text-xs uppercase tracking-[0.25em] text-luxury-stone font-bold mb-6">
                    รายการจองวันที่ {format(selectedDate, 'd MMMM yyyy', { locale: th })}
                  </h4>
                  <div className="space-y-8">
                    {(() => {
                      const dayBookings = data.bookings.filter(b => isSameDay(parseISO(b.checkIn), selectedDate));
                      if (dayBookings.length === 0) {
                        return <p key="no-bookings" className="text-sm italic text-luxury-stone">ไม่มีรายการจองในวันนี้</p>;
                      }
                      return dayBookings.map((booking, i) => (
                        <div key={`cal-day-book-${i}-${booking.guestName}`} className="group">
                          <p className="font-serif text-lg md:text-xl group-hover:text-luxury-gold transition-colors">{booking.guestName}</p>
                          <p className="text-xs uppercase tracking-[0.2em] text-luxury-stone mt-1">{booking.roomType}</p>
                          <div className="flex items-center gap-4 mt-3">
                            <span className="text-xs font-medium">฿{booking.amount.toLocaleString()}</span>
                            <span className={`text-xs uppercase tracking-widest px-3 py-1 border ${booking.status === 'โอนแล้ว' ? 'border-green-200 text-green-600' : 'border-amber-200 text-amber-600'}`}>
                              {booking.status}
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                <div className="luxury-card p-6 md:p-10 bg-luxury-ink text-luxury-cream">
                  <h4 className="text-xs uppercase tracking-[0.25em] text-white/40 font-bold mb-4">สรุปสถานะวันนี้</h4>
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-2xl md:text-3xl font-serif">{data.bookings.filter(b => isSameDay(parseISO(b.checkIn), selectedDate)).length}</p>
                      <p className="text-xs uppercase tracking-widest text-white/40">เช็คอิน</p>
                    </div>
                    <div>
                      <p className="text-2xl md:text-3xl font-serif">{data.bookings.filter(b => isSameDay(parseISO(b.checkOut), selectedDate)).length}</p>
                      <p className="text-xs uppercase tracking-widest text-white/40">เช็คเอาท์</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'bookings' && (
            <motion.div
              key="bookings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10"
            >
              <div className="flex justify-between items-end mb-10">
                <h3 className="text-4xl font-serif">รายการจองทั้งหมด</h3>
                <p className="text-xs uppercase tracking-widest text-luxury-stone">รวม {data.bookings.length} รายการ</p>
              </div>

              <div className="luxury-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-luxury-ink/5">
                        <th className="p-6 text-xs uppercase tracking-[0.2em] text-luxury-stone font-bold">แขกผู้เข้าพัก</th>
                        <th className="p-6 text-xs uppercase tracking-[0.2em] text-luxury-stone font-bold">ประเภทห้อง</th>
                        <th className="p-6 text-xs uppercase tracking-[0.2em] text-luxury-stone font-bold">เช็คอิน - เช็คเอาท์</th>
                        <th className="p-6 text-xs uppercase tracking-[0.2em] text-luxury-stone font-bold">ยอดรวม</th>
                        <th className="p-6 text-xs uppercase tracking-[0.2em] text-luxury-stone font-bold">สถานะ</th>
                        <th className="p-6 text-xs uppercase tracking-[0.2em] text-luxury-stone font-bold text-right">พิมพ์เอกสาร</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bookings
                        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                        .map((booking, i) => {
                          const isNew = i < 5; // Mark top 5 as new
                          return (
                            <tr key={`book-row-${i}-${booking.guestName}`} className="border-b border-luxury-ink/5 hover:bg-luxury-cream/20 transition-colors group">
                              <td className="p-6">
                                <div className="flex items-center gap-3">
                                  <div>
                                    <p className="font-serif text-lg group-hover:text-luxury-gold transition-colors flex items-center gap-2">
                                      {booking.guestName}
                                      {isNew && (
                                        <span className="px-2 py-0.5 bg-mountain-gold text-mountain-forest text-[8px] font-bold uppercase tracking-widest rounded-full animate-pulse">
                                          ล่าสุด
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-xs text-luxury-stone mt-1">{booking.phone}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-6 text-sm">{booking.roomType}</td>
                              <td className="p-6 text-sm">
                                {booking.checkIn} ถึง {booking.checkOut}
                              </td>
                              <td className="p-6 font-medium">฿{booking.amount.toLocaleString()}</td>
                              <td className="p-6">
                                <span className={`text-xs uppercase tracking-widest px-4 py-1.5 border ${booking.status === 'โอนแล้ว' ? 'border-green-200 text-green-600' : 'border-amber-200 text-amber-600'}`}>
                                  {booking.status}
                                </span>
                              </td>
                              <td className="p-6 text-right">
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => handlePrint(booking, 'invoice')}
                                    className="px-3 py-1 bg-mountain-forest text-white text-[10px] font-bold uppercase tracking-widest rounded hover:bg-mountain-gold transition-colors"
                                  >
                                    ใบกำกับภาษี
                                  </button>
                                  <button 
                                    onClick={() => handlePrint(booking, 'receipt')}
                                    className="px-3 py-1 bg-mountain-earth text-white text-[10px] font-bold uppercase tracking-widest rounded hover:bg-mountain-gold transition-colors"
                                  >
                                    ใบเสร็จ
                                  </button>
                                </div>
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

          {activeTab === 'new-booking' && (
            <motion.div 
              key="new-booking"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto"
            >
            <div className="luxury-card p-12">
              <h2 className="text-4xl mb-8">จองห้องพักหน้าเคาน์เตอร์</h2>
              <form onSubmit={handleBookingSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-luxury-stone font-semibold">ชื่อแขกผู้เข้าพัก</label>
                    <input 
                      required
                      type="text" 
                      className="luxury-input" 
                      value={bookingForm.guestName}
                      onChange={e => setBookingForm({...bookingForm, guestName: e.target.value})}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-luxury-stone font-semibold">เบอร์โทรศัพท์</label>
                    <input 
                      required
                      type="tel" 
                      className="luxury-input" 
                      value={bookingForm.phone}
                      onChange={e => setBookingForm({...bookingForm, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase tracking-widest text-luxury-stone font-semibold">ประเภทห้องพัก</label>
                  <select 
                    required
                    className="luxury-input"
                    value={bookingForm.roomType}
                    onChange={e => {
                      const room = data.rooms.find(r => r.name === e.target.value);
                      setBookingForm({
                        ...bookingForm, 
                        roomType: e.target.value, 
                        amount: room ? room.price.toString() : '',
                        discountApplied: 0,
                        promoCode: ''
                      });
                    }}
                  >
                    <option value="">เลือกประเภทห้องพัก...</option>
                    {data.rooms.map((room, i) => (
                      <option key={`opt-${room.id || i}`} value={room.name}>{room.name} (฿{room.price})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-luxury-stone font-semibold">วันที่เช็คอิน</label>
                    <input 
                      required
                      type="date" 
                      className="luxury-input" 
                      value={bookingForm.checkIn}
                      onChange={e => setBookingForm({...bookingForm, checkIn: e.target.value})}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-luxury-stone font-semibold">วันที่เช็คเอาท์</label>
                    <input 
                      required
                      type="date" 
                      className="luxury-input" 
                      value={bookingForm.checkOut}
                      onChange={e => setBookingForm({...bookingForm, checkOut: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-luxury-stone font-semibold">ยอดรวมทั้งหมด (฿)</label>
                    <div className="relative">
                      <input 
                        required
                        type="number" 
                        className="luxury-input w-full" 
                        value={bookingForm.amount}
                        onChange={e => setBookingForm({...bookingForm, amount: e.target.value})}
                      />
                      {bookingForm.discountApplied > 0 && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-600 uppercase">
                          ลดไป ฿{bookingForm.discountApplied.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-luxury-stone font-semibold">โค้ดโปรโมชั่น</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        className="luxury-input flex-1" 
                        placeholder="กรอกโค้ด..."
                        value={bookingForm.promoCode}
                        onChange={e => setBookingForm({...bookingForm, promoCode: e.target.value})}
                      />
                      <button 
                        type="button"
                        onClick={handleApplyPromo}
                        className="px-4 bg-luxury-gold text-luxury-ink text-[10px] font-bold uppercase tracking-widest hover:bg-luxury-ink hover:text-white transition-all"
                      >
                        ใช้โค้ด
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-8">
                  <button 
                    disabled={submitting}
                    type="submit" 
                    className="luxury-button w-full flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ยืนยันการจอง'}
                  </button>
                </div>
              </form>
            </div>
            </motion.div>
          )}

          {activeTab === 'promos' && (
            <motion.div 
              key="promos"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-4xl font-serif text-mountain-forest">โปรโมชั่นและส่วนลด</h2>
                <button 
                  onClick={() => setShowPromoForm(!showPromoForm)}
                  className="luxury-button flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {showPromoForm ? 'ยกเลิก' : 'สร้างโปรโมชั่น'}
                </button>
              </div>

              {showPromoForm && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="luxury-card p-10 max-w-2xl mx-auto"
                >
                  <form onSubmit={handlePromoSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-luxury-stone font-semibold">ชื่อโปรโมชั่น</label>
                        <input 
                          required
                          type="text" 
                          className="luxury-input" 
                          value={promoForm.name}
                          onChange={e => setPromoForm({...promoForm, name: e.target.value})}
                          placeholder="เช่น Early Bird Discount"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-luxury-stone font-semibold">โค้ดโปรโมชั่น</label>
                        <input 
                          required
                          type="text" 
                          className="luxury-input" 
                          value={promoForm.code}
                          onChange={e => setPromoForm({...promoForm, code: e.target.value.toUpperCase()})}
                          placeholder="เช่น SUMMER10"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-luxury-stone font-semibold">ส่วนลด (เช่น 10% หรือ ฿500)</label>
                        <input 
                          required
                          type="text" 
                          className="luxury-input" 
                          value={promoForm.discount}
                          onChange={e => setPromoForm({...promoForm, discount: e.target.value})}
                          placeholder="10%"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-luxury-stone font-semibold">สถานะ</label>
                        <select 
                          className="luxury-input"
                          value={promoForm.status}
                          onChange={e => setPromoForm({...promoForm, status: e.target.value})}
                        >
                          <option value="Active">เปิดใช้งาน</option>
                          <option value="Inactive">ปิดใช้งาน</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-luxury-stone font-semibold">วันที่เริ่ม</label>
                        <input 
                          required
                          type="date" 
                          className="luxury-input" 
                          value={promoForm.startDate}
                          onChange={e => setPromoForm({...promoForm, startDate: e.target.value})}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest text-luxury-stone font-semibold">วันที่สิ้นสุด</label>
                        <input 
                          required
                          type="date" 
                          className="luxury-input" 
                          value={promoForm.endDate}
                          onChange={e => setPromoForm({...promoForm, endDate: e.target.value})}
                        />
                      </div>
                    </div>

                    <button 
                      disabled={submitting}
                      type="submit" 
                      className="luxury-button w-full flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'บันทึกโปรโมชั่น'}
                    </button>
                  </form>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {data.promos.map((promo, i) => (
                  <div key={`promo-${i}-${promo.name}`} className="luxury-card p-8 flex flex-col justify-between group">
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <span className={`text-[10px] uppercase tracking-widest px-3 py-1 rounded-full ${promo.status === 'Active' ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'}`}>
                          {promo.status === 'Active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </span>
                        <Tag className="w-5 h-5 text-mountain-gold" />
                      </div>
                      <h3 className="text-3xl mb-2 font-serif text-mountain-forest">{promo.name}</h3>
                      <p className="text-xs font-bold text-luxury-gold tracking-widest mb-4">CODE: {promo.code}</p>
                      <p className="text-4xl font-serif text-mountain-gold mb-6">{promo.discount} OFF</p>
                    </div>
                    <div className="pt-6 border-t border-mountain-mist">
                      <p className="text-[10px] uppercase tracking-widest text-mountain-slate mb-1">ระยะเวลาโปรโมชั่น</p>
                      <p className="text-sm italic text-mountain-forest">{promo.startDate} ถึง {promo.endDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'rooms' && (
            <motion.div 
              key="rooms"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-12"
            >
              {data.rooms.map((room, i) => (
                <div 
                  key={`room-${room.id || i}`} 
                  className="group cursor-pointer bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col"
                  onClick={() => {
                    setEditingRoom(room);
                    setRoomForm({
                      name: room.name,
                      capacity: room.capacity,
                      price: room.price.toString(),
                      status: room.status,
                      imageUrl: room.imageUrl,
                      description: room.description,
                      amenities: room.amenities
                    });
                  }}
                >
                  <div className="aspect-[16/10] overflow-hidden relative">
                    <img 
                      src={getImageUrl(room.imageUrl)} 
                      alt={room.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-6 right-6">
                      <span className={`px-4 py-2 rounded-full text-xs font-bold backdrop-blur-md ${room.status === 'Available' ? 'bg-green-500/20 text-green-700 border border-green-500/30' : 'bg-amber-500/20 text-amber-700 border border-amber-500/30'}`}>
                        {room.status === 'Available' ? 'ว่าง' : 'ไม่ว่าง'}
                      </span>
                    </div>
                  </div>
                  <div className="p-8 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <h3 className="text-2xl font-bold text-mountain-forest flex-1 pr-4">{room.name}</h3>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-mountain-forest">฿{room.price.toLocaleString()}</p>
                        <p className="text-[10px] uppercase font-bold text-mountain-slate">ต่อคืน</p>
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <span className="px-3 py-1.5 bg-mountain-mist text-mountain-forest text-[10px] font-bold rounded-lg">
                        {room.capacity}
                      </span>
                    </div>

                    <div className="mt-auto pt-6 border-t border-mountain-mist">
                      <div className="flex items-start gap-3">
                        <Users className="w-4 h-4 text-mountain-slate mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-mountain-slate text-xs leading-relaxed line-clamp-2">
                            <span className="font-bold">ความจุ:</span> {room.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-mountain-gold self-end">
                          <span className="text-[10px] font-bold uppercase tracking-widest">รายละเอียด</span>
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Room Edit Modal */}
        <AnimatePresence>
          {editingRoom && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-luxury-ink/60 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="luxury-card p-8 md:p-10 max-w-lg w-full max-h-[90vh] overflow-y-auto relative"
              >
                <div className="sticky top-0 bg-white z-10 flex justify-between items-center mb-8 pb-4 border-b border-mountain-mist">
                  <h2 className="text-2xl md:text-3xl font-bold text-mountain-forest">แก้ไขข้อมูลห้องพัก</h2>
                  <button onClick={() => setEditingRoom(null)} className="p-2 hover:bg-mountain-mist transition-colors rounded-xl">
                    <X className="w-6 h-6 text-mountain-forest" />
                  </button>
                </div>
                
                <form onSubmit={handleRoomUpdate} className="space-y-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-widest text-luxury-stone font-semibold">ชื่อห้องพัก</label>
                    <input 
                      required
                      type="text" 
                      className="luxury-input" 
                      value={roomForm.name}
                      onChange={e => setRoomForm({...roomForm, name: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs uppercase tracking-widest text-luxury-stone font-semibold">ความจุ (ท่าน)</label>
                      <input 
                        required
                        type="text" 
                        className="luxury-input" 
                        value={roomForm.capacity}
                        onChange={e => setRoomForm({...roomForm, capacity: e.target.value})}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs uppercase tracking-widest text-luxury-stone font-semibold">ราคาต่อคืน (฿)</label>
                      <input 
                        required
                        type="number" 
                        className="luxury-input" 
                        value={roomForm.price}
                        onChange={e => setRoomForm({...roomForm, price: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-widest text-luxury-stone font-semibold">รายละเอียด</label>
                    <textarea 
                      className="luxury-input min-h-[100px] py-4" 
                      value={roomForm.description}
                      onChange={e => setRoomForm({...roomForm, description: e.target.value})}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-widest text-luxury-stone font-semibold">สิ่งอำนวยความสะดวก (แยกด้วยเครื่องหมายคอมม่า)</label>
                    <input 
                      type="text" 
                      className="luxury-input" 
                      placeholder="เช่น Wi-Fi, แอร์, อาหารเช้า"
                      value={roomForm.amenities}
                      onChange={e => setRoomForm({...roomForm, amenities: e.target.value})}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-widest text-luxury-stone font-semibold">สถานะ</label>
                    <select 
                      className="luxury-input"
                      value={roomForm.status}
                      onChange={e => setRoomForm({...roomForm, status: e.target.value})}
                    >
                      <option value="Available">ว่าง (Available)</option>
                      <option value="Unavailable">ไม่ว่าง (Unavailable)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-widest text-luxury-stone font-semibold">URL รูปภาพ</label>
                    <input 
                      type="text" 
                      className="luxury-input" 
                      value={roomForm.imageUrl}
                      onChange={e => setRoomForm({...roomForm, imageUrl: e.target.value})}
                    />
                  </div>

                  <div className="pt-8">
                    <button 
                      disabled={submitting}
                      type="submit" 
                      className="luxury-button w-full flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'บันทึกการเปลี่ยนแปลง'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
