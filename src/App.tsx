/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FirebaseProvider, useFirebase } from './components/FirebaseProvider';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import { Building2 } from 'lucide-react';
import { motion } from 'motion/react';

function AppContent() {
  const { user, loading } = useFirebase();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="text-clinic-blue mb-4"
        >
          <Building2 size={36} className="animate-pulse" />
        </motion.div>
        <p className="text-xs text-slate-500 font-semibold tracking-wide font-mono uppercase">
          Initialisation du stock clinique...
        </p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <FirebaseProvider>
      <AppContent />
    </FirebaseProvider>
  );
}

