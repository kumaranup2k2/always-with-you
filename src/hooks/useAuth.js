import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase/config';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Online Presence Heartbeat
  useEffect(() => {
    if (!user?.uid) return;

    const uid = user.uid;
    const userDocRef = doc(db, 'users', uid);

    const updatePresence = async () => {
      try {
        await updateDoc(userDocRef, { lastActive: serverTimestamp() });
      } catch (e) { /* Fails silently if doc doesn't exist yet */ }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 60000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') updatePresence();
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.uid]);

  return { user, userProfile, authLoading };
}