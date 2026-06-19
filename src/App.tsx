import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ref, set } from 'firebase/database';
import { db } from './lib/firebase';
import { Layout } from './components/layout/Layout';
import { Egg } from 'lucide-react';
import { ThemeProvider } from './lib/ThemeProvider';

const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const LiveCam = lazy(() => import('./pages/LiveCam').then(m => ({ default: m.LiveCam })));
const UserManagement = lazy(() => import('./pages/UserManagement').then(m => ({ default: m.UserManagement })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const SystemStatus = lazy(() => import('./pages/SystemStatus').then(m => ({ default: m.SystemStatus })));
const History = lazy(() => import('./pages/History').then(m => ({ default: m.History })));

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500 rounded-2xl blur-xl opacity-40 animate-pulse"></div>
          <div className="relative w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Egg className="w-8 h-8 text-white animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-blue-400 tracking-widest uppercase">Incubating</p>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    // Globally ensure the camera stream is permanently active on ESP32
    set(ref(db, 'camera/controls/stream_active'), true);
  }, []);

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <BrowserRouter>
        <Suspense fallback={<FullScreenLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="livecam" element={<LiveCam />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="history" element={<History />} />
              <Route path="status" element={<SystemStatus />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
