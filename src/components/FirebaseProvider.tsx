/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserRights } from '../types';

interface FirebaseContextType {
  user: FirebaseUser | SimulatedUser | null;
  userRights: UserRights | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  simulateUser: (role: 'super_admin' | 'admin', permissions: string[], email: string) => void;
  clearSimulation: () => void;
}

export interface SimulatedUser {
  uid: string;
  email: string;
  displayName: string;
  isSimulated: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | SimulatedUser | null>(null);
  const [userRights, setUserRights] = useState<UserRights | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulated, setSimulated] = useState<boolean>(false);

  // Authenticates and creates/merges rights in Firestore
  const syncUserRights = async (currentUser: FirebaseUser) => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        setUserRights(userDoc.data() as UserRights);
      } else {
        // Check if there is a pending invite for this email (formatted email)
        const emailSlug = currentUser.email?.replace(/[@.]/g, '_');
        const pendingRef = doc(db, 'users', `pending-${emailSlug}`);
        const pendingDoc = await getDoc(pendingRef);

        let initialRights: UserRights;

        // Bootstrap Super Admin or fetch pending invite
        if (currentUser.email === 'zoubeirsneni@gmail.com') {
          initialRights = {
            uid: currentUser.uid,
            email: currentUser.email,
            role: 'super_admin',
            permissions: ['Médical', 'Cuisine', 'Ménage', 'Entretien'],
            createdAt: serverTimestamp(),
          };
          await setDoc(userRef, initialRights);
          setUserRights(initialRights);
        } else if (pendingDoc.exists()) {
          const pendingData = pendingDoc.data();
          initialRights = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            role: pendingData.role || 'admin',
            permissions: pendingData.permissions || [],
            createdAt: serverTimestamp(),
          };
          await setDoc(userRef, initialRights);
          await deleteDoc(pendingRef); // Consume the invite
          setUserRights(initialRights);
        } else {
          // Standard register (needs attribution from Super Admin)
          initialRights = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            role: 'admin',
            permissions: [], // No rights by default
            createdAt: serverTimestamp(),
          };
          await setDoc(userRef, initialRights);
          setUserRights(initialRights);
        }
      }
    } catch (error) {
      console.error('Error syncing user rights:', error);
      // Fallback for demo if offline/firestore blocked
      if (currentUser.email === 'zoubeirsneni@gmail.com') {
        setUserRights({
          uid: currentUser.uid,
          email: currentUser.email,
          role: 'super_admin',
          permissions: ['Médical', 'Cuisine', 'Ménage', 'Entretien'],
          createdAt: new Date()
        });
      }
    }
  };

  useEffect(() => {
    if (simulated) return;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        await syncUserRights(currentUser);
      } else {
        setUser(null);
        setUserRights(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [simulated]);

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Ensure smooth popup login
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Core Google Login failed: ', error);
      alert("La connexion par Google a échoué. Utilisez la simulation d'accès pour tester l'application.");
    }
  };

  const logout = async () => {
    clearSimulation();
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Signout failed: ', error);
    }
  };

  // Helper method to simulate accounts to facilitate testing across multiple devices / profiles
  const simulateUser = (role: 'super_admin' | 'admin', permissions: string[], email: string) => {
    setSimulated(true);
    setLoading(true);

    const emailPrefix = email.split('@')[0];
    const mockUser: SimulatedUser = {
      uid: `simulated-${emailPrefix}`,
      email: email,
      displayName: `Simulé (${role === 'super_admin' ? 'Super Admin' : 'Admin'})`,
      isSimulated: true
    };

    setUser(mockUser);
    setUserRights({
      uid: mockUser.uid,
      email: mockUser.email,
      role: role,
      permissions: permissions,
      createdAt: new Date()
    });
    setLoading(false);
  };

  const clearSimulation = () => {
    setSimulated(false);
    setUser(null);
    setUserRights(null);
    setLoading(true);
    // Restart auth listener
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUser(currentUser);
      syncUserRights(currentUser).finally(() => setLoading(false));
    } else {
      setUser(null);
      setUserRights(null);
      setLoading(false);
    }
  };

  return (
    <FirebaseContext.Provider value={{
      user,
      userRights,
      loading,
      loginWithGoogle,
      logout,
      simulateUser,
      clearSimulation
    }}>
      {children}
    </FirebaseContext.Provider>
  );
}
