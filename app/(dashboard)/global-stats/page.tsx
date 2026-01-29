"use client";

import { StatsDashboard } from "@/components/stats/StatsDashboard";
import { useEffect, useState } from "react";
import { collection, query, limit, getDocs, where, collectionGroup } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export default function GlobalStatsPage() {
    const { userData } = useAuth();
    const [subworkspaceId, setSubworkspaceId] = useState<string>("");
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>("");

    useEffect(() => {
        // Check localStorage for selected workspace
        const storedWorkspaceId = localStorage.getItem("selectedWorkspaceId");
        if (storedWorkspaceId) {
            setCurrentWorkspaceId(storedWorkspaceId);
        }

        // Listen for storage changes (when user switches workspace in another tab)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "selectedWorkspaceId" && e.newValue) {
                setCurrentWorkspaceId(e.newValue);
            }
        };

        // Listen for custom event (when user switches workspace in same tab)
        const handleWorkspaceChanged = (e: CustomEvent) => {
            setCurrentWorkspaceId(e.detail);
        };

        window.addEventListener("storage", handleStorageChange);
        window.addEventListener("workspaceChanged", handleWorkspaceChanged as EventListener);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
            window.removeEventListener("workspaceChanged", handleWorkspaceChanged as EventListener);
        };
    }, []);

    useEffect(() => {
        const fetchContext = async () => {
            if (!userData?.uid) return;

            // Use the selected workspace or find user's first workspace
            let targetWorkspaceId = currentWorkspaceId;

            if (!targetWorkspaceId) {
                // Fallback: get user's first owned workspace or first membership
                try {
                    // Check owned workspaces first
                    const ownedQuery = query(
                        collection(db, "workspaces"),
                        where("owner_uid", "==", userData.uid),
                        limit(1)
                    );
                    const ownedSnap = await getDocs(ownedQuery);

                    if (!ownedSnap.empty) {
                        targetWorkspaceId = ownedSnap.docs[0].id;
                    } else {
                        // Check memberships
                        const memberQuery = query(
                            collectionGroup(db, "members"),
                            where("uid", "==", userData.uid)
                        );
                        const memberSnap = await getDocs(memberQuery);
                        if (!memberSnap.empty) {
                            const parentRef = memberSnap.docs[0].ref.parent.parent;
                            if (parentRef) {
                                targetWorkspaceId = parentRef.id;
                            }
                        }
                    }

                    if (targetWorkspaceId) {
                        setCurrentWorkspaceId(targetWorkspaceId);
                        localStorage.setItem("selectedWorkspaceId", targetWorkspaceId);
                    }
                } catch (err) {
                    console.error("Error finding workspace:", err);
                }
            }

            if (!targetWorkspaceId) return;

            try {
                // Get first subworkspace from this workspace
                const q = query(
                    collection(db, "subworkspaces"),
                    where("workspace_id", "==", targetWorkspaceId),
                    limit(1)
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setSubworkspaceId(snap.docs[0].id);
                }
            } catch (err) {
                console.error("Error fetching global context:", err);
            }
        };
        fetchContext();
    }, [userData, currentWorkspaceId]);

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estadísticas Globales</h1>
            {/* Pass workspaceId to filter stats by selected workspace */}
            <StatsDashboard subworkspaceId={subworkspaceId} workspaceId={currentWorkspaceId} />
        </div>
    );
}

