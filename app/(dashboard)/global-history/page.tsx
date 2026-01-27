"use client";

import { CallHistoryTable } from "@/components/calls/CallHistoryTable";

export default function GlobalHistoryPage() {
    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Historial Global</h1>
            <CallHistoryTable />
        </div>
    );
}
