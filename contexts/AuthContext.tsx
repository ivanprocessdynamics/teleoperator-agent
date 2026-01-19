"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";

type UserRole = "superadmin" | "admin" | "visitor";

interface UserData {
    uid: string;
    email: string | null;
    role: UserRole;
    current_workspace_id?: string;
}

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Guard against uninitialized auth (e.g. missing env vars during build/dev)
        if (!auth || (typeof auth === 'object' && Object.keys(auth).length === 0)) {
             setTimeout(() => setLoading(false), 0);
             return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (currentUser: User | null) => {
            setUser(currentUser);
            if (currentUser) {
                // Sync user with Firestore
                const userRef = doc(db, "users", currentUser.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    setUserData(userSnap.data() as UserData);
                } else {
                    // New user, create as Visitor by default
                    const newUserData: UserData = {
                        uid: currentUser.uid,
                        email: currentUser.email,
                        role: "visitor",
                    };
                    await setDoc(userRef, newUserData);
                    setUserData(newUserData);
                }
            } else {
                setUserData(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Error signing in with Google", error);
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, userData, loading, signInWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
