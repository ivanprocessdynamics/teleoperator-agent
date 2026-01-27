"use client";

import { StatsDashboard } from "@/components/stats/StatsDashboard";
import { useEffect, useState } from "react";
import { collection, query, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function GlobalStatsPage() {
    const [subworkspaceId, setSubworkspaceId] = useState<string>("");

    useEffect(() => {
        // Fetch the first available subworkspace to use as context for saving config
        const fetchContext = async () => {
            try {
                const q = query(collection(db, "subworkspaces"), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setSubworkspaceId(snap.docs[0].id);
                }
            } catch (err) {
                console.error("Error fetching global context:", err);
            }
        };
        fetchContext();
    }, []);

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estadísticas Globales</h1>
            {/* Pass subworkspaceId to enable Hide/Delete actions even in Global View */}
            <StatsDashboard subworkspaceId={subworkspaceId} />
        </div>
    );
}
