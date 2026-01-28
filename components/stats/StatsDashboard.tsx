"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, Timestamp, orderBy, doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChatTranscript } from "@/components/calls/ChatTranscript";
import { Loader2, TrendingUp, Clock, Phone, ThumbsUp, Activity, RefreshCcw, EyeOff, Eye, Archive, Trash2, ArrowRight, MessageSquare, ExternalLink, Pencil, Users, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { es } from "date-fns/locale";

// Helper Component for Enum Pie Chart
function EnumPieChart({ data, name }: { data: any, name: string }) {
    const [isHovered, setIsHovered] = useState(false);
    const [isPinned, setIsPinned] = useState(false);

    // Transform value counts to array
    const chartData = Object.entries(data.values || {}).map(([key, value]: [string, any]) => ({
        name: key,
        value: value
    })).sort((a, b) => b.value - a.value);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

    const showLegend = isHovered || isPinned;

    return (
        <div
            className="h-64 relative flex flex-col items-center justify-center p-2"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => setIsPinned(!isPinned)}
        >
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <RechartsTooltip
                            // Recharts can pass undefined for value, so we must type it as any or number | undefined
                            formatter={(value: any) => [value || 0, 'Respuestas']}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="text-gray-400 text-sm">Sin datos</div>
            )}

            {/* Center Count */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{data.count}</span>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total</div>
                </div>
            </div>

            {/* Interactive Legend Overlay */}
            <div className={cn(
                "absolute top-0 right-0 max-w-[200px] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-gray-100 dark:border-gray-700 rounded-lg shadow-lg transition-all duration-300 overflow-hidden z-10",
                showLegend ? "opacity-100 visible max-h-64 overflow-y-auto p-2" : "opacity-0 invisible max-h-0"
            )}>
                <div className="text-[10px] font-bold text-gray-500 uppercase mb-2 px-1 flex justify-between">
                    <span>Leyenda</span>
                    {isPinned && <span className="text-blue-500">Fijado</span>}
                </div>
                <div className="space-y-1">
                    {chartData.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between text-xs gap-3 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                            <div className="flex items-center gap-1.5 truncate">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                <span className="truncate text-gray-700 dark:text-gray-300" title={entry.name}>{entry.name}</span>
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">{entry.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Hint for interaction */}
            {!isPinned && (
                <div className="absolute bottom-2 text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Click para fijar leyenda
                </div>
            )}
        </div>
    );
}

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
    const [ignoredFields, setIgnoredFields] = useState<string[]>([]);
    const [period, setPeriod] = useState("7d");
    const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
    const [uniqueCampaigns, setUniqueCampaigns] = useState<string[]>([]); // Derived from calls

    // NEW FILTERS
    const [agentTypeFilter, setAgentTypeFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
    const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]); // For multi-select
    const [availableAgents, setAvailableAgents] = useState<{ id: string, name: string, type: string }[]>([]);

    // Date Picker State
    const [pickerStart, setPickerStart] = useState<Date | null>(null);
    const [pickerEnd, setPickerEnd] = useState<Date | null>(null);

    // Derived UI State
    const [stats, setStats] = useState({
        totalCalls: 0,
        avgDuration: 0,
        successRate: 0,
        sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 }
    });
    const [customStats, setCustomStats] = useState<Record<string, any>>({});

    // ... delete/edit states ...
    const [metricToDelete, setMetricToDelete] = useState<{ id: string, name: string } | null>(null);
    const [metricToEdit, setMetricToEdit] = useState<{ id: string, name: string, description: string, type: string, originalName: string } | null>(null);
    const [viewingMetric, setViewingMetric] = useState<string | null>(null);
    const [selectedCall, setSelectedCall] = useState<any | null>(null);

    const [campaignMap, setCampaignMap] = useState<Record<string, string>>({});
    const [agentMap, setAgentMap] = useState<Record<string, { name: string, type: string }>>({});

    // 1. Fetch Campaigns and Agents
    useEffect(() => {
        const unsubAgents = onSnapshot(collection(db, "subworkspaces"), (agentSnap) => {
            const map: Record<string, { name: string, type: string }> = {};
            const list: { id: string, name: string, type: string }[] = [];

            agentSnap.docs.forEach(d => {
                const ad = d.data();
                if (ad.retell_agent_id) {
                    const type = ad.type || 'outbound';
                    map[ad.retell_agent_id] = { name: ad.name || "Agente sin nombre", type };
                    list.push({ id: ad.retell_agent_id, name: ad.name || "Agente", type });
                }
            });
            setAgentMap(map);
            setAvailableAgents(list);

            // Fetch Campaigns
            const unsubCampaigns = onSnapshot(collection(db, "campaigns"), (campSnap) => {
                const cMap: Record<string, string> = {};
                campSnap.docs.forEach(doc => {
                    const data = doc.data();
                    const campName = data.name || "Campaña sin nombre";

                    // Logic to append Agent Name if needed
                    let finalName = campName;
                    const linkedAgentId = data.retell_agent_id || data.agent_id;
                    if (!agentId && linkedAgentId && map[linkedAgentId]) {
                        finalName = `${campName} (${map[linkedAgentId].name})`;
                    }

                    cMap[doc.id] = finalName;
                    if (data.vapi_agent_id) cMap[data.vapi_agent_id] = finalName;
                });
                setCampaignMap(cMap);
            });
            return () => unsubCampaigns();
        });
        return () => unsubAgents();
    }, [agentId]);

    // 2. Fetch Data (Calls + Config)
    const fetchStats = async () => {
        // if (!agentId || !props.subworkspaceId) return; // Allow running without these for Global View
        setLoading(true);

        try {
            // Fetch Subworkspace Config (Base)
            let currentFields: any[] = [];
            let currentHidden: string[] = [];
            let currentIgnored: string[] = [];

            if (props.subworkspaceId) {
                const subDoc = await getDoc(doc(db, "subworkspaces", props.subworkspaceId));
                if (subDoc.exists()) {
                    const data = subDoc.data();
                    currentHidden = data.analysis_config?.hidden_standard_fields || [];
                    currentFields = data.analysis_config?.custom_fields || [];
                    currentIgnored = data.analysis_config?.ignored_custom_fields || [];
                }
            }

            // If a specific Campaign is selected, try to load its config to overlay/add fields
            if (selectedCampaign !== 'all') {
                try {
                    const campDoc = await getDoc(doc(db, "campaigns", selectedCampaign));
                    if (campDoc.exists()) {
                        const cData = campDoc.data();
                        const cFields = cData.analysis_config?.custom_fields || [];
                        // Merge strategies? For now, we'll append unique fields from Campaign
                        // or should we replace? The user expects to see Campaign fields.
                        // Let's just create a map by name to unified them.
                        const fieldMap = new Map();
                        currentFields.forEach(f => fieldMap.set(f.name, f));
                        cFields.forEach((f: any) => fieldMap.set(f.name, f)); // Campaign overrides/adds
                        currentFields = Array.from(fieldMap.values());
                    }
                } catch (err) {
                    console.error("Error loading campaign config:", err);
                }
            }

            setHiddenStandard(currentHidden);
            setAllFields(currentFields);
            setIgnoredFields(currentIgnored);

            // Fetch Calls
            const now = new Date();
            let start = new Date();
            let end: Date | null = null;

            if (period === "24h") {
                start.setTime(now.getTime() - 24 * 60 * 60 * 1000);
            } else if (period === "7d") {
                start.setTime(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            } else if (period === "30d") {
                start.setTime(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            } else if (period === "custom" && pickerStart && pickerEnd) {
                start = pickerStart;
                end = pickerEnd;
            } else if (period === "custom") {
                start = new Date(0);
            } else {
                start = new Date(0); // All time
            }

            const constraints: any[] = [
                where("timestamp", ">=", Timestamp.fromDate(start)),
                orderBy("timestamp", "desc")
            ];

            if (agentId) { // If provided as prop, lock it. Otherwise allow all.
                constraints.push(where("agent_id", "==", agentId));
            }

            if (selectedCampaign === "testing") {
                // Allow fetching all calls to enable 'residue' filtering for legacy test calls
            } else if (selectedCampaign !== "all") {
                constraints.push(where("metadata.campaign_id", "==", selectedCampaign));
            }

            if (end) {
                constraints.push(where("timestamp", "<=", Timestamp.fromDate(end)));
            }

            const q = query(collection(db, "calls"), ...constraints);
            const snapshot = await getDocs(q);
            let calls = snapshot.docs.map(doc => doc.data());

            // Client-side cleanup for "All" (exclude testing calls)
            if (selectedCampaign === "all") {
                calls = calls.filter((c: any) => c.metadata?.type !== 'testing');
            }

            setRawCalls(calls);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    // 2. Refresh data when context changes
    useEffect(() => {
        if (period === "custom" && (!pickerStart || !pickerEnd)) return;
        fetchStats();
    }, [agentId, period, props.subworkspaceId, pickerStart, pickerEnd, selectedCampaign]);

    // 2.5 Extract Campaigns
    useEffect(() => {
        const campaigns = Array.from(new Set(rawCalls.map(c => c.metadata?.campaign_id).filter(Boolean)));
        setUniqueCampaigns(campaigns);
    }, [rawCalls]);

    // 3. Calculate Stats when data or visibility changes
    useEffect(() => {
        // Filter by Campaign / Type / Agent Selection
        const filteredCalls = rawCalls.filter(c => {
            // 1. Campaign Filter
            if (selectedCampaign !== 'all') {
                if (selectedCampaign === 'testing') {
                    if (c.metadata?.type !== 'testing' && (c.metadata?.campaign_id || campaignMap[c.agent_id])) return false;
                } else {
                    if (c.metadata?.campaign_id !== selectedCampaign) return false;
                }
            }

            // 2. Agent Type Filter
            if (agentTypeFilter !== 'all') {
                const agentInfo = agentMap[c.agent_id];
                const type = agentInfo?.type || 'outbound'; // Default to outbound
                if (type !== agentTypeFilter) return false;
            }

            // 3. Multi-Agent Filter (Checkbox)
            if (selectedAgentIds.length > 0) {
                if (!selectedAgentIds.includes(c.agent_id)) return false;
            }

            return true;
        });

        // Basic Stats
        let totalDuration = 0;
        let successfulCalls = 0;
        let sentimentCounts = { positive: 0, neutral: 0, negative: 0 };

        filteredCalls.forEach(data => {
            if (typeof data.duration === 'number') totalDuration += data.duration;
            if (data.analysis?.call_successful) successfulCalls++;

            const sentiment = (data.analysis?.user_sentiment || "Neutral").toLowerCase();
            if (sentiment.includes('positive')) sentimentCounts.positive++;
            else if (sentiment.includes('negative')) sentimentCounts.negative++;
            else sentimentCounts.neutral++;
        });

        const total = filteredCalls.length;
        setStats({
            totalCalls: total,
            avgDuration: total > 0 ? totalDuration / total : 0,
            successRate: total > 0 ? (successfulCalls / total) * 100 : 0,
            sentimentBreakdown: sentimentCounts
        });

        // Custom Stats - ROBUST DISCOVERY
        const customAgg: Record<string, any> = {};

        // 1. Initialize from Config
        allFields.forEach(field => {
            if (field.isArchived) return; // Skip archived fields (don't show them)
            customAgg[field.name] = {
                id: field.id,
                type: field.type,
                yes: 0, no: 0, count: 0, totalSum: 0,
                description: field.description,
                name: field.name,
                isConfigured: true
            };
        });

        // 2. Aggregation & Discovery
        filteredCalls.forEach(data => {
            const customs = data.analysis?.custom_analysis_data;
            if (Array.isArray(customs)) {
                customs.forEach((c: any) => {
                    // Normalize Name: Try to find a matching config field (case-insensitive)
                    // This links "MOTIVO CITA" (from call) to "Motivo Cita" (from config)
                    const rawName = c.name;
                    const configField = allFields.find(f => f.name.toLowerCase() === rawName.toLowerCase());
                    const name = configField ? configField.name : rawName;

                    // CRITICAL FIX: If this field is KNOWN to be archived, ignore it entirely.
                    // Do not "rediscover" it.
                    const isArchived = configField ? configField.isArchived : allFields.some(f => f.name === name && f.isArchived);

                    // ALSO CHECK: If it is in the "ignored" list (hard deleted)
                    const isIgnored = ignoredFields.includes(name);

                    if (isArchived || isIgnored) return;

                    if (!customAgg[name]) {
                        // Discovered a field not in active config (maybe new)
                        // Or if we found a configField but it wasn't in customAgg yet (shouldn't happen if initialized properly, but safe fallback)
                        customAgg[name] = {
                            id: configField ? configField.id : `auto_${name}`,
                            type: configField ? configField.type : (typeof c.value === 'boolean' ? 'boolean' : typeof c.value === 'number' ? 'number' : 'string'),
                            yes: 0, no: 0, count: 0, totalSum: 0,
                            values: {}, // Track distinct values
                            description: configField ? configField.description : "Detectado automáticamente",
                            name: name,
                            isConfigured: !!configField
                        };
                    }

                    const entry = customAgg[name];
                    entry.count++;

                    // Track Values for Enum/String
                    const valStr = String(c.value);
                    if (!entry.values) entry.values = {};
                    entry.values[valStr] = (entry.values[valStr] || 0) + 1;

                    if (configField) {
                        // Enforce config type logic if configured
                        if (configField.type === 'boolean') {
                            if (c.value) entry.yes++; else entry.no++;
                        } else if (configField.type === 'number') {
                            const numValue = Number(c.value);
                            if (!isNaN(numValue)) {
                                entry.totalSum += numValue;
                            }
                        }
                        // For string/enum, we just track values which is done above.
                        // Ensure type is set correctly
                        entry.type = configField.type;
                    } else {
                        // Auto-discovery type logic
                        if (typeof c.value === 'boolean') {
                            entry.type = 'boolean';
                            if (c.value) entry.yes++; else entry.no++;
                        } else if (typeof c.value === 'number') {
                            entry.type = 'number';
                            entry.totalSum += c.value;
                        } else {
                            // Default to string 
                            entry.type = 'string';
                        }
                    }
                });
            }
        });

        setCustomStats(customAgg);
    }, [rawCalls, allFields, ignoredFields, selectedCampaign, campaignMap]);


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

        // Find if this is an auto-discovered field (starts with 'auto_')
        // OR an existing config field.
        // If it's auto-discovered, we must ADD it to the 'custom_fields' array as archived.

        let newFields = [...allFields];
        const existingIndex = newFields.findIndex(f => f.id === fieldId);

        if (existingIndex >= 0) {
            // Update existing
            newFields[existingIndex] = { ...newFields[existingIndex], isArchived: archive };
        } else if (fieldId.startsWith('auto_')) {
            // It's a transient field we want to archive. We must persist it.
            // Retrieve the temp object from customStats to get details?
            // Actually, we can just look at customStats[name] but we need the name.
            // The 'id' in handleToggle is what we have.
            // We search customStats values for this ID.
            const statEntry = Object.values(customStats).find(s => s.id === fieldId);
            if (statEntry) {
                newFields.push({
                    id: fieldId, // or generate new ID? 'auto_' ID is fine for now or valid UUID
                    name: statEntry.name,
                    description: statEntry.description,
                    type: statEntry.type,
                    isArchived: true // Start archived
                });
            }
        }

        setAllFields(newFields);

        try {
            await updateDoc(doc(db, "subworkspaces", props.subworkspaceId), {
                "analysis_config.custom_fields": newFields
            });
        } catch (e) {
            console.error("Error toggling archive", e);
        }
    };

    const handleDeleteCustomMetric = async () => {
        if (!props.subworkspaceId || !metricToDelete) return;

        const newFields = allFields.filter(f => f.id !== metricToDelete.id);
        const newIgnored = [...ignoredFields, metricToDelete.name];

        setAllFields(newFields); // Optimistic update
        setIgnoredFields(newIgnored);

        try {
            await updateDoc(doc(db, "subworkspaces", props.subworkspaceId), {
                "analysis_config.custom_fields": newFields,
                "analysis_config.ignored_custom_fields": newIgnored
            });
            setMetricToDelete(null);
        } catch (e) {
            console.error("Error deleting metric", e);
        }
    };

    const handleSaveEdit = async () => {
        if (!props.subworkspaceId || !metricToEdit) return;

        let newFields = [...allFields];
        const existingIndex = newFields.findIndex(f => f.id === metricToEdit.id);

        const updatedField = {
            id: metricToEdit.id,
            name: metricToEdit.name,
            description: metricToEdit.description,
            type: metricToEdit.type,
            isArchived: existingIndex >= 0 ? newFields[existingIndex].isArchived : false
        };

        if (existingIndex >= 0) {
            newFields[existingIndex] = updatedField;
        } else {
            // If it was auto-discovered (not in fields yet), we add it
            newFields.push(updatedField);
        }

        setAllFields(newFields); // Optimistic

        try {
            await updateDoc(doc(db, "subworkspaces", props.subworkspaceId), {
                "analysis_config.custom_fields": newFields
            });
            setMetricToEdit(null);
        } catch (e) {
            console.error("Error saving metric", e);
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

    const hasHiddenMetrics = hiddenStandard.length > 0 || allFields.filter(f => f.isArchived).length > 0;
    const archivedCustomList = allFields.filter(f => f.isArchived);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Resumen de Rendimiento</h3>
                {/* NEW: Type Filter */}
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={agentTypeFilter} onValueChange={(v: any) => setAgentTypeFilter(v)}>
                        <SelectTrigger className="w-[140px] bg-white dark:bg-gray-800">
                            <div className="flex items-center gap-2">
                                <Filter className="h-3.5 w-3.5 text-gray-400" />
                                <SelectValue />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todo</SelectItem>
                            <SelectItem value="outbound">Salientes</SelectItem>
                            <SelectItem value="inbound">Entrantes</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* NEW: Multi-select Agents */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="bg-white dark:bg-gray-800 border-dashed">
                                <Users className="h-4 w-4 mr-2" />
                                {selectedAgentIds.length > 0 ? `${selectedAgentIds.length} Agentes` : "Agentes"}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 p-2 bg-white dark:bg-gray-800" align="start">
                            <div className="mb-2 px-2 text-xs font-semibold text-gray-500">Filtrar por Agentes</div>
                            <ScrollArea className="h-[200px]">
                                {availableAgents
                                    .filter(a => agentTypeFilter === 'all' || a.type === agentTypeFilter)
                                    .map(agent => (
                                        <div key={agent.id} className="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setSelectedAgentIds(prev =>
                                                    prev.includes(agent.id) ? prev.filter(id => id !== agent.id) : [...prev, agent.id]
                                                );
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedAgentIds.includes(agent.id)}
                                                readOnly
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm truncate">{agent.name}</span>
                                            <Badge variant="secondary" className="text-[10px] ml-auto">
                                                {agent.type === 'inbound' ? 'In' : 'Out'}
                                            </Badge>
                                        </div>
                                    ))}
                                {availableAgents.length === 0 && <div className="text-sm text-gray-400 p-2">No hay agentes</div>}
                            </ScrollArea>
                            {selectedAgentIds.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full mt-2 text-xs h-7"
                                    onClick={() => setSelectedAgentIds([])}
                                >
                                    Limpiar Selección
                                </Button>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>


                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-2" />

                    {/* Existing Controls */}
                    <Button variant="outline" size="sm" onClick={() => fetchStats()} disabled={loading} className="bg-white dark:bg-gray-800">
                        <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                    <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                        <SelectTrigger className="w-[180px] bg-white dark:bg-gray-800">
                            <SelectValue placeholder="Campaña" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las campañas</SelectItem>
                            <SelectItem value="testing" className="text-amber-600 dark:text-amber-400 font-medium">
                                Entorno de Pruebas
                            </SelectItem>
                            {uniqueCampaigns.map(cid => (
                                <SelectItem key={cid} value={cid}>
                                    {campaignMap[cid] || "Campaña desconocida"}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[180px] bg-white dark:bg-gray-800">
                            <SelectValue placeholder="Periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="24h">Últimas 24 horas</SelectItem>
                            <SelectItem value="7d">Últimos 7 días</SelectItem>
                            <SelectItem value="30d">Últimos 30 días</SelectItem>
                            <SelectItem value="all">Todo el tiempo</SelectItem>
                            <SelectItem value="custom">Personalizado</SelectItem>
                        </SelectContent>
                    </Select>

                    {period === "custom" && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <DateRangePicker
                                startDate={pickerStart}
                                endDate={pickerEnd}
                                onChange={(s, e) => {
                                    setPickerStart(s);
                                    setPickerEnd(e);
                                }}
                            />
                        </div>
                    )}
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
            {
                !hiddenStandard.includes('sentiment') && (
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
                )
            }

            {/* Custom Metrics */}
            {
                Object.keys(customStats).length > 0 && (
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Métricas Personalizadas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {Object.entries(customStats).map(([name, data]) => {
                                if (name === 'resumen_espanol') return null;
                                const yesPct = data.count > 0 ? (data.yes / data.count) * 100 : 0;
                                const noPct = data.count > 0 ? (data.no / data.count) * 100 : 0;

                                return (
                                    <Card
                                        key={name}
                                        className="group relative overflow-hidden border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-gray-800 cursor-pointer"
                                        onClick={() => setViewingMetric(name)}
                                    >
                                        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMetricToEdit({
                                                        id: data.id,
                                                        name: data.name,
                                                        description: data.description || "",
                                                        type: data.type,
                                                        originalName: data.name
                                                    });
                                                }}
                                                className="h-6 w-6 text-gray-400 hover:text-blue-500 hover:bg-blue-50"
                                                title="Editar"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => { e.stopPropagation(); handleToggleCustomArchive(data.id, true); }}
                                                className="h-6 w-6 text-gray-400 hover:text-orange-500 hover:bg-orange-50"
                                                title="Ocultar (Archivar)"
                                            >
                                                <EyeOff className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => { e.stopPropagation(); setMetricToDelete({ id: data.id, name: name }); }}
                                                className="h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-red-50"
                                                title="Eliminar Definitivamente"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                        <div className="border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 px-5 py-3 flex justify-between items-center">
                                            <div>
                                                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1.5">
                                                    {name.replace(/_/g, ' ')}
                                                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50" />
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
                                            ) : data.type === 'enum' ? (
                                                <EnumPieChart data={data} name={name} />
                                            ) : (
                                                <div className="text-sm text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                                    <span className="truncate">Ver lista de respuestas ({Object.keys(data.values || {}).length} variantes)</span>
                                                    <ArrowRight className="h-4 w-4 text-gray-400" />
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    </div>
                )
            }

            {/* Hidden/Archived Config Logic */}
            {
                hasHiddenMetrics && (
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
                            {archivedCustomList.map(field => (
                                <div key={field.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/10 text-purple-600 border-purple-100 text-xs">Personalizada</Badge>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{field.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => handleToggleCustomArchive(field.id, false)} className="text-green-500 hover:text-green-700 hover:bg-green-50">
                                            <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
                                            Restaurar
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => setMetricToDelete({ id: field.id, name: field.name })} className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50" title="Eliminar Definitivamente">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* Metric Details Dialog */}
            <Dialog open={!!viewingMetric} onOpenChange={(open) => !open && setViewingMetric(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Activity className="h-5 w-5 text-purple-600" />
                            {viewingMetric?.replace(/_/g, ' ')}
                        </DialogTitle>
                        <DialogDescription>
                            Respuestas extraídas para esta métrica ({viewingMetric && customStats[viewingMetric]?.count} llamadas)
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/50 p-6">
                        <div className="space-y-3">
                            {viewingMetric && (() => {
                                // Extract and filter calls that have this metric
                                const callsWithMetric = rawCalls.filter(c => {
                                    // Must match filters (already done in rawCalls sort of, but let's re-verify logic)
                                    // Actually rawCalls might be larger if we filter client side for 'testing'.
                                    // Use same logic as 'filteredCalls' basically.
                                    const isTesting = c.metadata?.type === 'testing';
                                    if (selectedCampaign === 'all' && isTesting) return false;
                                    if (selectedCampaign !== 'all' && selectedCampaign !== 'testing' && c.metadata?.campaign_id !== selectedCampaign) return false;
                                    if (selectedCampaign === 'testing' && !isTesting && (c.metadata?.campaign_id || campaignMap[c.agent_id])) return false; // Strict testing check

                                    // Check if metric exists
                                    const customData = c.analysis?.custom_analysis_data;
                                    return Array.isArray(customData) && customData.some((d: any) => d.name === viewingMetric);
                                }).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

                                if (callsWithMetric.length === 0) return (
                                    <div className="text-center py-10 text-gray-500">No hay datos disponibles para los filtros actuales.</div>
                                );

                                return callsWithMetric.map(call => {
                                    const customData = call.analysis?.custom_analysis_data;
                                    const metricData = Array.isArray(customData) ? customData.find((d: any) => d.name === viewingMetric) : undefined;
                                    const campaignName = (call.metadata?.campaign_id ? campaignMap[call.metadata.campaign_id] : null) || campaignMap[call.agent_id];

                                    return (
                                        <Card key={call.id} className="overflow-hidden border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="p-4 flex items-start gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Badge variant="outline" className="bg-white dark:bg-gray-900 text-xs font-normal text-gray-500">
                                                            {call.timestamp?.toDate ? formatDistanceToNow(call.timestamp.toDate(), { addSuffix: true, locale: es }) : "Reciente"}
                                                        </Badge>
                                                        {campaignName && (
                                                            <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-0">
                                                                {campaignName}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 bg-purple-50 dark:bg-purple-900/10 p-3 rounded-lg border border-purple-100 dark:border-purple-900/20">
                                                        "{String(metricData?.value)} "
                                                    </div>
                                                    {metricData?.rationale && (
                                                        <p className="text-xs text-gray-500 mt-2 italic">
                                                            Razón: {metricData.rationale}
                                                        </p>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelectedCall(call)}
                                                    className="shrink-0 h-9 w-9 p-0 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50"
                                                    title="Ver conversación completa"
                                                >
                                                    <MessageSquare className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </Card>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                    <DialogFooter className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
                        <Button variant="outline" onClick={() => setViewingMetric(null)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Chat Transcript Dialog */}
            <Dialog open={!!selectedCall} onOpenChange={(open) => !open && setSelectedCall(null)}>
                <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
                    <DialogHeader className="p-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                        <DialogTitle className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                <Phone className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <span>Transcripción de Llamada</span>
                                <span className="text-xs font-normal text-gray-500">
                                    {selectedCall?.timestamp?.toDate ? selectedCall.timestamp.toDate().toLocaleString() : "Fecha desconocida"}
                                </span>
                            </div>
                        </DialogTitle>
                    </DialogHeader>
                    {selectedCall && (
                        <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-950">
                            <ChatTranscript
                                messages={selectedCall.transcript_object || []}
                                audioUrl={selectedCall.recording_url}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit Metric Dialog */}
            <Dialog open={!!metricToEdit} onOpenChange={(open) => !open && setMetricToEdit(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Métrica: {metricToEdit?.originalName}</DialogTitle>
                        <DialogDescription>
                            Modifica la configuración de esta métrica. Nota: Cambiar el nombre puede afectar la recolección de datos si el prompt no se actualiza (la IA usa el nombre como referencia).
                        </DialogDescription>
                    </DialogHeader>
                    {metricToEdit && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Nombre (Clave)</Label>
                                <Input
                                    value={metricToEdit.name}
                                    onChange={(e) => setMetricToEdit({ ...metricToEdit, name: e.target.value })}
                                />
                                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                    ¡Cuidado! Si cambias esto, asegúrate que las nuevas llamadas usen este nombre exacto.
                                </p>
                            </div>
                            {/* Description removed as per request */}
                            <div className="space-y-2">
                                <Label>Tipo de Dato</Label>
                                <Select
                                    value={metricToEdit.type}
                                    onValueChange={(val) => setMetricToEdit({ ...metricToEdit, type: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona un tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="boolean">Booleano (Sí/No)</SelectItem>
                                        <SelectItem value="number">Numérico</SelectItem>
                                        <SelectItem value="string">Texto / Categoría</SelectItem>
                                        <SelectItem value="enum">Enum (Gráfico Circular)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMetricToEdit(null)}>Cancelar</Button>
                        <Button onClick={handleSaveEdit}>Guardar Cambios</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Existing Delete Dialog */}
            <Dialog open={!!metricToDelete} onOpenChange={(open) => !open && setMetricToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Eliminar métrica "{metricToDelete?.name}"?</DialogTitle>
                        <DialogDescription>
                            Esta acción eliminará la configuración de esta métrica. Los datos históricos en las llamadas permanecerán, pero no se calcularán estadísticas agregadas ni se mostrará en los informes.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMetricToDelete(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleDeleteCustomMetric}>Eliminar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
