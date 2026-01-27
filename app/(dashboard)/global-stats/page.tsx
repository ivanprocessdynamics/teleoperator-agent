"use client";

import { StatsDashboard } from "@/components/stats/StatsDashboard";

export default function GlobalStatsPage() {
    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estadísticas Globales</h1>
            <StatsDashboard />
        </div>
    );
}
