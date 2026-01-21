import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";

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
  const [mode, setMode] = useState("login"); // 'login' or 'signup'
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        // Account Linking Strategy:
        // If user is currently anonymous, link the new email/password to this ID
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

        {mode === "signup" && (
          <button
            onClick={onComplete}
            className="mt-4 w-full text-xs text-slate-300 font-medium py-2"
          >
            Stay anonymous for now (Not recommended)
          </button>
        )}
      </div>
    </div>
  );
};

// --- App Navigation ---
const TabNav = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: "experience", icon: Heart, label: "Mood" },
    { id: "habits", icon: ListTodo, label: "Habits" },
    { id: "gut", icon: Brain, label: "Gut" },
    { id: "gym", icon: Dumbbell, label: "Gym" },
    { id: "report", icon: Book, label: "Report" },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-100 safe-area-pb z-50">
      <div className="flex justify-around items-center h-20 max-w-md mx-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all duration-300 ${
              activeTab === tab.id ? "text-cyan-600" : "text-slate-300"
            }`}
          >
            <div
              className={`p-1 rounded-xl transition-all ${
                activeTab === tab.id ? "bg-cyan-50 -translate-y-1" : ""
              }`}
            >
              <tab.icon
                size={24}
                strokeWidth={activeTab === tab.id ? 2.5 : 2}
              />
            </div>
            <span
              className={`text-[10px] font-bold ${
                activeTab === tab.id ? "opacity-100" : "opacity-0 hidden"
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

// --- View Implementation (Experience, Habits, Gut, Gym, Report) ---
// (Note: These views are identical to your existing logic but updated to use the production data model)

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
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                  form.mood === o.v
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

  const toggleHabit = (id) => {
    if (isEditMode) return;
    setLocalCompleted((prev) => {
      const n = prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id];
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
        subtitle="Consistency builds identity"
        colorClass="text-teal-600"
        rightElement={
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`p-2 rounded-lg ${
              isEditMode
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
            return (
              <div
                key={h.id}
                onClick={() => !isEditing && toggleHabit(h.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                  isDone && !isEditMode
                    ? "bg-white border-teal-200 shadow-sm"
                    : "bg-white border-slate-100"
                }`}
              >
                <div className="flex-1 flex items-center space-x-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                      isDone && !isEditMode ? "bg-teal-50" : "bg-slate-50"
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
                    <span
                      className={`font-bold text-lg ${
                        isDone && !isEditMode
                          ? "text-slate-800"
                          : "text-slate-500"
                      }`}
                    >
                      {h.label}
                    </span>
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
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        isDone
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
              className="flex-1 p-3 bg-white rounded-xl border border-slate-200 outline-none"
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
        subtitle="Track digestion"
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
              Today
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
          <h3 className="font-bold text-slate-700 mb-4">Bristol Scale</h3>
          <div className="flex justify-between gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`flex-1 h-12 rounded-lg font-bold text-sm transition-all ${
                  selectedType === t
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
                className={`px-4 py-2 rounded-full text-xs font-bold ${
                  symptoms.includes(s)
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
            placeholder="Notes"
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
          subtitle="Modify schedule"
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
            Save Changes
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
          <h3 className="text-xs font-bold text-cyan-600 uppercase mb-3">
            Today's Plan
          </h3>
          <div className="flex flex-col gap-2">
            {todaysPlan.exercises.map((ex, i) => (
              <button
                key={i}
                onClick={() => loadPreviousStats(ex.name || ex)}
                className={`flex justify-between px-3 py-3 border rounded-xl transition-all text-left ${
                  exercise === (ex.name || ex)
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
                Editing...
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
            className={`w-full mt-4 py-4 text-white rounded-xl font-bold shadow-lg ${
              editingLogId ? "bg-amber-500" : "bg-cyan-600"
            }`}
          >
            {editingLogId ? "Update" : "Log Set"}
          </button>
        </div>
        <div className="mt-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 ml-1">
            Today's Log
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

const ReportView = ({ user, history }) => {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return getLocalDateKey(d);
  });
  const [endDate, setEndDate] = useState(getLocalDateKey());

  const getFilteredData = () =>
    history
      .filter((item) => {
        const date =
          item.data.targetDate ||
          getLocalDateKey(new Date(item.data.timestamp));
        return date >= startDate && date <= endDate;
      })
      .sort((a, b) =>
        (b.data.targetDate || "").localeCompare(a.data.targetDate || "")
      );
  const handleDownloadCSV = () => {
    const rawData = getFilteredData();
    if (rawData.length === 0) {
      alert("No data.");
      return;
    }
    const rows = rawData.map((h) => {
      let details = "",
        val1 = "";
      if (h.type === "gym_set") {
        details = h.data.exercise;
        val1 = `${h.data.weight}kg ${h.data.sets}x${h.data.reps}`;
      } else if (h.type === "daily_metrics") {
        details = "Check-in";
        val1 = `Mood:${h.data.mood} Sleep:${h.data.sleepQuality}`;
      } else if (h.type === "gratitude") {
        details = "Gratitude";
        val1 = h.data.text;
      } else if (h.type === "gut") {
        details = `Type ${h.data.type}`;
        val1 = (h.data.symptoms || []).join(" ");
      }
      return [h.data.targetDate, h.type, `"${details}"`, `"${val1}"`].join(",");
    });
    const blob = new Blob(["Date,Category,Details,Value\n" + rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `biosync_export.csv`;
    link.click();
  };

  return (
    <div className="pb-32 bg-slate-50 min-h-screen">
      <Header
        title="Data"
        subtitle="Export history"
        colorClass="text-slate-800"
      />
      <div className="px-5 mt-6 max-w-md mx-auto space-y-6">
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 ml-1 flex items-center">
            <Book size={14} className="mr-2" /> Gratitude Notebook
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {history
              .filter((h) => h.type === "gratitude")
              .map((e) => (
                <Card
                  key={e.id}
                  className="p-4 bg-amber-50/40 border-amber-100"
                >
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-xs font-bold text-amber-600">
                      {new Date(e.data.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 italic">
                    "{e.data.text}"
                  </p>
                </Card>
              ))}
          </div>
        </section>
        <Card className="p-5 mt-6">
          <div className="flex space-x-3">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold text-slate-600"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold text-slate-600"
            />
          </div>
        </Card>
        <button
          onClick={handleDownloadCSV}
          className="w-full py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl font-bold flex justify-center items-center space-x-2"
        >
          <Download size={20} /> <span>Download CSV</span>
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("experience");
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

  // Determine if we should show the Lock screen
  // We show it if the user is anonymous AND hasn't "skipped" or if they just want to log in
  const isAnonymous = user?.isAnonymous;
  const showLockScreen =
    (isAnonymous && !authCompleted) || (!user && !authCompleted);

  if (showLockScreen) {
    return <AuthView onComplete={() => setAuthCompleted(true)} />;
  }

  return (
    <div className="font-sans text-slate-900">
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
        <ReportView user={user} history={history} saveEntry={saveEntry} />
      )}
      <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
