import { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { app } from './firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, [auth]);

  const signup = (email, password) => createUserWithEmailAndPassword(auth, email, password);
  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };
  const resendVerificationEmail = async () => {
    if (currentUser) {
      await sendEmailVerification(currentUser);
    }
  };

  const value = {
    currentUser,
    loading,
    signup,
    login,
    logout,
    resendVerificationEmail,
    emailVerified: currentUser?.emailVerified || false,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
