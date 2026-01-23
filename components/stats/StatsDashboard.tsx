"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, Timestamp, orderBy, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, TrendingUp, Clock, Phone, ThumbsUp, Activity, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StatsDashboardProps {
    agentId?: string;
    subworkspaceId?: string;
}

export function StatsDashboard(props: StatsDashboardProps) {
    const { agentId } = props;
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalCalls: 0,
        avgDuration: 0,
        successRate: 0,
        sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 }
    });
    const [period, setPeriod] = useState("7d");

    const fetchStats = async () => {
        if (!agentId || !props.subworkspaceId) return;
        setLoading(true);

        try {
            // 1. Fetch Subworkspace Config for Custom Fields definition
            const subDoc = await getDoc(doc(db, "subworkspaces", props.subworkspaceId));
            let initialCustomStats: Record<string, any> = {};

            if (subDoc.exists()) {
                const data = subDoc.data();
                const customFields = data.analysis_config?.custom_fields || [];

                customFields.forEach((field: any) => {
                    // Skip archived fields
                    if (field.isArchived) return;

                    initialCustomStats[field.name] = {
                        type: field.type,
                        yes: 0,
                        no: 0,
                        count: 0,
                        totalSum: 0,
                        description: field.description
                    };
                });
            }

            // 2. Determine date range
            const now = new Date();
            let start = new Date();

            if (period === "24h") start.setTime(now.getTime() - 24 * 60 * 60 * 1000);
            else if (period === "7d") start.setTime(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            else if (period === "30d") start.setTime(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            else start = new Date(0); // All time

            const q = query(
                collection(db, "calls"),
                where("agent_id", "==", agentId),
                where("timestamp", ">=", Timestamp.fromDate(start)),
                orderBy("timestamp", "desc")
            );

            const snapshot = await getDocs(q);

            let totalDuration = 0;
            let successfulCalls = 0;
            let sentimentCounts = { positive: 0, neutral: 0, negative: 0 };

            snapshot.docs.forEach(doc => {
                const data = doc.data();

                // Duration
                if (typeof data.duration === 'number') {
                    totalDuration += data.duration;
                }

                // Success
                if (data.analysis?.call_successful) {
                    successfulCalls++;
                }

                // Sentiment
                const sentiment = (data.analysis?.user_sentiment || "Neutral").toLowerCase();
                if (sentiment.includes('positive')) sentimentCounts.positive++;
                else if (sentiment.includes('negative')) sentimentCounts.negative++;
                else sentimentCounts.neutral++;
            });

            const total = snapshot.size;

            setStats({
                totalCalls: total,
                avgDuration: total > 0 ? totalDuration / total : 0,
                successRate: total > 0 ? (successfulCalls / total) * 100 : 0,
                sentimentBreakdown: sentimentCounts
            });

            // 3. Aggregate Custom Fields over the initialized base
            const customAgg = { ...initialCustomStats };

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const customs = data.analysis?.custom_analysis_data;
                if (Array.isArray(customs)) {
                    customs.forEach((c: any) => {
                        // Only aggregate into fields that exist in our initialized set (not archived)
                        if (customAgg[c.name]) {
                            const entry = customAgg[c.name];
                            entry.count++;

                            if (typeof c.value === 'boolean') {
                                entry.type = 'boolean';
                                if (c.value) entry.yes++; else entry.no++;
                            } else if (typeof c.value === 'number') {
                                entry.type = 'number';
                                entry.totalSum += c.value;
                            } else {
                                entry.type = 'string';
                            }
                        }
                    });
                }
            });

            setCustomStats(customAgg);

        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [agentId, period, props.subworkspaceId]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}m ${secs}s`;
    };

    // State for custom stats
    const [customStats, setCustomStats] = useState<Record<string, any>>({});

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Resumen de Rendimiento</h3>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => fetchStats()} disabled={loading} className="bg-white dark:bg-gray-800">
                        <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[180px] bg-white dark:bg-gray-800">
                            <SelectValue placeholder="Periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="24h">Últimas 24 horas</SelectItem>
                            <SelectItem value="7d">Últimos 7 días</SelectItem>
                            <SelectItem value="30d">Últimos 30 días</SelectItem>
                            <SelectItem value="all">Todo el tiempo</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/10 dark:to-gray-900 border-blue-100 dark:border-blue-900/30">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            Total Llamadas
                        </CardTitle>
                        <Phone className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.totalCalls}</div>
                        <p className="text-xs text-blue-600/60 dark:text-blue-400/60">
                            En el periodo seleccionado
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/10 dark:to-gray-900 border-purple-100 dark:border-purple-900/30">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">
                            Duración Media
                        </CardTitle>
                        <Clock className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{formatDuration(stats.avgDuration)}</div>
                        <p className="text-xs text-purple-600/60 dark:text-purple-400/60">
                            Tiempo promedio de conversación
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-900/10 dark:to-gray-900 border-green-100 dark:border-green-900/30">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">
                            Tasa de Éxito
                        </CardTitle>
                        <ThumbsUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.successRate.toFixed(1)}%</div>
                        <p className="text-xs text-green-600/60 dark:text-green-400/60">
                            Llamadas marcadas como exitosas
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/10 dark:to-gray-900 border-indigo-100 dark:border-indigo-900/30">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                            Sentimiento Positivo
                        </CardTitle>
                        <Activity className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                            {stats.totalCalls > 0 ? ((stats.sentimentBreakdown.positive / stats.totalCalls) * 100).toFixed(1) : 0}%
                        </div>
                        <p className="text-xs text-indigo-600/60 dark:text-indigo-400/60">
                            {stats.sentimentBreakdown.positive} llamadas positivas
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Visual Bar for Sentiment */}
            <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                <h4 className="text-sm font-medium mb-4 text-gray-700 dark:text-gray-300">Distribución de Sentimiento</h4>
                <div className="h-8 w-full rounded-full overflow-hidden flex">
                    {stats.totalCalls > 0 ? (
                        <>
                            <div style={{ width: `${(stats.sentimentBreakdown.positive / stats.totalCalls) * 100}%` }} className="bg-green-400 h-full transition-all duration-500" title="Positivo" />
                            <div style={{ width: `${(stats.sentimentBreakdown.neutral / stats.totalCalls) * 100}%` }} className="bg-gray-300 dark:bg-gray-600 h-full transition-all duration-500" title="Neutral" />
                            <div style={{ width: `${(stats.sentimentBreakdown.negative / stats.totalCalls) * 100}%` }} className="bg-red-400 h-full transition-all duration-500" title="Negativo" />
                        </>
                    ) : (
                        <div className="w-full bg-gray-100 dark:bg-gray-800 h-full flex items-center justify-center text-xs text-gray-400">Sin datos</div>
                    )}
                </div>
                <div className="flex gap-4 mt-2 justify-center">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                        <div className="w-3 h-3 rounded-full bg-green-400" /> Positivo ({stats.sentimentBreakdown.positive})
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                        <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" /> Neutral ({stats.sentimentBreakdown.neutral})
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                        <div className="w-3 h-3 rounded-full bg-red-400" /> Negativo ({stats.sentimentBreakdown.negative})
                    </div>
                </div>
            </div>

            {/* Custom Metrics */}
            {Object.keys(customStats).length > 0 && (
                <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                    <h4 className="text-sm font-medium mb-4 text-gray-700 dark:text-gray-300">Métricas Personalizadas</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(customStats).map(([name, data]) => {
                            if (name === 'resumen_espanol') return null; // Skip summary
                            return (
                                <Card key={name} className="border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-semibold uppercase text-gray-500">{name}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {data.type === 'boolean' ? (
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-green-600">Sí: {data.yes}</span>
                                                    <span className="text-red-500">No: {data.no}</span>
                                                </div>
                                                <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                                                    <div style={{ width: `${(data.yes / data.count) * 100}%` }} className="bg-green-500 h-full" />
                                                </div>
                                            </div>
                                        ) : data.type === 'number' ? (
                                            <div>
                                                <div className="text-2xl font-bold text-gray-900 dark:text-white">{(data.totalSum / data.count).toFixed(1)}</div>
                                                <p className="text-xs text-gray-500">Promedio</p>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-gray-600">
                                                {data.count} respuestas recogidas
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
