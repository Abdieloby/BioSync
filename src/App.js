import React, { useState, useEffect, useMemo, useRef } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
  setDoc,
  getDoc,
  updateDoc,
  orderBy,
  limit,
} from "firebase/firestore";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  signOut,
} from "firebase/auth";
import {
  Activity,
  Brain,
  Calendar,
  ClipboardCopy,
  Dumbbell,
  TrendingUp,
  CheckCircle2,
  ListTodo,
  Smile,
  Frown,
  Meh,
  Zap,
  Heart,
  Smartphone,
  Sun,
  Flame,
  PlusCircle,
  Download,
  Filter,
  Upload,
  X,
  Save,
  Edit3,
  Trash2,
  Moon,
  Book,
  Plus,
  Check,
  Lock,
  LogOut,
  Mail,
  Key,
  Send,
  Sparkles,
  Camera,
  Trophy,
  Home,
  Bell,
  Volume2,
} from "lucide-react";

/**
 * ENVIRONMENT VARIABLE STRATEGY:
 * 1. For local development, create a .env file and use REACT_APP_GEMINI_API_KEY.
 * 2. For deployment (Vercel/Netlify), add the key in the provider's dashboard.
 * 3. Below, we use a fallback logic to handle the preview environment AND production.
 */
const GEMINI_API_KEY =
  process.env.REACT_APP_GEMINI_API_KEY ||
  (typeof apiKey !== "undefined" ? apiKey : "");

