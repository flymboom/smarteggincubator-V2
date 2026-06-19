import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { ref, get, set } from "firebase/database";
import {
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  User as UserIcon,
} from "lucide-react";

export function Login() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (!user.emailVerified) {
          setError({
            message:
              "Please verify your email address to access the dashboard. Check your inbox.",
            type: "error",
          });
          auth.signOut();
          return;
        }

        const redirectUrl = searchParams.get("redirect");
        if (redirectUrl) {
          // navigate(redirectUrl);
          window.location.replace(redirectUrl);
        } else {
          // navigate('/');
          window.location.replace("/");
        }
      }
    });
    return () => unsubscribe();
  }, [searchParams]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError({
        message: "Please fill in all required fields.",
        type: "error",
      });
      return;
    }

    if (!isLoginMode) {
      if (!firstName || !lastName || !username) {
        setError({
          message: "Please fill in your name and username.",
          type: "error",
        });
        return;
      }

      const usernameRegex = /^[a-z0-9][a-z0-9._\-@]*$/;
      if (!usernameRegex.test(username)) {
        setError({
          message:
            "Username must be lowercase, start with a letter/number, and only contain letters, numbers, and [._-@]",
          type: "error",
        });
        return;
      }

      if (password !== retypePassword) {
        setError({ message: "Passwords do not match.", type: "error" });
        return;
      }

      const passwordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?]).{8,}$/;
      if (!passwordRegex.test(password)) {
        setError({
          message:
            "Password must be at least 8 characters long and contain at least 1 uppercase, 1 lowercase, 1 number, and 1 symbol.",
          type: "error",
        });
        return;
      }
    }

    setLoading(true);

    try {
      // Set session persistence based on "Remember me"
      const persistenceType = rememberMe
        ? browserLocalPersistence
        : browserSessionPersistence;
      await setPersistence(auth, persistenceType);

      if (isLoginMode) {
        let loginEmail = email;

        // If it doesn't look like an email but matches username regex, try to resolve it
        if (!email.includes("@") || /^[a-z0-9][a-z0-9._\-@]*$/.test(email)) {
          const safeKey = email.replace(/\./g, ",");
          const usernameRef = ref(db, `usernames/${safeKey}`);
          const snapshot = await get(usernameRef);
          if (snapshot.exists()) {
            loginEmail = snapshot.val();
          }
        }

        await signInWithEmailAndPassword(auth, loginEmail, password);
      } else {
        // Check if username is already taken
        const safeUsername = username.replace(/\./g, ",");
        const usernameRef = ref(db, `usernames/${safeUsername}`);
        const snapshot = await get(usernameRef);
        if (snapshot.exists()) {
          setError({
            message: "Username is already taken. Please choose another one.",
            type: "error",
          });
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );

        // Save user profile to RTDB
        const uid = userCredential.user.uid;
        await set(ref(db, `users/${uid}`), {
          firstName,
          lastName,
          username,
          email,
        });
        // Reserve username
        await set(ref(db, `usernames/${safeUsername}`), email);

        await sendEmailVerification(userCredential.user);
        setError({
          message:
            "Registration successful! Please check your email to verify your account before logging in.",
          type: "success",
        });
        await auth.signOut();
        setIsLoginMode(true);
        setPassword("");
        setRetypePassword("");
        setFirstName("");
        setLastName("");
        setUsername("");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError({ message: err.message, type: "error" });
      } else {
        setError({ message: "An unexpected error occurred", type: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      setResetStatus({
        message: "Please enter your email address.",
        type: "error",
      });
      return;
    }

    setResetLoading(true);
    setResetStatus(null);

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetStatus({
        message: "Password reset email sent! Please check your inbox.",
        type: "success",
      });
      setTimeout(() => setShowForgotModal(false), 3000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setResetStatus({ message: err.message, type: "error" });
      } else {
        setResetStatus({
          message: "An unexpected error occurred",
          type: "error",
        });
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-lg border border-gray-200 dark:border-gray-700 w-full max-w-md relative z-10 transition-colors">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-xl mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
            {isLoginMode ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 transition-colors">
            {isLoginMode
              ? "Sign in to access your dashboard"
              : "Register a new account to continue"}
          </p>
        </div>

        {error && (
          <div
            className={`mb-4 p-3 rounded border text-sm text-center ${
              error.type === "error"
                ? "bg-red-500/10 border-red-500 text-red-500"
                : "bg-green-500/10 border-green-500 text-green-500"
            }`}
          >
            {error.message}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          {!isLoginMode && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                  Username <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="johndoe"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
              {isLoginMode ? "Email or Username" : "Email"}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-gray-400 dark:text-gray-500 transition-colors" />
              </div>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder={
                  isLoginMode ? "you@example.com or johndoe" : "you@example.com"
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-gray-400 dark:text-gray-500 transition-colors" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {!isLoginMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                Retype Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400 dark:text-gray-500 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  value={retypePassword}
                  onChange={(e) => setRetypePassword(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          {isLoginMode && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center justify-center w-5 h-5">
                  <input
                    type="checkbox"
                    className="peer appearance-none w-5 h-5 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900 checked:bg-blue-600 checked:border-blue-600 transition-colors cursor-pointer"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 peer-checked:opacity-100 pointer-events-none text-white">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-300 transition-colors select-none">
                  Remember me
                </span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setShowForgotModal(true);
                  setResetStatus(null);
                }}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            <span>
              {loading ? "Processing..." : isLoginMode ? "Sign In" : "Sign Up"}
            </span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 transition-colors">
          <span>
            {isLoginMode
              ? "Don't have an account?"
              : "Already have an account?"}
          </span>
          <button
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setError(null);
            }}
            className="text-blue-400 hover:text-blue-300 font-medium ml-1 transition-colors"
          >
            {isLoginMode ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm overflow-hidden shadow-2xl transition-colors">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 transition-colors">
                Reset Password
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 transition-colors">
                Enter your email address and we'll send you a link to reset your
                password.
              </p>

              {resetStatus && (
                <div
                  className={`mb-4 p-3 rounded border text-sm ${
                    resetStatus.type === "error"
                      ? "bg-red-500/10 border-red-500 text-red-500"
                      : "bg-green-500/10 border-green-500 text-green-500"
                  }`}
                >
                  {resetStatus.message}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                  Email Address
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  className={`flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors ${resetLoading ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  {resetLoading ? "Sending..." : "Send Link"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
