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

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Historial Global</h1>
            <CallHistoryTable workspaceId={currentWorkspaceId} />
        </div>
    );
}

