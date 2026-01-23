"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, Timestamp, orderBy, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, TrendingUp, Clock, Phone, ThumbsUp, Activity, RefreshCcw, EyeOff, Eye, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface StatsDashboardProps {
    agentId?: string;
    subworkspaceId?: string;
}

export function StatsDashboard(props: StatsDashboardProps) {
    const { agentId } = props;
    const [loading, setLoading] = useState(true);

    // Data State
    const [rawCalls, setRawCalls] = useState<any[]>([]);
    const [allFields, setAllFields] = useState<any[]>([]);

    // Config State
    const [hiddenStandard, setHiddenStandard] = useState<string[]>([]);
    const [period, setPeriod] = useState("7d");

    // Derived UI State
    const [stats, setStats] = useState({
        totalCalls: 0,
        avgDuration: 0,
        successRate: 0,
        sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 }
    });
    const [customStats, setCustomStats] = useState<Record<string, any>>({});
    const [archivedCustom, setArchivedCustom] = useState<any[]>([]);

    // 1. Fetch Data (Calls + Config)
    const fetchStats = async () => {
        if (!agentId || !props.subworkspaceId) return;
        setLoading(true);

        try {
            // Fetch Config
            const subDoc = await getDoc(doc(db, "subworkspaces", props.subworkspaceId));
            if (subDoc.exists()) {
                const data = subDoc.data();
                setHiddenStandard(data.analysis_config?.hidden_standard_fields || []);
                setAllFields(data.analysis_config?.custom_fields || []);
            }

            // Fetch Calls
            const now = new Date();
            let start = new Date();

            if (period === "24h") start.setTime(now.getTime() - 24 * 60 * 60 * 1000);
            else if (period === "7d") start.setTime(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            else if (period === "30d") start.setTime(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            else start = new Date(0);

            const q = query(
                collection(db, "calls"),
                where("agent_id", "==", agentId),
                where("timestamp", ">=", Timestamp.fromDate(start)),
                orderBy("timestamp", "desc")
            );

            const snapshot = await getDocs(q);
            const calls = snapshot.docs.map(doc => doc.data());
            setRawCalls(calls);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    // 2. Refresh data when context changes
    useEffect(() => {
        fetchStats();
    }, [agentId, period, props.subworkspaceId]);

    // 3. Calculate Stats when data or visibility changes
    useEffect(() => {
        // Basic Stats
        let totalDuration = 0;
        let successfulCalls = 0;
        let sentimentCounts = { positive: 0, neutral: 0, negative: 0 };

        rawCalls.forEach(data => {
            if (typeof data.duration === 'number') totalDuration += data.duration;
            if (data.analysis?.call_successful) successfulCalls++;

            const sentiment = (data.analysis?.user_sentiment || "Neutral").toLowerCase();
            if (sentiment.includes('positive')) sentimentCounts.positive++;
            else if (sentiment.includes('negative')) sentimentCounts.negative++;
            else sentimentCounts.neutral++;
        });

        const total = rawCalls.length;
        setStats({
            totalCalls: total,
            avgDuration: total > 0 ? totalDuration / total : 0,
            successRate: total > 0 ? (successfulCalls / total) * 100 : 0,
            sentimentBreakdown: sentimentCounts
        });

        // Custom Stats
        const initialCustomStats: Record<string, any> = {};
        const archivedList: any[] = [];

        allFields.forEach(field => {
            if (field.isArchived) {
                archivedList.push(field);
                return;
            }
            initialCustomStats[field.name] = {
                id: field.id,
                type: field.type,
                yes: 0,
                no: 0,
                count: 0,
                totalSum: 0,
                description: field.description,
                name: field.name
            };
        });
        setArchivedCustom(archivedList);

        const customAgg = { ...initialCustomStats };

        rawCalls.forEach(data => {
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
    }, [rawCalls, allFields]);


    const handleHideStandard = async (metricId: string) => {
        if (!props.subworkspaceId) return;
        const newHidden = [...hiddenStandard, metricId];
        setHiddenStandard(newHidden); // Instant update

        try {
            await updateDoc(doc(db, "subworkspaces", props.subworkspaceId), {
                "analysis_config.hidden_standard_fields": newHidden
            });
        } catch (e) {
            console.error("Error hiding metric", e);
        }
    };

    const handleRestoreStandard = async (metricId: string) => {
        if (!props.subworkspaceId) return;
        const newHidden = hiddenStandard.filter(id => id !== metricId);
        setHiddenStandard(newHidden); // Instant update

        try {
            await updateDoc(doc(db, "subworkspaces", props.subworkspaceId), {
                "analysis_config.hidden_standard_fields": newHidden
            });
        } catch (e) {
            console.error("Error restoring metric", e);
        }
    };

    const handleToggleCustomArchive = async (fieldId: string, archive: boolean) => {
        if (!props.subworkspaceId) return;

        // Optimistic local update
        const updatedFields = allFields.map(f =>
            f.id === fieldId ? { ...f, isArchived: archive } : f
        );
        setAllFields(updatedFields);

        try {
            await updateDoc(doc(db, "subworkspaces", props.subworkspaceId), {
                "analysis_config.custom_fields": updatedFields
            });
        } catch (e) {
            console.error("Error toggling archive", e);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}m ${secs}s`;
    };

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
    }

    const hasHiddenMetrics = hiddenStandard.length > 0 || archivedCustom.length > 0;

    return (
        <div className="space-y-6 animate-fade-in pb-10">
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
                <Card className="group relative bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/10 dark:to-gray-900 border-blue-100 dark:border-blue-900/30">
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

                <Card className="group relative bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/10 dark:to-gray-900 border-purple-100 dark:border-purple-900/30">
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

                {!hiddenStandard.includes('call_successful') && (
                    <Card className="group relative bg-gradient-to-br from-green-50 to-white dark:from-green-900/10 dark:to-gray-900 border-green-100 dark:border-green-900/30">
                        <Button variant="ghost" size="icon" onClick={() => handleHideStandard('call_successful')} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-gray-400 hover:text-red-500">
                            <EyeOff className="h-3.5 w-3.5" />
                        </Button>
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
                )}

                {!hiddenStandard.includes('sentiment') && (
                    <Card className="group relative bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/10 dark:to-gray-900 border-indigo-100 dark:border-indigo-900/30">
                        <Button variant="ghost" size="icon" onClick={() => handleHideStandard('sentiment')} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-gray-400 hover:text-red-500">
                            <EyeOff className="h-3.5 w-3.5" />
                        </Button>
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
                )}
            </div>

            {/* Visual Bar for Sentiment (Hide if Sentiment is hidden) */}
            {!hiddenStandard.includes('sentiment') && (
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
            )}

            {/* Custom Metrics */}
            {Object.keys(customStats).length > 0 && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Métricas Personalizadas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {Object.entries(customStats).map(([name, data]) => {
                            if (name === 'resumen_espanol') return null;
                            const yesPct = data.count > 0 ? (data.yes / data.count) * 100 : 0;
                            const noPct = data.count > 0 ? (data.no / data.count) * 100 : 0;

                            return (
                                <Card key={name} className="group relative overflow-hidden border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
                                    <Button variant="ghost" size="icon" onClick={() => handleToggleCustomArchive(data.id, true)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-gray-400 hover:text-red-500 z-10">
                                        <EyeOff className="h-3.5 w-3.5" />
                                    </Button>
                                    <div className="border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 px-5 py-3 flex justify-between items-center">
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">
                                                {name.replace(/_/g, ' ')}
                                            </div>
                                            <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[200px]" title={data.description}>
                                                {data.description}
                                            </div>
                                        </div>
                                        <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-1 rounded-full">
                                            {data.count} respuestas
                                        </span>
                                    </div>
                                    <div className="p-5">
                                        {data.type === 'boolean' ? (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-green-500" />
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Sí</span>
                                                        <span className="text-xs text-gray-500">({data.yes})</span>
                                                    </div>
                                                    <span className="text-sm font-bold text-green-600">{yesPct.toFixed(0)}%</span>
                                                </div>
                                                <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div style={{ width: `${yesPct}%` }} className="h-full bg-green-500 rounded-full" />
                                                </div>

                                                <div className="flex items-center justify-between pt-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-red-400" />
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">No</span>
                                                        <span className="text-xs text-gray-500">({data.no})</span>
                                                    </div>
                                                    <span className="text-sm font-bold text-red-500">{noPct.toFixed(0)}%</span>
                                                </div>
                                                <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div style={{ width: `${noPct}%` }} className="h-full bg-red-400 rounded-full" />
                                                </div>
                                            </div>
                                        ) : data.type === 'number' ? (
                                            <div className="flex items-baseline gap-2">
                                                <div className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                                                    {(data.count > 0 ? data.totalSum / data.count : 0).toFixed(1)}
                                                </div>
                                                <span className="text-sm text-gray-500 font-medium uppercase tracking-wide">Promedio</span>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                                Texto libre (ver detalles en tabla)
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Hidden/Archived Config Logic */}
            {hasHiddenMetrics && (
                <div className="mt-8 border-t border-gray-200 dark:border-gray-800 pt-6">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Archive className="h-4 w-4" />
                        Métricas Ocultas / Archivadas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 opacity-75">
                        {/* Standard Hidden */}
                        {hiddenStandard.map(id => {
                            const labels: any = { 'sentiment': 'Sentimiento General', 'call_successful': 'Tasa de Éxito' };
                            return (
                                <div key={id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="bg-white dark:bg-gray-900 text-xs">Estándar</Badge>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{labels[id] || id}</span>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => handleRestoreStandard(id)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50">
                                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                                        Mostrar
                                    </Button>
                                </div>
                            )
                        })}

                        {/* Custom Archived */}
                        {archivedCustom.map(field => (
                            <div key={field.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/10 text-purple-600 border-purple-100 text-xs">Personalizada</Badge>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{field.name}</span>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => handleToggleCustomArchive(field.id, false)} className="text-green-500 hover:text-green-700 hover:bg-green-50">
                                    <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
                                    Restaurar
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
