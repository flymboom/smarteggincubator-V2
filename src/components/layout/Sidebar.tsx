import { NavLink } from "react-router-dom";
import {
  Home,
  History,
  Server,
  Camera,
  Users,
  LogOut,
  Egg,
  Save,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { auth, db } from "../../lib/firebase";
import { signOut } from "firebase/auth";
import { ref, get, push, serverTimestamp } from "firebase/database";
import { useState } from "react";
import { ChangelogModal } from "../ChangelogModal";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.replace("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleSaveHistory = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const snapshot = await get(ref(db, "incubator/sensors"));
      const data = snapshot.val() || {};

      await push(ref(db, "incubator/history"), {
        temperature: data.temperature || 0,
        humidity: data.humidity || 0,
        timestamp: serverTimestamp(),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("Save history error", err);
      alert("Error saving history to Firebase.");
    } finally {
      setIsSaving(false);
    }
  };

  const navItems = [
    { name: "Dashboard", path: "/", icon: Home },
    { name: "History", path: "/history", icon: History },
    { name: "System Status", path: "/status", icon: Server },
    { name: "Live Camera", path: "/livecam", icon: Camera },
    { name: "User Management", path: "/users", icon: Users },
  ];

  return (
    <div className="w-64 lg:w-20 hover:lg:w-64 group/sidebar bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen sticky top-0 flex flex-col transition-all duration-300 overflow-hidden z-50">
      <div className="h-20 px-4 lg:px-5 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
            <Egg className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col whitespace-nowrap overflow-hidden transition-all duration-300 lg:max-w-0 lg:opacity-0 group-hover/sidebar:lg:max-w-[200px] group-hover/sidebar:lg:opacity-100">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white bg-linear-to-r from-gray-900 to-gray-500 dark:from-white dark:to-gray-400 bg-clip-text leading-tight transition-colors">
              Smart Egg
            </h1>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 leading-tight tracking-wide transition-colors">
              Incubator
            </p>
            <button
              onClick={() => setShowChangelog(true)}
              className="text-xs font-mono text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left"
              title="View Release Notes"
            >
              v1.6.0
            </button>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 py-6 px-3 flex flex-col gap-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `w-full flex items-center justify-start gap-3 px-3 lg:px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? "bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white"
              }`
            }
            title={item.name}
            onClick={onClose}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="text-sm whitespace-nowrap overflow-hidden transition-all duration-300 lg:max-w-0 lg:opacity-0 group-hover/sidebar:lg:max-w-[150px] group-hover/sidebar:lg:opacity-100">
              {item.name}
            </span>
          </NavLink>
        ))}

        <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2 transition-colors">
          <button
            onClick={handleSaveHistory}
            disabled={isSaving}
            className="w-full flex items-center lg:justify-start justify-center gap-3 px-3 lg:px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors group disabled:opacity-70"
            title="Save Data to History"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 shrink-0 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-5 h-5 shrink-0" />
            ) : (
              <Save className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm whitespace-nowrap overflow-hidden transition-all duration-300 lg:max-w-0 lg:opacity-0 group-hover/sidebar:lg:max-w-[150px] group-hover/sidebar:lg:opacity-100">
              {isSaving
                ? "Saving..."
                : saveSuccess
                  ? "Saved!"
                  : "Save to History"}
            </span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center lg:justify-start justify-center gap-3 px-3 lg:px-4 py-3 bg-red-50 dark:bg-red-600/20 hover:bg-red-100 dark:hover:bg-red-600/40 text-red-600 dark:text-red-500 rounded-xl transition-colors group"
            title="Logout"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="text-sm whitespace-nowrap overflow-hidden transition-all duration-300 lg:max-w-0 lg:opacity-0 group-hover/sidebar:lg:max-w-[150px] group-hover/sidebar:lg:opacity-100">
              Logout
            </span>
          </button>
        </div>
      </nav>

      {showChangelog && (
        <ChangelogModal onClose={() => setShowChangelog(false)} />
      )}
    </div>
  );
}
