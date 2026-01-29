"use client";

import { StatsDashboard } from "@/components/stats/StatsDashboard";
import { useEffect, useState } from "react";
import { collection, query, limit, getDocs, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export default function GlobalStatsPage() {
    const { userData } = useAuth();
    const [subworkspaceId, setSubworkspaceId] = useState<string>("");

    useEffect(() => {
        const fetchContext = async () => {
            if (!userData?.uid) return;

            try {
                // 1. Get workspaces owned by current user (or impersonated)
                const workspacesQuery = query(
                    collection(db, "workspaces"),
                    where("owner_uid", "==", userData.uid)
                );
                const wsSnap = await getDocs(workspacesQuery);
                const workspaceIds = wsSnap.docs.map(d => d.id);

                if (workspaceIds.length === 0) return;

                // 2. Get first subworkspace from any of these workspaces
                // Note: Firestore 'in' query supports up to 10 items. 
                // If user has many workspaces, we might need to loop or change this. 
                // For now, checking the first workspace's subworkspaces is a safe bet for context.

                // Let's try to get subworkspaces for the most recent workspace (first in sorted list usually, but here we just take the first)
                const firstWorkspaceId = workspaceIds[0];

                const q = query(
                    collection(db, "subworkspaces"),
                    where("workspace_id", "==", firstWorkspaceId),
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
    }, [userData]);

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estadísticas Globales</h1>
            {/* Pass subworkspaceId to enable Hide/Delete actions even in Global View */}
            <StatsDashboard subworkspaceId={subworkspaceId} />
        </div>
    );
}
