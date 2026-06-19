import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { AuthRoute } from "./AuthRoute";
import { useState, useEffect, Suspense } from "react";
import { Egg, User as UserIcon, X, AlertCircle } from "lucide-react";
import { auth, db } from "../../lib/firebase";
import { ref, get, set } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500 rounded-2xl blur-xl opacity-40 animate-pulse"></div>
          <div className="relative w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Egg className="w-8 h-8 text-white animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-blue-400 tracking-widest uppercase">
            Incubating
          </p>
          <div className="flex gap-1">
            <div
              className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            ></div>
            <div
              className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            ></div>
            <div
              className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu when route changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Profile completion check
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [profFirstName, setProfFirstName] = useState("");
  const [profLastName, setProfLastName] = useState("");
  const [profUsername, setProfUsername] = useState("");
  const [profError, setProfError] = useState("");
  const [profLoading, setProfLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userRef = ref(db, `users/${user.uid}`);
        get(userRef)
          .then((snapshot) => {
            const data = snapshot.val();
            if (!data || !data.username) {
              // Check if dismissed in this session
              if (!sessionStorage.getItem("profileModalDismissed")) {
                setShowProfileModal(true);
              }
            }
          })
          .catch(() => {
            // Ignore errors
          });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfError("");

    if (!profFirstName || !profLastName || !profUsername) {
      setProfError("All fields are required.");
      return;
    }

    const usernameRegex = /^[a-z0-9][a-z0-9._\-@]*$/;
    if (!usernameRegex.test(profUsername)) {
      setProfError(
        "Username must be lowercase, start with a letter/number, and contain only allowed symbols.",
      );
      return;
    }

    if (!auth.currentUser) return;

    setProfLoading(true);
    try {
      const safeUsername = profUsername.replace(/\./g, ",");
      const usernameRef = ref(db, `usernames/${safeUsername}`);
      const snapshot = await get(usernameRef);
      if (snapshot.exists()) {
        setProfError("Username is already taken. Please choose another one.");
        setProfLoading(false);
        return;
      }

      const uid = auth.currentUser.uid;
      const email = auth.currentUser.email || "";

      // Update users node
      await set(ref(db, `users/${uid}`), {
        firstName: profFirstName,
        lastName: profLastName,
        username: profUsername,
        email: email,
      });

      // Update usernames node
      await set(ref(db, `usernames/${safeUsername}`), email);

      setShowProfileModal(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setProfError(err.message);
      } else {
        setProfError("An unexpected error occurred");
      }
    } finally {
      setProfLoading(false);
    }
  };

  const handleDismissModal = () => {
    sessionStorage.setItem("profileModalDismissed", "true");
    setShowProfileModal(false);
  };

  return (
    <AuthRoute>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 overflow-hidden relative transition-colors">
        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar wrapper to handle mobile sliding */}
        <div
          className={`
          fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        >
          <Sidebar onClose={() => setMobileMenuOpen(false)} />
        </div>

        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <TopNav onToggleMenu={() => setMobileMenuOpen(true)} />
          <div className="flex-1 p-4 lg:p-8 overflow-y-auto w-full">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        {/* Profile Completion Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-100 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-300 transition-colors">
              <button
                onClick={handleDismissModal}
                className="absolute top-4 right-4 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-6 sm:p-8">
                <div className="mb-6 text-center">
                  <div className="w-12 h-12 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">
                    Complete Your Profile
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
                    Welcome! We noticed you don't have a username yet. Please
                    set up your profile to enable username login.
                  </p>
                </div>

                {profError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>{profError}</p>
                  </div>
                )}

                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={profFirstName}
                        onChange={(e) => setProfFirstName(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={profLastName}
                        onChange={(e) => setProfLastName(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={profUsername}
                      onChange={(e) =>
                        setProfUsername(e.target.value.toLowerCase())
                      }
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="johndoe"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">
                      Only lowercase letters, numbers, and ._-@
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={profLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {profLoading ? "Saving..." : "Save Profile"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissModal}
                      className="w-full mt-2 bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium py-2 rounded-lg transition-colors text-sm"
                    >
                      I'll do this later
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthRoute>
  );
}
