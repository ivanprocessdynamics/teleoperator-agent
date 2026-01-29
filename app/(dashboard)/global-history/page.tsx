"use client";

import { CallHistoryTable } from "@/components/calls/CallHistoryTable";
import { useEffect, useState } from "react";

export default function GlobalHistoryPage() {
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>("");

    useEffect(() => {
        // Check localStorage for selected workspace
        const storedWorkspaceId = localStorage.getItem("selectedWorkspaceId");
        if (storedWorkspaceId) {
            setCurrentWorkspaceId(storedWorkspaceId);
        }

        // Listen for storage changes (when user switches workspace)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "selectedWorkspaceId" && e.newValue) {
                setCurrentWorkspaceId(e.newValue);
            }
        };
        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Historial Global</h1>
            <CallHistoryTable workspaceId={currentWorkspaceId} />
        </div>
    );
}

