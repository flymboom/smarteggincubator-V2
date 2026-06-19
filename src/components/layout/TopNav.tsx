import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { ref, onValue } from "firebase/database";
import { User, LogOut, Menu, Sun, Moon, Monitor } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../../lib/ThemeProvider";

const getPageTitle = (pathname: string) => {
  switch (pathname) {
    case "/":
      return "Dashboard";
    case "/history":
      return "Historical Data";
    case "/status":
      return "System Status";
    case "/livecam":
      return "Live Camera";
    case "/users":
      return "User Management";
    default:
      return "Smart Egg Incubator";
  }
};

interface TopNavProps {
  onToggleMenu: () => void;
}

export function TopNav({ onToggleMenu }: TopNavProps) {
  const [firstName, setFirstName] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Fetch user profile from RTDB
        const userRef = ref(db, `users/${user.uid}`);
        const unsubscribeDb = onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          if (data && data.firstName) {
            setFirstName(data.firstName);
          } else {
            setFirstName(null);
          }
        });

        return () => unsubscribeDb();
      } else {
        setFirstName(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <header className="h-20 border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl sticky top-0 z-40 flex items-center justify-between px-4 lg:px-10 w-full transition-colors duration-300">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleMenu}
          className="p-2 -ml-2 lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white transition-colors">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Theme Toggle */}
        <div className="relative">
          <button
            onClick={() => {
              setThemeDropdownOpen(!themeDropdownOpen);
              setDropdownOpen(false);
            }}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Sun className="w-5 h-5" /> : theme === 'dark' ? <Moon className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>
          
          {themeDropdownOpen && (
            <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 z-50 transition-colors">
              <button
                onClick={() => { setTheme('system'); setThemeDropdownOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${theme === 'system' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                <Monitor className="w-4 h-4" /> System
              </button>
              <button
                onClick={() => { setTheme('light'); setThemeDropdownOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${theme === 'light' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                <Sun className="w-4 h-4" /> Light
              </button>
              <button
                onClick={() => { setTheme('dark'); setThemeDropdownOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${theme === 'dark' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                <Moon className="w-4 h-4" /> Dark
              </button>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
              setThemeDropdownOpen(false);
            }}
            className="flex items-center gap-3 p-1.5 sm:pr-4 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 border border-gray-200 dark:border-gray-600/50"
          >
            <div className="w-9 h-9 bg-linear-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-inner">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="text-left hidden sm:block">
              <div
                className="text-sm font-semibold text-gray-900 dark:text-white leading-tight transition-colors"
                id="navUserEmail"
              >
                Hello, {firstName ? firstName : "User"}!
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium transition-colors">
                Administrator
              </div>
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 z-50 transition-colors">
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  navigate("/users");
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 transition-colors"
              >
                <User className="w-4 h-4" /> Profile Settings
              </button>
              <div className="h-px bg-gray-200 dark:bg-gray-700 my-1 transition-colors"></div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
