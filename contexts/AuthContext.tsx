"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"; // Added updateDoc
import { auth, db, googleProvider } from "@/lib/firebase";

type UserRole = "superadmin" | "admin" | "member";

export interface UserData { // Exported for re-use
    uid: string;
    email: string | null;
    role: UserRole;
    current_workspace_id?: string;
    photoURL?: string;
    displayName?: string;
}

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;

    // Impersonation
    isImpersonating: boolean;
    startImpersonating: (uid: string) => Promise<void>;
    stopImpersonating: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Hardcoded Super Admin Email
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "cezarvalentinivan@gmail.com";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [originalUserData, setOriginalUserData] = useState<UserData | null>(null); // For impersonation
    const [loading, setLoading] = useState(true);

    const isImpersonating = !!originalUserData;

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser: User | null) => {
            setUser(currentUser);
            if (currentUser) {
                // Sync user with Firestore
                const userRef = doc(db, "users", currentUser.uid);
                const userSnap = await getDoc(userRef);

                let fetchedData: UserData;

                if (userSnap.exists()) {
                    fetchedData = userSnap.data() as UserData;
                } else {
                    // Check for invite (to allow user creation)
                    let role: UserRole | null = null;
                    let invitedWorkspaceId: string | undefined = undefined;
                    if (currentUser.email) {
                        try {
                            const inviteRef = doc(db, "invites", currentUser.email.toLowerCase());
                            const inviteSnap = await getDoc(inviteRef);

                            if (inviteSnap.exists()) {
                                const inviteData = inviteSnap.data();
                                role = inviteData.role as UserRole;
                                invitedWorkspaceId = inviteData.workspaceId;

                                // For NEW users: Auto-accept the invitation since they
                                // won't have access to the team page to accept manually
                                if (invitedWorkspaceId) {
                                    // Add user to workspace members
                                    await setDoc(doc(db, "workspaces", invitedWorkspaceId, "members", currentUser.uid), {
                                        uid: currentUser.uid,
                                        email: currentUser.email,
                                        role: role === 'superadmin' ? 'admin' : role,
                                        joined_at: new Date()
                                    });
                                }

                                // Mark invite as accepted
                                await updateDoc(inviteRef, {
                                    status: 'accepted',
                                    acceptedAt: new Date(),
                                    uid: currentUser.uid
                                });
                            }
                        } catch (error) {
                            console.error("Error checking invite:", error);
                        }
                    }

                    // STRICT WHITELIST CHECK
                    if (role) {
                        // User was invited, create account
                        // NOTE: Global role is set here. If it's a workspace invite, global role might differ?
                        // For now, assume if invited as 'member' to a workspace, they become a global 'member' (or 'visitor' previously)
                        // If we want them to be 'user' globally and 'member' locally, we need to decide on global roles.
                        // Keeping it simple: Invite sets INITIAL global role.
                        fetchedData = {
                            uid: currentUser.uid,
                            email: currentUser.email,
                            role: role,
                            current_workspace_id: invitedWorkspaceId
                        };
                        await setDoc(userRef, fetchedData);
                        setUserData(fetchedData);
                    } else if (currentUser.email === SUPER_ADMIN_EMAIL) {
                        // Exception for hardcoded Super Admin
                        fetchedData = {
                            uid: currentUser.uid,
                            email: currentUser.email,
                            role: 'superadmin',
                        };
                        await setDoc(userRef, fetchedData);
                        setUserData(fetchedData);
                    } else {
                        // NOT WHITELISTED
                        console.warn("User not on whitelist:", currentUser.email);
                        window.location.href = "/unauthorized";
                        // Do not set userData, so app stays in loading/unauth state or redirects
                        return;
                    }
                }

                // If existing user (fetchedData is set from "if" block above)
                if (userSnap.exists()) {
                    // Force Super Admin Role check for existing users too
                    if (currentUser.email === SUPER_ADMIN_EMAIL && fetchedData!.role !== 'superadmin') {
                        fetchedData!.role = 'superadmin';
                        await updateDoc(userRef, { role: 'superadmin' });
                    }
                    setUserData(fetchedData!);
                }

            } else {
                setUserData(null);
                setOriginalUserData(null); // Reset impersonation on logout
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
            setOriginalUserData(null); // Clear impersonation logic
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    const startImpersonating = async (targetUid: string) => {
        if (!userData || userData.role !== 'superadmin') return; // Only superadmin can impersonate

        setLoading(true);
        try {
            const targetUserRef = doc(db, "users", targetUid);
            const targetUserSnap = await getDoc(targetUserRef);

            if (targetUserSnap.exists()) {
                const targetData = targetUserSnap.data() as UserData;
                setOriginalUserData(userData); // Backup current admin data
                setUserData(targetData); // Switch context to target user
            } else {
                console.error("User to impersonate not found");
            }
        } catch (error) {
            console.error("Error starting impersonation:", error);
        } finally {
            setLoading(false);
        }
    };

    const stopImpersonating = async () => {
        if (originalUserData) {
            setUserData(originalUserData);
            setOriginalUserData(null);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            userData,
            loading,
            signInWithGoogle,
            logout,
            isImpersonating,
            startImpersonating,
            stopImpersonating
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