// --- YOUR FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyB_luLZasV6dY3hSyhHij27VV8JYVmdP1E",
  authDomain: "biosync-app-cef55.firebaseapp.com",
  projectId: "biosync-app-cef55",
  storageBucket: "biosync-app-cef55.firebasestorage.app",
  messagingSenderId: "130729234995",
  appId: "1:130729234995:web:17a158b1bd7a6b65f7c946",
};
// -----------------------------------

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// --- Utilities ---
const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const calculateStreakStats = (dates) => {
  if (!dates || dates.length === 0)
    return { currentStreak: 0, maxStreak: 0, maxStreakDate: null };

  // 1. Deduplicate & Sort
  const uniqueDates = [...new Set(dates)].sort();

  // 2. Helper to get "Epoch Days" (integer) from YYYY-MM-DD
  //    Treating YYYY-MM-DD as UTC midnight prevents timezone drift issues during diffing.
  const toEpochDay = (dateStr) => Math.floor(Date.parse(dateStr) / 86400000);

  let currentStreak = 0;
  let maxStreak = 0;
  let maxStreakDate = null;
  let tempStreak = 0;
  let lastEpoch = null;

  // 3. Calculate Max Streak (Robust Iteration)
  for (const dateStr of uniqueDates) {
    const epoch = toEpochDay(dateStr);

    if (lastEpoch !== null) {
      if (epoch - lastEpoch === 1) {
        tempStreak++;
      } else {
        // Gap detected: reset
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }

    if (tempStreak > maxStreak) {
      maxStreak = tempStreak;
      maxStreakDate = dateStr;
    }
    lastEpoch = epoch;
  }

  // 4. Calculate Current Streak
  //    "Active" means the streak includes Today OR Yesterday.
  const todayStr = getLocalDateKey();
  const d = new Date();
  d.setDate(d.getDate() - 1); // Safe "Yesterday" calculation
  const yesterdayStr = getLocalDateKey(d);

  const hasToday = uniqueDates.includes(todayStr);
  const hasYesterday = uniqueDates.includes(yesterdayStr);

  if (hasToday || hasYesterday) {
    // Determine start point for backward check
    let checkDate = hasToday ? new Date() : new Date(Date.now() - 86400000);
    // Note: If using strict yesterday object above, we can use that too, 
    // but Date.now() - 864k is generally safe for "24h ago" check logic if consistently applied.
    // Ideally we reconcile to using the same Date object logic, but let's stick to the key generation.

    // Actually, let's match the logic:
    if (!hasToday) {
      checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dateKey = getLocalDateKey(checkDate);
      if (uniqueDates.includes(dateKey)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return { currentStreak, maxStreak, maxStreakDate };
};

const DEFAULT_SCHEDULE = {
  0: {
    title: "Rest",
    exercises: [{ name: "Deep Recovery (Sleep Focus)", sets: "1", reps: "1" }],
  },
  1: {
    title: "Upper Body A (Push)",
    exercises: [
      { name: "Arm Circles / Band Pull-aparts", sets: "1", reps: "Warmup" },
      { name: "DB/Machine Chest Press", sets: "3", reps: "10-12" },
      { name: "Seated Shoulder Press", sets: "3", reps: "10-12" },
      { name: "Lateral Raises", sets: "3", reps: "15" },
      { name: "Tricep Pushdowns", sets: "3", reps: "12-15" },
      { name: "Plank Hold", sets: "3", reps: "45s" },
    ],
  },
  2: {
    title: "Lower Body (Squat)",
    exercises: [
      { name: "Walking + Hip Mobility", sets: "1", reps: "5m" },
      { name: "Goblet Squats (Heels Elevated)", sets: "3", reps: "10" },
      { name: "Romanian Deadlift (DB)", sets: "3", reps: "10" },
      { name: "Leg Extension", sets: "3", reps: "15" },
      { name: "Double Leg Calf Raise Hold", sets: "3", reps: "45s Hold" },
      { name: "Stationary Bike (Low Res)", sets: "1", reps: "15m" },
    ],
  },
  3: {
    title: "Active Recovery",
    exercises: [
      { name: "Zone 1-2 Walking", sets: "1", reps: "45-60m" },
      { name: "Gentle Yoga", sets: "1", reps: "Optional" },
    ],
  },
  4: {
    title: "Upper Body B (Pull)",
    exercises: [
      { name: "Lat Pulldowns", sets: "3", reps: "10-12" },
      { name: "Chest Supported Row", sets: "3", reps: "12" },
      { name: "Face Pulls", sets: "3", reps: "15" },
      { name: "DB Bicep Curls", sets: "3", reps: "12" },
      { name: "Hammer Curls", sets: "3", reps: "12" },
    ],
  },
  5: {
    title: "Full Body / Conditioning",
    exercises: [
      { name: "Push-ups", sets: "3", reps: "12" },
      { name: "Bodyweight Reverse Lunges", sets: "3", reps: "12/leg" },
      { name: "Inverted Row / Band Row", sets: "3", reps: "12" },
      { name: "Plank to Down-Dog", sets: "3", reps: "10" },
      { name: "Farmers Carry", sets: "3", reps: "45s" },
    ],
  },
  6: {
    title: "Outdoor / Hike",
    exercises: [{ name: "Hiking / Zone 2 Walk", sets: "1", reps: "Long" }],
  },
};

const DEFAULT_HABITS = [
  { id: "water", label: "Water (3L)", icon: "💧" },
  { id: "oatmeal", label: "Eat Oatmeal", icon: "🥣" },
  { id: "probiotics", label: "Probiotics", icon: "💊" },
  { id: "psyllium", label: "Psyllium", icon: "🌾" },
  { id: "steps", label: "10k Steps", icon: "👣" },
];

const GUT_TRIGGERS = [
  { label: "Spicy", icon: "🌶️" },
  { label: "Alcohol", icon: "🍺" },
  { label: "Dairy", icon: "🧀" },
  { label: "Gluten", icon: "🍞" },
  { label: "Grease", icon: "🍕" },
  { label: "Caffeine", icon: "☕" },
  { label: "Sugar", icon: "🍭" },
  { label: "Late Night", icon: "🌙" },
];

// --- Shared Components ---
const Card = ({ children, className = "" }) => (
  <div
    className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}
  >
    {children}
  </div>
);

const Header = ({
  title,
  subtitle,
  colorClass = "text-slate-800",
  rightElement = null,
}) => (
  <header className="px-6 pt-12 pb-6 bg-white border-b border-slate-50 flex justify-between items-end">
    <div>
      <h1 className={`text-3xl font-extrabold tracking-tight ${colorClass}`}>
        {title}
      </h1>
      <p className="text-slate-400 font-medium mt-1 text-sm">{subtitle}</p>
    </div>
    {rightElement}
  </header>
);

const DateSelector = ({ selectedDate, setSelectedDate }) => (
  <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100 mb-6 shadow-sm">
    <div className="flex items-center space-x-3">
      <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
        <Calendar size={18} />
      </div>
      <span className="text-sm font-bold text-slate-600">Log Date</span>
    </div>
    <input
      type="date"
      value={selectedDate}
      max={getLocalDateKey(new Date())}
      onChange={(e) => setSelectedDate(e.target.value)}
      className="bg-transparent font-bold text-slate-800 outline-none text-right"
    />
  </div>
);

// --- Auth View ---
const AuthView = ({ onComplete }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        if (auth.currentUser && auth.currentUser.isAnonymous) {
          const credential = EmailAuthProvider.credential(email, password);
          await linkWithCredential(auth.currentUser, credential);
        } else {
          await createUserWithEmailAndPassword(auth, email, password);
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onComplete?.();
    } catch (err) {
      setError(err.message.replace("Firebase:", ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 bg-cyan-50 rounded-2xl mb-4">
            <Lock className="text-cyan-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">
            {mode === "login" ? "Welcome Back" : "Secure Your Account"}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {mode === "login"
              ? "Sign in to access your logs"
              : "Existing data will be saved to your account"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
              Email Address
            </label>
            <div className="relative">
              <Mail
                className="absolute left-4 top-3.5 text-slate-300"
                size={18}
              />
              <input
                type="email"
                required
                placeholder="name@email.com"
                className="w-full pl-12 p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-cyan-100 font-medium"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
              Password
            </label>
            <div className="relative">
              <Key
                className="absolute left-4 top-3.5 text-slate-300"
                size={18}
              />
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full pl-12 p-3.5 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-cyan-100 font-medium"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 font-bold bg-red-50 p-3 rounded-lg">
              {error}
            </p>
          )}

          <button
            disabled={loading}
            className="w-full py-4 bg-cyan-600 text-white rounded-xl font-bold shadow-lg shadow-cyan-100 active:scale-95 transition-all"
          >
            {loading
              ? "Processing..."
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-sm font-bold text-cyan-600"
          >
            {mode === "login"
              ? "Don't have a secure account? Sign Up"
              : "Already have an account? Log In"}
          </button>
        </div>
      </div>
    </div>
  );
};

const HomeView = ({ user, history, setActiveTab }) => {
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const hr = new Date().getHours();
    if (hr < 12) setGreeting("Good Morning");
    else if (hr < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  const todayStr = getLocalDateKey();

  // Status Checks
  const moodLogged = history.some(h => h.type === 'daily_metrics' && h.data.targetDate === todayStr);
  const gymLogged = history.some(h => h.type === 'gym_set' && h.data.targetDate === todayStr);
  const habitsDone = history
    .find(h => h.type === 'habits' && h.data.targetDate === todayStr)
    ?.data.completed?.length || 0;

  // Notifications
  const requestNotify = async () => {
    if (!("Notification" in window)) return alert("Browser does not support notifications");
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      new Notification("BioSync Reminders Enabled", { body: "We'll remind you to log your day." });
    }
  };

  return (
    <div className="pb-32 bg-slate-50 min-h-screen">
      <header className="px-6 pt-12 pb-6 bg-white border-b border-slate-50">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-wide">{greeting}</p>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight mt-1">
              {user.email ? user.email.split('@')[0] : 'Guest'}
            </h1>
          </div>
          <div className="p-2 bg-slate-100 rounded-full text-slate-400">
            <Bell size={20} onClick={requestNotify} className="cursor-pointer hover:text-cyan-600 transition-colors" />
          </div>
        </div>
      </header>

      <div className="px-5 mt-6 space-y-6 max-w-md mx-auto">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Mood Status */}
          <div onClick={() => setActiveTab('experience')} className={`p-4 rounded-3xl border transition-all cursor-pointer ${moodLogged ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100 hover:border-cyan-200'}`}>
            <div className="flex justify-between items-start mb-2">
              <div className={`p-2 rounded-xl ${moodLogged ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                <Heart size={20} className={moodLogged ? "fill-current" : ""} />
              </div>
              {moodLogged && <CheckCircle2 size={16} className="text-emerald-500" />}
            </div>
            <h3 className="font-bold text-slate-700">Mood</h3>
            <p className="text-xs text-slate-400 font-medium">{moodLogged ? "Logged" : "Tap to log"}</p>
          </div>

          {/* Gym Status */}
          <div onClick={() => setActiveTab('gym')} className={`p-4 rounded-3xl border transition-all cursor-pointer ${gymLogged ? 'bg-cyan-50 border-cyan-100' : 'bg-white border-slate-100 hover:border-cyan-200'}`}>
            <div className="flex justify-between items-start mb-2">
              <div className={`p-2 rounded-xl ${gymLogged ? 'bg-cyan-100 text-cyan-600' : 'bg-slate-50 text-slate-400'}`}>
                <Dumbbell size={20} />
              </div>
              {gymLogged && <CheckCircle2 size={16} className="text-cyan-500" />}
            </div>
            <h3 className="font-bold text-slate-700">Gym</h3>
            <p className="text-xs text-slate-400 font-medium">{gymLogged ? "Worked Out" : "Tap to log"}</p>
          </div>
        </div>

        {/* Habits Brief */}
        <div onClick={() => setActiveTab('habits')} className="p-5 bg-indigo-50 rounded-3xl border border-indigo-100 flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white text-indigo-500 rounded-2xl shadow-sm">
              <ListTodo size={24} />
            </div>
            <div>
              <h3 className="font-black text-lg text-indigo-900">{habitsDone} Habits</h3>
              <p className="text-xs font-bold text-indigo-400 uppercase">Completed Today</p>
            </div>
          </div>
          <div className="bg-white p-2 rounded-full text-indigo-300">
            <Plus size={20} />
          </div>
        </div>

        {/* AI Call to Action */}
        <div onClick={() => setActiveTab('ai')} className="p-6 bg-slate-900 rounded-3xl shadow-xl shadow-slate-200 cursor-pointer group relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-lg">Daily Briefing</h3>
              <p className="text-slate-400 text-sm mt-1">Ask your AI coach for a plan.</p>
            </div>
            <div className="p-3 bg-white/10 rounded-2xl text-cyan-400 group-hover:scale-110 transition-transform">
              <Sparkles size={24} />
            </div>
          </div>
          {/* Background Decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
        </div>

      </div>
    </div>
  );
};

// --- App Navigation ---
const TabNav = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: "home", icon: Home, label: "Home" }, // NEW Home Tab
    { id: "experience", icon: Heart, label: "Mood" },
    { id: "habits", icon: ListTodo, label: "Habits" },
    { id: "ai", icon: Sparkles, label: "Coach" },
    { id: "gut", icon: Brain, label: "Gut" },
    { id: "gym", icon: Dumbbell, label: "Gym" },
    { id: "report", icon: Book, label: "Report" },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-100 safe-area-pb z-50">
      <div className="flex justify-around items-center h-20 max-w-md mx-auto pb-2 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all duration-300 ${activeTab === tab.id ? "text-cyan-600" : "text-slate-300"
              }`}
          >
            <div
              className={`p-1 rounded-xl transition-all ${activeTab === tab.id ? "bg-cyan-50 -translate-y-1" : ""
                }`}
            >
              <tab.icon
                size={tab.id === "ai" ? 28 : 22}
                strokeWidth={activeTab === tab.id ? 2.5 : 2}
              />
            </div>
            <span
              className={`text-[9px] font-bold ${activeTab === tab.id ? "opacity-100" : "opacity-0 hidden"
                }`}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

// --- AI Coach View ---
// --- AI Coach View ---
const AICoachView = ({ user, history, saveEntry }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  const endRef = useRef(null);

  // Persistence: Load Chat History
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "ai_chat"),
      orderBy("timestamp", "desc"), // Fetch NEWEST first
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => doc.data());
      if (msgs.length === 0) {
        // Initial greeting if empty
        setMessages([
          {
            role: "assistant",
            content: "Hey! Ready to hit some PRs or fix that gut? Any updates?",
            timestamp: new Date().toISOString(),
          },
        ]);
      } else {
        // Reverse to show Chronological (Oldest -> Newest) in UI
        setMessages(msgs.reverse());
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const callGemini = async (queryText, base64Image) => {
    if (!GEMINI_API_KEY)
      return "Error: No API Key found in environment variables.";

    // Context: Recent Logs + Health Metrics
    const recentLogs = history
      .slice(0, 40)
      .map((h) => ({ type: h.type, data: h.data, date: h.data.targetDate }));

    // System Prompt: Science-based + Friendly + SMART DATES + DELETION + LABS
    const systemPrompt = `You are the BioSync Human Performance Architect. 
    Persona: A world-class health expert who is also a supportive partner.
    Tone: Warm, knowledgeable, and encouraging.
    
    Context: 
    - Current System Date: ${getLocalDateKey()} (Use this ONLY if no other dates are visible in user content).
    - Recent Logs: ${JSON.stringify(recentLogs)}
    - Dossier: The user is focused on optimizing their health and performance. They track various metrics to understand their body better.
    
    Capabilities:
    1. Analysis: Analyze trends.
    2. Data Extraction (CRITICAL): extracting historical data from screenshots (Apps, Lab Results).
    3. Smart Date Logic: 
       - If an image lists "Today", "Yesterday", and absolute dates (e.g., "Jan 12"), use the absolute dates to determining what "Today" really is for that specific image. 
       - **CRITICAL**: If you see "Today" but NO absolute date is visible to anchor it, **YOU MUST ASK**: "What date is this screenshot from?" DO NOT GUESS.
       - Calculate the specific "targetDate" (YYYY-MM-DD) for EACH item.
    4. Database Management:
        - You can saved data using ACTION_SAVE_BATCH.
        - You can **DELETE** data using ACTION_DELETE_BATCH.
    
    Output Format:
    ACTION_SAVE_BATCH: [ { "type": "daily_metrics", "data": { "weight": 75.5, "targetDate": "2026-01-17" } } ]
    
    Data Schema:
    - daily_metrics: { weight, bodyFat, steps, hrv, restingHeartRate, sleepScore, ... }
    - nutrition: { calories, protein, carbs, fat, foodLog }
    - lab_result: { panel (e.g. "Lipids"), marker (e.g. "LDL"), value: number, unit, status (e.g. "High"), targetDate }
    - gym_set, gut, habits...
    `;

    const payload = {
      contents: [
        {
          parts: [
            { text: queryText || "Analyze this." },
            ...(base64Image
              ? [{ inlineData: { mimeType: "image/png", data: base64Image } }]
              : []),
          ],
        },
      ],
      systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        return "Network Error. Try again.";
      }
      const data = await response.json();
      if (data.error) return `Error: ${data.error.message}`;

      return (
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "..."
      );
    } catch (err) {
      return "Connection failed.";
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !image) || loading || !user) return;

    const userMsg = {
      role: "user",
      content: input || "Uploaded image",
      hasImage: !!image,
      timestamp: new Date().toISOString(),
    };

    await addDoc(collection(db, "users", user.uid, "ai_chat"), userMsg);

    setLoading(true);
    const currentImg = image;
    const currentInput = input;
    setInput("");
    setImage(null);

    const res = await callGemini(currentInput, currentImg);

    let savedDataCount = 0;
    let deletedDataCount = 0;
    let cleanResponse = res || "Error: No response.";

    // Logic for BATCH SAVE & DELETE
    if (res && (res.includes("ACTION_SAVE") || res.includes("ACTION_DELETE"))) {
      try {
        const isDelete = res.includes("ACTION_DELETE");
        const splitter = isDelete
          ? (res.includes("ACTION_DELETE_BATCH:") ? "ACTION_DELETE_BATCH:" : "ACTION_DELETE:")
          : (res.includes("ACTION_SAVE_BATCH:") ? "ACTION_SAVE_BATCH:" : "ACTION_SAVE:");

        const parts = res.split(splitter);
        cleanResponse = parts[0].trim();
        const jsonPart = parts[1].trim();
        const cleanJson = jsonPart.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        // Normalize to array
        const items = Array.isArray(parsed) ? parsed : [parsed];

        for (const item of items) {
          const targetDate = item.data?.targetDate || item.targetDate || getLocalDateKey();

          if (isDelete) {
            // DELETE LOGIC
            // Find entry by type and date
            const entryToDelete = history.find(h => h.type === item.type && h.data.targetDate === targetDate);
            if (entryToDelete) {
              await deleteDoc(doc(db, "users", user.uid, "entries", entryToDelete.id));
              deletedDataCount++;
            }
          } else {
            // SAVE LOGIC
            const safeData = {
              ...item.data,
              targetDate: targetDate,
              timestamp: new Date().toISOString()
            };

            // Smart Merge for daily_metrics
            if (item.type === "daily_metrics") {
              const existing = history.find(h => h.type === "daily_metrics" && h.data.targetDate === safeData.targetDate);
              if (existing) {
                await updateDoc(doc(db, "users", user.uid, "entries", existing.id), { data: { ...existing.data, ...safeData } });
              } else {
                await saveEntry(item.type, safeData);
              }
            } else {
              await saveEntry(item.type, safeData);
            }
            savedDataCount++;
          }
        }

      } catch (e) {
        console.error("Auto-action failed", e);
        cleanResponse += "\n\n[System Error: Action failed. Please check logs.]";
      }
    }

    // Save AI Msg
    const aiMsg = {
      role: "assistant",
      content: cleanResponse,
      timestamp: new Date().toISOString(),
      savedCount: savedDataCount,
      deletedCount: deletedDataCount
    };
    await addDoc(collection(db, "users", user.uid, "ai_chat"), aiMsg);

    setLoading(false);
  };

  return (
    <div className="pb-40 bg-slate-50 min-h-screen flex flex-col">
      <Header
        title="Intelligence"
        subtitle="AI Health Coach"
        colorClass="text-cyan-600"
      />
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"
              }`}
          >
            <div
              className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium ${m.role === "user"
                ? "bg-cyan-600 text-white rounded-tr-none"
                : "bg-white text-slate-700 border border-slate-100 rounded-tl-none shadow-sm"
                }`}
            >
              {m.hasImage && (
                <div className="mb-2 opacity-60 flex items-center gap-1 text-[10px]">
                  <Camera size={10} /> Screenshot Attached
                </div>
              )}
              <div className="whitespace-pre-wrap">{m.content}</div>

              {/* Visual Feedback for Saved Actions */}
              {m.savedCount > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-emerald-600">
                  <CheckCircle2 size={14} />
                  <span>Saved {m.savedCount} items</span>
                </div>
              )}
              {/* Visual Feedback for Deleted Actions */}
              {m.deletedCount > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-rose-600">
                  <Trash2 size={14} />
                  <span>Deleted {m.deletedCount} items</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-xs text-slate-400 font-bold animate-pulse px-2">
            Thinking...
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-4 bg-white/80 backdrop-blur-md border-t fixed bottom-20 left-0 right-0 max-w-md mx-auto flex items-center gap-2 z-40">
        <button
          onClick={() => fileRef.current.click()}
          className={`p-3 rounded-xl transition-all ${image ? "bg-cyan-100 text-cyan-600 shadow-md ring-2 ring-cyan-200" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
            }`}
          title="Upload Screenshot"
        >
          <Camera size={20} />
        </button>
        <input
          type="file"
          ref={fileRef}
          className="hidden"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              // Basic validation
              if (file.size > 5 * 1024 * 1024) {
                alert("File too large. Please utilize an image under 5MB.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setImage(reader.result.split(",")[1]);
              reader.readAsDataURL(file);
            }
          }}
        />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask your coach..."
          className="flex-1 bg-slate-50 p-3 rounded-xl outline-none text-sm font-medium"
        />
        <button
          onClick={handleSend}
          className="p-3 bg-cyan-600 text-white rounded-xl shadow-lg shadow-cyan-100"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

// --- Views ---

const ExperienceView = ({
  user,
  saveEntry,
  history,
  updateEntry,
  onLogout,
}) => {
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey());
  const [form, setForm] = useState({
    mood: null,
    gratitude: "",
    screenTime: "",
    screenIntensity: "Light",
    sleepQuality: "",
  });
  const [saveStatus, setSaveStatus] = useState("");

  const existingDaily = useMemo(
    () =>
      history.find(
        (h) => h.type === "daily_metrics" && h.data.targetDate === selectedDate
      ),
    [history, selectedDate]
  );

  useEffect(() => {
    if (existingDaily)
      setForm((prev) => ({
        ...prev,
        mood: existingDaily.data.mood || null,
        screenTime: existingDaily.data.screenTime || "",
        screenIntensity: existingDaily.data.screenIntensity || "Light",
        sleepQuality: existingDaily.data.sleepQuality || "",
      }));
    else
      setForm((prev) => ({
        ...prev,
        mood: null,
        screenTime: "",
        screenIntensity: "Light",
        sleepQuality: "",
      }));
  }, [existingDaily, selectedDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveStatus("Saving...");
    const dailyData = {
      mood: form.mood,
      screenTime: form.screenTime,
      screenIntensity: form.screenIntensity,
      sleepQuality: form.sleepQuality,
      targetDate: selectedDate,
      timestamp: new Date().toISOString(),
    };
    if (existingDaily) await updateEntry(existingDaily.id, dailyData);
    else await saveEntry("daily_metrics", dailyData);
    if (form.gratitude.trim()) {
      await saveEntry("gratitude", {
        text: form.gratitude,
        targetDate: selectedDate,
        timestamp: new Date().toISOString(),
      });
      setForm((prev) => ({ ...prev, gratitude: "" }));
    }
    setSaveStatus("Saved!");
    setTimeout(() => setSaveStatus(""), 2000);
  };

  const moodOptions = [
    { v: 1, l: "Low", i: Frown, c: "text-rose-500 bg-rose-50" },
    { v: 2, l: "Okay", i: Meh, c: "text-amber-500 bg-amber-50" },
    { v: 3, l: "Good", i: Smile, c: "text-cyan-600 bg-cyan-50" },
    { v: 4, l: "Great", i: Zap, c: "text-emerald-500 bg-emerald-50" },
  ];

  return (
    <div className="pb-32 bg-slate-50 min-h-screen">
      <Header
        title="My Mind"
        subtitle={user.email || "Guest User"}
        colorClass="text-rose-500"
        rightElement={
          <button
            onClick={onLogout}
            className="p-2 bg-slate-100 rounded-lg text-slate-400"
          >
            <LogOut size={18} />
          </button>
        }
      />
      <div className="px-5 mt-6 max-w-md mx-auto space-y-6">
        <DateSelector
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
        <section>
          <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-2 block">
            Energy Level
          </label>
          <div className="grid grid-cols-4 gap-3">
            {moodOptions.map((o) => (
              <button
                key={o.v}
                onClick={() => setForm({ ...form, mood: o.v })}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${form.mood === o.v
                  ? `border-transparent ring-2 ${o.c} shadow-sm scale-105`
                  : "bg-white border-slate-100 text-slate-300"
                  }`}
              >
                <o.i size={28} className="mb-2" />
                <span className="text-[10px] font-bold uppercase">{o.l}</span>
              </button>
            ))}
          </div>
        </section>
        <Card className="p-4">
          <div className="flex items-center space-x-2 mb-2 text-slate-800">
            <Moon size={18} className="text-indigo-500" />
            <h3 className="font-bold text-sm">Sleep Quality (1-10)</h3>
          </div>
          <input
            type="number"
            placeholder="8"
            min="1"
            max="10"
            className="w-full p-2 bg-slate-50 rounded-lg font-bold text-slate-700 outline-none text-center text-lg"
            value={form.sleepQuality}
            onChange={(e) => {
              let v = parseInt(e.target.value);
              if (isNaN(v) || v < 1) v = "";
              if (v > 10) v = 10;
              setForm({ ...form, sleepQuality: v });
            }}
          />
        </Card>
        <Card className="p-5">
          <div className="flex items-center space-x-2 mb-4 text-slate-800">
            <Smartphone size={20} className="text-purple-500" />
            <h3 className="font-bold">Digital Dose</h3>
          </div>
          <div className="flex space-x-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Time"
                className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none"
                value={form.screenTime}
                onChange={(e) =>
                  setForm({ ...form, screenTime: e.target.value })
                }
              />
            </div>
            <div className="flex-1">
              <select
                className="w-full h-full p-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none"
                value={form.screenIntensity}
                onChange={(e) =>
                  setForm({ ...form, screenIntensity: e.target.value })
                }
              >
                <option value="Light">Light</option>
                <option value="Medium">Socials</option>
                <option value="Heavy">Doomscroll</option>
              </select>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center space-x-2 mb-3 text-slate-800">
            <Sun size={20} className="text-amber-500" />
            <h3 className="font-bold">Gratitude</h3>
          </div>
          <textarea
            placeholder="One good thing today..."
            className="w-full p-4 bg-amber-50/50 rounded-xl text-slate-700 font-medium outline-none min-h-[100px] resize-none"
            value={form.gratitude}
            onChange={(e) => setForm({ ...form, gratitude: e.target.value })}
          />
        </Card>
        <button
          onClick={handleSubmit}
          className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold shadow-lg flex justify-center items-center space-x-3"
        >
          {saveStatus === "Saved!" ? <Check size={20} /> : <Save size={20} />}
          <span>{saveStatus || "Save Log"}</span>
        </button>
      </div>
    </div>
  );
};

const HabitsView = ({
  user,
  saveEntry,
  history,
  habitsList,
  saveHabitsList,
}) => {
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey());
  const [localCompleted, setLocalCompleted] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");

  const historyMap = useMemo(() => {
    const m = {};
    history
      .filter((h) => h.type === "habits")
      .forEach((h) => {
        let k =
          h.data.targetDate || getLocalDateKey(new Date(h.data.timestamp));
        if (!m[k]) m[k] = h.data.completed || [];
      });
    return m;
  }, [history]);

  useEffect(
    () => setLocalCompleted(historyMap[selectedDate] || []),
    [selectedDate, historyMap]
  );

  // --- Audio Feedback ---
  const playSound = (type) => {
    // Simple synthesized beeps using Web Audio API would be ideal, 
    // but for now we'll use a very short, pleasant organic sound URL or silent fallback if offline.
    // Using a simple efficient strategy: visual feedback is primary, audio is nice-to-have.
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      } else if (type === 'save') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      }
    } catch (e) {
      console.warn("Audio play failed", e);
    }
  };

  // --- Streak Calculation ---
  const calculateStreak = (habitId) => {
    let streak = 0;
    const today = getLocalDateKey();
    const yesterday = getLocalDateKey(new Date(Date.now() - 86400000));

    const doneToday = historyMap[today]?.includes(habitId);
    const doneYesterday = historyMap[yesterday]?.includes(habitId);

    if (!doneToday && !doneYesterday) return 0;

    let checkDate = doneToday ? new Date() : new Date(Date.now() - 86400000);
    while (true) {
      const dateKey = getLocalDateKey(checkDate);
      if (historyMap[dateKey]?.includes(habitId)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const toggleHabit = (id) => {
    if (isEditMode) return;
    setLocalCompleted((prev) => {
      const n = prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id];

      // Sound feedback if completing
      if (!prev.includes(id)) playSound('success');

      saveEntry("habits", {
        completed: n,
        targetDate: selectedDate,
        timestamp: new Date().toISOString(),
      });
      return n;
    });
  };

  const addHabit = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    saveHabitsList([
      ...habitsList,
      { id: "h_" + Date.now(), label: newName, icon: "✨" },
    ]);
    setNewName("");
  };
  const deleteHabit = (e, id) => {
    e.stopPropagation();
    saveHabitsList(habitsList.filter((h) => h.id !== id));
  };
  const saveEdit = (e) => {
    e.stopPropagation();
    if (editName.trim())
      saveHabitsList(
        habitsList.map((h) =>
          h.id === editingId ? { ...h, label: editName } : h
        )
      );
    setEditingId(null);
  };

  return (
    <div className="pb-32 bg-slate-50 min-h-screen">
      <Header
        title="Habits"
        subtitle="Consistency is key"
        colorClass="text-teal-600"
        rightElement={
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`p-2 rounded-lg ${isEditMode
              ? "bg-teal-100 text-teal-700"
              : "bg-slate-100 text-slate-400"
              }`}
          >
            {isEditMode ? <Check size={18} /> : <Edit3 size={18} />}
          </button>
        }
      />
      <div className="px-5 mt-6 max-w-md mx-auto space-y-4">
        <DateSelector
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
        <div className="space-y-3">
          {habitsList.map((h) => {
            const isDone = localCompleted.includes(h.id);
            const isEditing = editingId === h.id;
            const streakCount = calculateStreak(h.id);

            return (
              <div
                key={h.id}
                onClick={() => !isEditing && toggleHabit(h.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${isDone && !isEditMode
                  ? "bg-white border-teal-200 shadow-sm"
                  : "bg-white border-slate-100"
                  }`}
              >
                <div className="flex-1 flex items-center space-x-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${isDone && !isEditMode ? "bg-teal-50" : "bg-slate-50"
                      }`}
                  >
                    {h.icon}
                  </div>
                  {isEditing ? (
                    <div className="flex flex-1 space-x-2">
                      <input
                        autoFocus
                        value={editName}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 p-1 border rounded text-sm font-bold text-slate-800"
                      />
                      <button
                        onClick={saveEdit}
                        className="p-1 bg-teal-600 text-white rounded"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <span
                        className={`font-bold text-lg ${isDone && !isEditMode
                          ? "text-slate-800"
                          : "text-slate-500"
                          }`}
                      >
                        {h.label}
                      </span>
                      {streakCount > 1 && (
                        <div className="flex items-center text-orange-500 font-bold text-[10px] uppercase tracking-wider">
                          <Flame size={10} className="mr-1 fill-orange-500" />{" "}
                          {streakCount} Day Streak
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {isEditMode && !isEditing ? (
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(h.id);
                        setEditName(h.label);
                      }}
                      className="p-2 text-slate-300 hover:text-teal-600"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={(e) => deleteHabit(e, h.id)}
                      className="p-2 text-slate-300 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  !isEditMode && (
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isDone
                        ? "bg-teal-500 text-white"
                        : "bg-slate-100 text-slate-300"
                        }`}
                    >
                      <CheckCircle2 size={16} />
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
        {isEditMode && (
          <form
            onSubmit={addHabit}
            className="flex space-x-3 pt-6 border-t border-slate-200"
          >
            <input
              className="flex-1 p-3 bg-white rounded-xl border border-slate-200 outline-none text-sm"
              placeholder="New habit..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button className="p-3 bg-slate-800 text-white rounded-xl">
              <PlusCircle />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

const GutView = ({ user, saveEntry, history, deleteEntry }) => {
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey());
  const [selectedType, setSelectedType] = useState(null);
  const [symptoms, setSymptoms] = useState([]);
  const [notes, setNotes] = useState("");
  const todaysEntries = history.filter(
    (h) => h.type === "gut" && h.data.targetDate === selectedDate
  );
  const handleSave = () => {
    if (!selectedType) return;
    saveEntry("gut", {
      type: selectedType,
      symptoms,
      notes,
      targetDate: selectedDate,
      timestamp: new Date().toISOString(),
    });
    setSelectedType(null);
    setSymptoms([]);
    setNotes("");
  };

  return (
    <div className="pb-32 bg-slate-50 min-h-screen">
      <Header
        title="Gut Health"
        subtitle="Digestion logs"
        colorClass="text-amber-600"
      />
      <div className="px-5 mt-6 max-w-md mx-auto space-y-6">
        <DateSelector
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
        {todaysEntries.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">
              Logged Entries
            </h4>
            {todaysEntries.map((e) => (
              <div
                key={e.id}
                className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center mb-2"
              >
                <div className="text-sm">
                  <span className="font-bold text-amber-600">
                    Type {e.data.type}
                  </span>
                  <span className="text-slate-500 mx-2">|</span>
                  <span className="text-slate-500">
                    {(e.data.symptoms || []).join(", ")}
                  </span>
                </div>
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    deleteEntry(e.id);
                  }}
                  className="text-slate-300 hover:text-red-500 p-2"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        <Card className="p-5">
          <h3 className="font-bold text-slate-700 mb-4">Bristol Stool Scale</h3>
          <div className="flex justify-between gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`flex-1 h-12 rounded-lg font-bold text-sm transition-all ${selectedType === t
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-200"
                  : "bg-slate-100 text-slate-400"
                  }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-bold text-slate-700 mb-3">Symptoms & Triggers</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {["Bloating", "Gas", "Pain"].map((s) => (
              <button
                key={s}
                onClick={() =>
                  setSymptoms((p) =>
                    p.includes(s) ? p.filter((x) => x !== s) : [...p, s]
                  )
                }
                className={`px-4 py-2 rounded-full text-xs font-bold ${symptoms.includes(s)
                  ? "bg-red-500 text-white"
                  : "bg-slate-100 text-slate-500"
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {GUT_TRIGGERS.map((t) => (
              <button
                key={t.label}
                onClick={() =>
                  setNotes((n) => (n ? n + ", " + t.label : t.label))
                }
                className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600"
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <input
            placeholder="Additional notes..."
            className="w-full p-3 bg-slate-50 rounded-xl text-sm font-medium outline-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Card>
        <button
          onClick={handleSave}
          disabled={!selectedType}
          className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold shadow-lg disabled:opacity-50"
        >
          Log Gut Entry
        </button>
      </div>
    </div>
  );
};

const GymView = ({
  user,
  saveEntry,
  history,
  saveSchedule,
  currentSchedule,
  deleteEntry,
}) => {
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey());
  const [exercise, setExercise] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempSchedule, setTempSchedule] = useState(currentSchedule);
  const [editingLogId, setEditingLogId] = useState(null);

  const [y, m, d] = selectedDate.split("-").map(Number);
  const localDateObj = new Date(y, m - 1, d);
  const dayIndex = localDateObj.getDay();
  const todaysPlan = currentSchedule[dayIndex] || {
    title: "Rest",
    exercises: [],
  };

  useEffect(() => {
    setTempSchedule(currentSchedule);
  }, [currentSchedule]);

  const allKnownExercises = useMemo(() => {
    const s = new Set();
    Object.values(currentSchedule).forEach((d) =>
      d.exercises?.forEach((e) => s.add(typeof e === "string" ? e : e.name))
    );
    history
      .filter((h) => h.type === "gym_set")
      .forEach((h) => s.add(h.data.exercise));
    return Array.from(s).sort();
  }, [currentSchedule, history]);

  const handleSaveSet = async (e) => {
    e.preventDefault();
    if (editingLogId) await deleteEntry(editingLogId);
    await saveEntry("gym_set", {
      exercise,
      weight,
      reps,
      sets,
      targetDate: selectedDate,
      timestamp: new Date().toISOString(),
    });
    setWeight("");
    setReps("");
    setSets("");
    setEditingLogId(null);
  };

  const loadPreviousStats = (exName) => {
    if (editingLogId) return;
    const logs = history.filter(
      (h) =>
        h.type === "gym_set" &&
        h.data.exercise.toLowerCase() === exName.toLowerCase()
    );
    if (logs.length > 0) {
      const last = logs.sort(
        (a, b) => new Date(b.data.timestamp) - new Date(a.data.timestamp)
      )[0];
      setExercise(exName);
      setWeight(last.data.weight);
      setSets(last.data.sets);
      setReps(last.data.reps);
    } else {
      setExercise(exName);
      setWeight("");
      setSets("");
      setReps("");
    }
  };

  // Program Editor Logic
  const [newExName, setNewExName] = useState("");
  const [newExSets, setNewExSets] = useState("");
  const [newExReps, setNewExReps] = useState("");
  const [addDay, setAddDay] = useState(null);
  const updateDayTitle = (idx, t) =>
    setTempSchedule((p) => ({ ...p, [idx]: { ...p[idx], title: t } }));
  const removeEx = (idx, i) =>
    setTempSchedule((p) => {
      const nx = [...p[idx].exercises];
      nx.splice(i, 1);
      return { ...p, [idx]: { ...p[idx], exercises: nx } };
    });
  const addEx = (idx) => {
    if (newExName) {
      setTempSchedule((p) => ({
        ...p,
        [idx]: {
          ...p[idx],
          exercises: [
            ...p[idx].exercises,
            {
              name: newExName,
              sets: newExSets || "3",
              reps: newExReps || "10",
            },
          ],
        },
      }));
      setAddDay(null);
      setNewExName("");
      setNewExSets("");
      setNewExReps("");
    }
  };

  if (isEditMode)
    return (
      <div className="pb-32 bg-slate-50 min-h-screen">
        <Header
          title="Program Editor"
          subtitle="Customize weekly plan"
          rightElement={
            <button onClick={() => setIsEditMode(false)}>
              <X className="text-slate-400" />
            </button>
          }
        />
        <div className="px-5 mt-6 max-w-md mx-auto space-y-6">
          {[1, 2, 3, 4, 5, 6, 0].map((idx) => {
            const day = tempSchedule[idx] || { title: "Rest", exercises: [] };
            return (
              <Card key={idx} className="p-4">
                <div className="flex items-center mb-4">
                  <span className="w-8 font-bold text-slate-400 text-xs uppercase">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][idx]}
                  </span>
                  <input
                    value={day.title}
                    onChange={(e) => updateDayTitle(idx, e.target.value)}
                    className="flex-1 font-bold text-slate-700 bg-slate-50 p-2 rounded ml-2 text-sm outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2 pl-10">
                  {day.exercises.map((ex, i) => (
                    <div
                      key={i}
                      className="flex justify-between bg-white border border-slate-200 rounded p-2"
                    >
                      <div className="text-xs font-bold text-slate-700">
                        {ex.name || ex}
                      </div>
                      <button
                        onClick={() => removeEx(idx, i)}
                        className="text-red-400"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {addDay === idx ? (
                    <div className="bg-slate-50 p-2 rounded border border-cyan-100 mt-2">
                      <input
                        placeholder="Name"
                        className="w-full text-xs p-1 mb-1 border rounded"
                        value={newExName}
                        onChange={(e) => setNewExName(e.target.value)}
                      />
                      <div className="flex space-x-1 mb-2">
                        <input
                          placeholder="Sets"
                          className="w-1/2 text-xs p-1 border rounded"
                          value={newExSets}
                          onChange={(e) => setNewExSets(e.target.value)}
                        />
                        <input
                          placeholder="Reps"
                          className="w-1/2 text-xs p-1 border rounded"
                          value={newExReps}
                          onChange={(e) => setNewExReps(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => addEx(idx)}
                          className="text-xs bg-cyan-600 text-white px-2 py-1 rounded"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddDay(idx)}
                      className="self-start px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-500 mt-1 flex items-center"
                    >
                      <Plus size={10} className="mr-1" /> Add Exercise
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
          <button
            onClick={() => {
              saveSchedule(tempSchedule);
              setIsEditMode(false);
            }}
            className="w-full py-4 bg-cyan-600 text-white rounded-xl font-bold"
          >
            Save Program
          </button>
        </div>
      </div>
    );

  return (
    <div className="pb-32 bg-slate-50 min-h-screen">
      <Header
        title="Workout"
        subtitle={todaysPlan.title}
        colorClass="text-cyan-700"
        rightElement={
          <button
            onClick={() => setIsEditMode(true)}
            className="p-2 bg-slate-100 rounded-lg text-slate-500"
          >
            <Edit3 size={18} />
          </button>
        }
      />
      <div className="px-5 mt-6 max-w-md mx-auto space-y-4">
        <DateSelector
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
        <Card className="p-5 border-cyan-100 bg-cyan-50/30">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-cyan-600 uppercase">
              Suggested Plan
            </h3>
            <div className="flex items-center text-orange-500 font-bold text-[10px] uppercase tracking-wider">
              {(() => {
                const gymDates = history
                  .filter((h) => h.type === "gym_set")
                  .map(
                    (h) =>
                      h.data.targetDate ||
                      getLocalDateKey(new Date(h.data.timestamp))
                  );
                const { currentStreak } = calculateStreakStats(gymDates);

                return currentStreak > 0 ? (
                  <>
                    <Flame size={12} className="mr-1 fill-orange-500" />{" "}
                    {currentStreak} Day Streak
                  </>
                ) : null;
              })()}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {todaysPlan.exercises.map((ex, i) => (
              <button
                key={i}
                onClick={() => loadPreviousStats(ex.name || ex)}
                className={`flex justify-between px-3 py-3 border rounded-xl transition-all text-left ${exercise === (ex.name || ex)
                  ? "bg-cyan-600 text-white border-cyan-600 shadow-md"
                  : "bg-white border-cyan-100 text-slate-600"
                  }`}
              >
                <span className="text-sm font-bold">{ex.name || ex}</span>
                <span className="text-xs opacity-80">
                  {ex.sets} x {ex.reps}
                </span>
              </button>
            ))}
          </div>
        </Card>
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          {editingLogId && (
            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex justify-between items-center">
              <span className="text-xs font-bold text-amber-700">
                Editing Entry
              </span>
              <button
                onClick={() => {
                  setEditingLogId(null);
                  setWeight("");
                }}
                className="text-xs text-slate-400"
              >
                Cancel
              </button>
            </div>
          )}
          <input
            list="ex_list"
            placeholder="Exercise Name"
            className="w-full text-xl font-bold text-slate-800 placeholder:text-slate-300 outline-none mb-1"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
          />
          <datalist id="ex_list">
            {allKnownExercises.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
          <div className="grid grid-cols-3 gap-4 mt-6">
            {["Weight", "Sets", "Reps"].map((l, i) => (
              <div key={l} className="bg-slate-50 p-3 rounded-xl text-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  {l}
                </label>
                <input
                  type="number"
                  className="w-full bg-transparent text-center font-bold text-xl text-slate-800 outline-none"
                  value={i === 0 ? weight : i === 1 ? sets : reps}
                  onChange={(e) =>
                    i === 0
                      ? setWeight(e.target.value)
                      : i === 1
                        ? setSets(e.target.value)
                        : setReps(e.target.value)
                  }
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSaveSet}
            className={`w-full mt-4 py-4 text-white rounded-xl font-bold shadow-lg ${editingLogId ? "bg-amber-500" : "bg-cyan-600"
              }`}
          >
            {editingLogId ? "Update" : "Log Set"}
          </button>
        </div>
        <div className="mt-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 ml-1">
            Today's History
          </h4>
          <div className="space-y-2">
            {history
              .filter(
                (h) =>
                  h.type === "gym_set" && h.data.targetDate === selectedDate
              )
              .map((h) => (
                <div
                  key={h.id}
                  className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl text-sm"
                >
                  <div>
                    <span className="font-bold text-slate-700 block">
                      {h.data.exercise}
                    </span>
                    <span className="font-mono text-slate-500 text-xs">
                      {h.data.weight}kg · {h.data.sets}x{h.data.reps}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExercise(h.data.exercise);
                        setWeight(h.data.weight);
                        setSets(h.data.sets);
                        setReps(h.data.reps);
                        setEditingLogId(h.id);
                      }}
                      className="text-slate-300 hover:text-cyan-600 p-2"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteEntry(h.id);
                      }}
                      className="text-slate-300 hover:text-red-500 p-2"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Records = ({ history, habitsList }) => {
  // 1. Workout Streak
  const gymDates = history
    .filter((h) => h.type === "gym_set")
    .map((h) => h.data.targetDate || getLocalDateKey(new Date(h.data.timestamp)));
  const gymStats = calculateStreakStats(gymDates);

  // 2. Habit Streaks (Deduplicated Logic)
  // Group by Date -> Take latest Timestamp
  const habitsByDate = {};
  history.filter((h) => h.type === "habits").forEach((h) => {
    const k = h.data.targetDate || getLocalDateKey(new Date(h.data.timestamp));
    // If multiple entries for same date, use one with latest timestamp
    if (!habitsByDate[k] || new Date(h.data.timestamp) > new Date(habitsByDate[k].timestamp)) {
      habitsByDate[k] = { completed: h.data.completed || [], timestamp: h.data.timestamp };
    }
  });

  const habitStreaks = {}; // habitID -> [dates]
  Object.keys(habitsByDate).forEach(date => {
    habitsByDate[date].completed.forEach(hid => {
      if (!habitStreaks[hid]) habitStreaks[hid] = [];
      habitStreaks[hid].push(date);
    });
  });

  const allHabitIds = new Set([...habitsList.map((h) => h.id), ...Object.keys(habitStreaks)]);
  const podium = Array.from(allHabitIds).map((id) => {
    const dates = habitStreaks[id] || [];
    const stats = calculateStreakStats(dates);
    const found = habitsList.find((h) => h.id === id);
    const label = found ? found.label : (id.startsWith("h_") ? "Custom Habit" : id);
    return { id, label, ...stats };
  }).sort((a, b) => {
    // 1. Active streaks on top
    if (a.currentStreak > 0 && b.currentStreak === 0) return -1;
    if (a.currentStreak === 0 && b.currentStreak > 0) return 1;
    // 2. Longest active streak
    if (a.currentStreak !== b.currentStreak) return b.currentStreak - a.currentStreak;
    // 3. Longest historical streak
    return b.maxStreak - a.maxStreak;
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-5 space-y-5 shadow-sm">
      {/* Workout Streak Display */}
      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100/50">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-white shadow-sm text-cyan-600 rounded-xl">
            <Dumbbell size={20} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-700">Gym Sessions</h4>
            <div className="flex gap-2 mt-0.5">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${gymStats.currentStreak > 0 ? "bg-orange-100 text-orange-600" : "bg-slate-200 text-slate-500"}`}>
                {gymStats.currentStreak > 0 ? "STREAKING" : "RESTING"}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Current / Best</p>
          <span className="block font-black text-xl text-slate-900 leading-tight">
            {gymStats.currentStreak} <span className="text-slate-300 text-sm font-bold">/ {gymStats.maxStreak}</span>
          </span>
        </div>
      </div>

      {/* Habit Podium */}
      <div className="space-y-3">
        {podium.map(p => {
          if (p.maxStreak === 0) return null;
          const isActive = p.currentStreak > 0;
          return (
            <div key={p.id} className={`flex justify-between items-center p-3 rounded-2xl border transition-all ${isActive ? "bg-white border-slate-100" : "bg-slate-50/50 border-transparent opacity-70"}`}>
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-xl ${isActive ? "bg-orange-50 text-orange-500" : "bg-slate-100 text-slate-400"}`}>
                  {isActive ? <Flame size={18} className="fill-orange-500" /> : <Sparkles size={18} />}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-700">{p.label}</h4>
                  <p className="text-[9px] text-slate-400 font-bold flex gap-2">
                    {isActive ? (
                      <span className="text-orange-500 uppercase">ACTIVE • {p.currentStreak}D</span>
                    ) : (
                      <span className="text-slate-400 uppercase">INACTIVE • PREV: {p.maxStreak}D</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-300 font-bold uppercase">Best</p>
                <span className="block font-black text-lg text-slate-800 leading-none">
                  {p.maxStreak} <span className="text-[10px] font-bold text-slate-400 ml-0.5">DAYS</span>
                </span>
                {/* Debug Info (Optional - remove if clean) */}
                {/* <span className="text-[8px] text-slate-200 block">{p.maxStreakDate}</span> */}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ReportView = ({ habitsList, history }) => {
  const [startDate, setStartDate] = useState(getLocalDateKey());
  const [endDate, setEndDate] = useState(getLocalDateKey());
  const [filterCategory, setFilterCategory] = useState("all");

  const getFilteredData = () => {
    return history.filter((h) => {
      const date =
        h.data.targetDate || getLocalDateKey(new Date(h.data.timestamp));

      const dateValid = date >= startDate && date <= endDate;
      if (!dateValid) return false;

      if (filterCategory === "all") return true;
      if (filterCategory === "gym" && h.type === "gym_set") return true;
      if (filterCategory === "metrics" && h.type === "daily_metrics") return true;
      if (filterCategory === "nutrition" && h.type === "nutrition") return true;
      if (filterCategory === "gut" && h.type === "gut") return true;
      if (filterCategory === "labs" && h.type === "lab_result") return true;

      return false;
    });
  };

  const handleDownloadCSV = () => {
    const rawData = getFilteredData();
    if (rawData.length === 0) {
      alert("No data to export.");
      return;
    }
    const rows = [];

    // Header - Expanded
    rows.push("Date,Time,Category,Item,Value,Notes");

    rawData.forEach((h) => {
      const date =
        h.data.targetDate || getLocalDateKey(new Date(h.data.timestamp));
      const time = new Date(h.data.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      if (h.type === "gym_set") {
        rows.push(
          [
            date,
            time,
            "Gym",
            `"${h.data.exercise}"`,
            `"${h.data.weight}kg"`,
            `"${h.data.sets} sets x ${h.data.reps} reps"`,
          ].join(",")
        );
      } else if (h.type === "daily_metrics") {
        // Standard Metrics
        if (h.data.mood) rows.push([date, time, "Metrics", "Mood", h.data.mood, ""].join(","));
        if (h.data.sleepQuality) rows.push([date, time, "Metrics", "Sleep", h.data.sleepQuality, ""].join(","));

        // Expanded Metrics (Deep Health)
        if (h.data.weight) rows.push([date, time, "Body Comp", "Weight", `${h.data.weight}kg`, ""].join(","));
        if (h.data.bodyFat) rows.push([date, time, "Body Comp", "Body Fat", `${h.data.bodyFat}%`, ""].join(","));
        if (h.data.steps) rows.push([date, time, "Activity", "Steps", h.data.steps, ""].join(","));
        if (h.data.hrv) rows.push([date, time, "Heart", "HRV", `${h.data.hrv}ms`, ""].join(","));
        if (h.data.restingHeartRate) rows.push([date, time, "Heart", "RHR", `${h.data.restingHeartRate}bpm`, ""].join(","));

      } else if (h.type === "nutrition") {
        // Nutrition Data
        if (h.data.calories) rows.push([date, time, "Nutrition", "Calories", h.data.calories, ""].join(","));
        if (h.data.protein) rows.push([date, time, "Nutrition", "Protein", `${h.data.protein}g`, ""].join(","));

      } else if (h.type === "lab_result") {
        rows.push([date, time, "Labs", h.data.panel || "General", `${h.data.marker}: ${h.data.value} ${h.data.unit}`, h.data.status || ""].join(","));

      } else if (h.type === "gratitude") {
        rows.push([date, time, "Gratitude", "Entry", `"${h.data.text.replace(/"/g, '""')}"`, ""].join(","));
      } else if (h.type === "gut") {
        rows.push([date, time, "Gut", `"Bristol Type ${h.data.type}"`, `"${(h.data.symptoms || []).join(", ")}"`, `"${(h.data.notes || "").replace(/"/g, '""')}"`].join(","));
      } else if (h.type === "habits") {
        const completed = h.data.completed || [];
        completed.forEach((habitId) => {
          const found = habitsList.find((h) => h.id === habitId);
          if (found) {
            rows.push([date, time, "Habit", found.label, "Completed", ""].join(","));
          }
        });
      }
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `biosync_export_${filterCategory}_${startDate}_to_${endDate}.csv`;
    link.click();
  };

  const handleDownloadMD = () => {
    const rawData = getFilteredData().sort((a, b) => {
      const dateA = a.data.targetDate || a.data.timestamp;
      const dateB = b.data.targetDate || b.data.timestamp;
      return dateA.localeCompare(dateB);
    });

    if (rawData.length === 0) {
      alert("No data.");
      return;
    }

    let md = `# BioSync Master Dossier\n`;
    md += `**Date Range:** ${startDate} to ${endDate}\n`;
    md += `**Generated:** ${new Date().toLocaleDateString()}\n\n`;

    const labs = rawData.filter(d => d.type === "lab_result");
    if (labs.length > 0) {
      md += `## 1. Laboratory Dashboard\n`;
      md += `| Date | Panel | Marker | Value | Status |\n`;
      md += `|---|---|---|---|---|\n`;
      labs.forEach((l) => {
        const date = l.data.targetDate || getLocalDateKey(new Date(l.data.timestamp));
        md += `| ${date} | ${l.data.panel || '-'} | ${l.data.marker} | ${l.data.value} ${l.data.unit} | ${l.data.status || ''} |\n`;
      });
      md += `\n`;
    }

    const metrics = rawData.filter(d => d.type === "daily_metrics");
    if (metrics.length > 0) {
      md += `## 2. Daily Vitals Matrix\n`;
      md += `| Date | Weight | BF% | Steps | HRV | Sleep |\n`;
      md += `|---|---|---|---|---|---|\n`;
      const grouped = {};
      metrics.forEach(m => {
        const date = m.data.targetDate || getLocalDateKey(new Date(m.data.timestamp));
        if (!grouped[date]) grouped[date] = { weight: '-', bf: '-', steps: '-', hrv: '-', sleep: '-' };
        if (m.data.weight) grouped[date].weight = m.data.weight + 'kg';
        if (m.data.bodyFat) grouped[date].bf = m.data.bodyFat + '%';
        if (m.data.steps) grouped[date].steps = m.data.steps.toLocaleString();
        if (m.data.hrv) grouped[date].hrv = m.data.hrv + 'ms';
        if (m.data.sleepScore) grouped[date].sleep = m.data.sleepScore;
        else if (m.data.sleepQuality) grouped[date].sleep = m.data.sleepQuality;
      });

      Object.keys(grouped).sort().forEach(date => {
        const g = grouped[date];
        md += `| ${date} | ${g.weight} | ${g.bf} | ${g.steps} | ${g.hrv} | ${g.sleep} |\n`;
      });
      md += `\n`;
    }

    md += `## 3. Daily Activity Log\n`;
    const others = rawData.filter(d => ["nutrition", "gym_set", "gut"].includes(d.type));
    let currentDate = "";

    others.forEach(h => {
      const date = h.data.targetDate || getLocalDateKey(new Date(h.data.timestamp));
      if (date !== currentDate) {
        md += `\n### ${date}\n`;
        currentDate = date;
      }

      if (h.type === "gym_set") {
        md += `- **[Gym]** ${h.data.exercise}: ${h.data.weight}kg ${h.data.sets}x${h.data.reps}\n`;
      } else if (h.type === "nutrition") {
        md += `- **[Nutri]** ${h.data.calories}kcal (P:${h.data.protein}g C:${h.data.carbs}g F:${h.data.fat}g)\n`;
        if (h.data.foodLog) md += `  > *${h.data.foodLog}*\n`;
      } else if (h.type === "gut") {
        md += `- **[Gut]** Type ${h.data.type} (${(h.data.symptoms || []).join(", ")}) ${h.data.notes ? "- " + h.data.notes : ""}\n`;
      }
    });

    const blob = new Blob([md], { type: "text/markdown" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `biosync_dossier_${endDate}.md`;
    link.click();
  };

  const categories = [
    { id: "all", label: "All" },
    { id: "gym", label: "Gym" },
    { id: "metrics", label: "Body" },
    { id: "nutrition", label: "Food" },
    { id: "labs", label: "Labs" },
  ];

  return (
    <div className="pb-32 bg-slate-50 min-h-screen">
      <Header
        title="Data"
        subtitle="Export workout history"
        colorClass="text-slate-800"
      />
      <div className="px-5 mt-6 max-w-md mx-auto space-y-6">

        {/* Date Range Selectors */}
        <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-400">From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full text-sm font-medium mt-1" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-400">To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full text-sm font-medium mt-1" />
            </div>
          </div>
        </section>

        {/* Filter Buttons */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 ml-1">Filter Report</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setFilterCategory(c.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${filterCategory === c.id ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="flex gap-2 mb-4">
            <button onClick={handleDownloadCSV} className="flex-1 bg-slate-800 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2">
              <Download size={18} /> Export CSV
            </button>
            <button onClick={handleDownloadMD} className="flex-1 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-200">
              <ClipboardCopy size={18} /> Master Dossier
            </button>
          </div>

          <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={16} className="text-orange-500" />
              <span className="font-bold text-sm text-orange-700">Records</span>
            </div>
            <Records history={history} habitsList={habitsList} />
          </div>
        </section>

        {/* Gratitude Log */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 ml-1 flex items-center">
            <Book size={14} className="mr-2" /> Gratitude Notebook
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {history
              .filter((h) => h.type === "gratitude")
              .map((e) => (
                <div
                  key={e.id}
                  className="p-4 bg-amber-50/40 border border-amber-100 rounded-2xl"
                >
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-xs font-bold text-amber-600">
                      {new Date(e.data.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 italic">
                    "{e.data.text}"
                  </p>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("home"); // Default to HOME
  const [history, setHistory] = useState([]);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [habitsList, setHabitsList] = useState(DEFAULT_HABITS);
  const [authCompleted, setAuthCompleted] = useState(false);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      if (!u) signInAnonymously(auth);
      setUser(u);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "entries"));
    return onSnapshot(q, (s) =>
      setHistory(
        s.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort(
            (a, b) => new Date(b.data.timestamp) - new Date(a.data.timestamp)
          )
      )
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid, "config", "weekly_schedule")).then(
      (s) => s.exists() && setSchedule(s.data().schedule)
    );
    getDoc(doc(db, "users", user.uid, "config", "habits_list")).then(
      (s) => s.exists() && setHabitsList(s.data().list)
    );
  }, [user]);

  const saveEntry = async (t, d) => {
    if (user)
      await addDoc(collection(db, "users", user.uid, "entries"), {
        type: t,
        data: d,
        createdAt: serverTimestamp(),
      });
  };
  const updateEntry = async (id, d) => {
    if (user)
      await updateDoc(doc(db, "users", user.uid, "entries", id), { data: d });
  };
  const deleteEntry = async (id) => {
    if (user) await deleteDoc(doc(db, "users", user.uid, "entries", id));
  };
  const saveSchedule = async (s) => {
    if (user) {
      await setDoc(doc(db, "users", user.uid, "config", "weekly_schedule"), {
        schedule: s,
      });
      setSchedule(s);
    }
  };
  const saveHabitsList = async (l) => {
    if (user) {
      await setDoc(doc(db, "users", user.uid, "config", "habits_list"), {
        list: l,
      });
      setHabitsList(l);
    }
  };
  const handleLogout = () => signOut(auth).then(() => setAuthCompleted(false));

  const isAnonymous = user?.isAnonymous;
  const showLockScreen =
    (isAnonymous && !authCompleted) || (!user && !authCompleted);

  if (showLockScreen) {
    return <AuthView onComplete={() => setAuthCompleted(true)} />;
  }

  return (
    <div className="font-sans text-slate-900">
      {activeTab === "home" && (
        <HomeView user={user} history={history} setActiveTab={setActiveTab} />
      )}
      {activeTab === "experience" && (
        <ExperienceView
          user={user}
          saveEntry={saveEntry}
          history={history}
          updateEntry={updateEntry}
          onLogout={handleLogout}
        />
      )}
      {activeTab === "habits" && (
        <HabitsView
          user={user}
          saveEntry={saveEntry}
          history={history}
          habitsList={habitsList}
          saveHabitsList={saveHabitsList}
        />
      )}
      {activeTab === "ai" && (
        <AICoachView history={history} saveEntry={saveEntry} user={user} />
      )}
      {activeTab === "gut" && (
        <GutView
          user={user}
          saveEntry={saveEntry}
          history={history}
          deleteEntry={deleteEntry}
        />
      )}
      {activeTab === "gym" && (
        <GymView
          user={user}
          saveEntry={saveEntry}
          history={history}
          saveSchedule={saveSchedule}
          currentSchedule={schedule}
          deleteEntry={deleteEntry}
        />
      )}
      {activeTab === "report" && (
        <ReportView
          user={user}
          history={history}
          saveEntry={saveEntry}
          habitsList={habitsList}
        />
      )}
      <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
