"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, limit, Timestamp, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChatTranscript } from "./ChatTranscript";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
    Loader2,
    MessageSquare,
    PhoneIncoming,
    Clock,
    Calendar,
    Smile,
    Meh,
    Frown,
    MoreHorizontal,
    FileText,
    RefreshCw,
    Filter,
    User,
    Users,
    Megaphone
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface CallRecord {
    id: string;
    agent_id: string;
    metadata?: {
        campaign_id?: string;
        type?: string;
    };
    analysis: {
        call_summary?: string;
        user_sentiment?: string;
        call_successful?: boolean;
        custom_analysis_data?: { name: string; value: any }[];
    };
    transcript_object: { role: 'user' | 'agent', content: string }[];
    recording_url?: string;
    duration?: number;
    timestamp: Timestamp;
}

interface CallHistoryTableProps {
    agentId?: string;
    subworkspaceId?: string; // DIRECT ID for reliable config fetching
    workspaceId?: string; // Filter calls by specific workspace
}

import { useAuth } from "@/contexts/AuthContext";

export function CallHistoryTable({ agentId: initialAgentId, subworkspaceId, workspaceId }: CallHistoryTableProps) {
    const { userData } = useAuth(); // Access current user scope
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [filteredCalls, setFilteredCalls] = useState<CallRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Campaign Data
    const [campaignMap, setCampaignMap] = useState<Record<string, string>>({});

    // Filters
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");

    // Aggregated Filter Data
    const [uniqueCampaignIds, setUniqueCampaignIds] = useState<string[]>([]);

    const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [interval, setInterval] = useState<string>("7d"); // Default to last 7 days
    const [pickerStart, setPickerStart] = useState<Date | null>(null);
    const [pickerEnd, setPickerEnd] = useState<Date | null>(null);

    // 1. Fetch Campaigns and Agents for mapping names (Real-time)
    const [allowedAgentIds, setAllowedAgentIds] = useState<Set<string>>(new Set());

    // 1. Fetch Agents and Campaigns (Scoped to User)
    useEffect(() => {
        if (!userData?.uid) return;

        const fetchScopedData = async () => {
            // 1. Get Workspace IDs to filter by
            let wsIds: string[] = [];

            // If a specific workspaceId is provided, use only that
            if (workspaceId) {
                // SECURITY CHECK: Verify user access to this workspace
                try {
                    const wsRef = doc(db, "workspaces", workspaceId);
                    const wsSnap = await getDoc(wsRef);
                    let hasAccess = false;

                    if (wsSnap.exists()) {
                        if (wsSnap.data().owner_uid === userData.uid) {
                            hasAccess = true;
                        } else {
                            // Check membership
                            const memRef = doc(db, "workspaces", workspaceId, "members", userData.uid);
                            const memSnap = await getDoc(memRef);
                            if (memSnap.exists()) {
                                hasAccess = true;
                            }
                        }
                    }

                    if (hasAccess) {
                        wsIds = [workspaceId];
                    } else {
                        console.warn("Access denied to workspace:", workspaceId);
                        // If access denied, do not fetch anything
                        wsIds = [];
                    }
                } catch (err) {
                    console.error("Error verifying workspace access:", err);
                    wsIds = [];
                }
            } else {
                // Otherwise, get user's owned workspaces
                const wsQ = query(collection(db, "workspaces"), where("owner_uid", "==", userData.uid));
                const wsSnap = await getDocs(wsQ);
                wsIds = wsSnap.docs.map(d => d.id);
            }

            if (wsIds.length === 0) {
                setAvailableAgents([]);
                setAllowedAgentIds(new Set());
                return;
            }

            // 2. Listen to Subworkspaces (Agents) for these workspaces
            // Firestore 'in' limitation: max 10. If > 10, strictly we should chunk. 
            // For now, if > 10, we might fallback or just fetch all and filter in memory (less secure but works for UI).
            // Let's safe-guard: fetch all subworkspaces and filter in memory by workspace_id

            const unsubAgents = onSnapshot(collection(db, "subworkspaces"), (agentSnap) => {
                const agentMapLocal: Record<string, string> = {};
                const list: { id: string, name: string, type: string }[] = [];
                const allowed = new Set<string>();

                agentSnap.docs.forEach(d => {
                    const ad = d.data();
                    // FILTER: Only include if workspace_id is in user's workspaces
                    if (wsIds.includes(ad.workspace_id) && ad.retell_agent_id) {
                        agentMapLocal[ad.retell_agent_id] = ad.name || "Agente sin nombre";
                        const info = {
                            id: ad.retell_agent_id,
                            name: ad.name || "Agente",
                            type: ad.type || 'outbound'
                        };
                        list.push(info);
                        allowed.add(ad.retell_agent_id);
                    }
                });

                setAvailableAgents(list);
                setAgentMap(prev => { // Need to merge types carefully, but here we just reconstructed the list
                    const newMap: Record<string, { name: string, type: string }> = {};
                    list.forEach(i => newMap[i.id] = i);
                    return newMap;
                });
                setAllowedAgentIds(allowed);

                // 3. Campaigns (Fetch all, map names. UI only shows relevant ones anyway usually, or we can filter)
                // Keeping campaigns global for name mapping is usually okay as long as data is hidden.
                const unsubCampaigns = onSnapshot(collection(db, "campaigns"), (campSnap) => {
                    const map: Record<string, string> = {};
                    campSnap.docs.forEach(doc => {
                        const data = doc.data();
                        const campName = data.name || "Campaña sin nombre";

                        let finalName = campName;
                        // Use local map
                        if (!initialAgentId && data.retell_agent_id && agentMapLocal[data.retell_agent_id]) {
                            finalName = `${campName} (${agentMapLocal[data.retell_agent_id]})`;
                        }

                        map[doc.id] = finalName;
                        if (data.vapi_agent_id) map[data.vapi_agent_id] = finalName;
                    });
                    setCampaignMap(map);
                });

                return () => unsubCampaigns();
            });

            return () => unsubAgents();
        };

        const cleanup = fetchScopedData();
        return () => { cleanup.then(unsub => unsub && unsub()); };
    }, [initialAgentId, userData, workspaceId]); // Added workspaceId dependency

    useEffect(() => {
        setError(null);

        // Base query
        let constraints: any[] = [orderBy("timestamp", "desc")];

        // Calculate Date Range
        const now = new Date();
        let start: Date | null = null;
        let end: Date | null = null;

        if (interval === "1h") {
            start = new Date(now.getTime() - 60 * 60 * 1000);
        } else if (interval === "24h") {
            start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        } else if (interval === "7d") {
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (interval === "30d") {
            start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (interval === "custom" && pickerStart && pickerEnd) {
            start = pickerStart;
            end = pickerEnd;
        }

        if (start) {
            constraints.push(where("timestamp", ">=", Timestamp.fromDate(start)));
        }
        if (end) {
            constraints.push(where("timestamp", "<=", Timestamp.fromDate(end)));
        }

        if (initialAgentId) {
            constraints.push(where("agent_id", "==", initialAgentId));
        }

        const q = query(collection(db, "calls"), ...constraints);

        const unsub = onSnapshot(q, (snapshot) => {
            let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CallRecord));

            // SECURITY FILTER: If Global View (!initialAgentId), filter by owned agents
            if (!initialAgentId) {
                if (allowedAgentIds.size === 0) {
                    // If we have no agents, or are still loading them, we shouldn't show global calls.
                    // Ideally we distinguish 'loading' from 'empty', but for safety, show empty.
                    data = [];
                } else {
                    data = data.filter(c => allowedAgentIds.has(c.agent_id));
                }
            }

            setCalls(data);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching calls:", err);
            setError(err.message || "Error cargando el historial.");
            setLoading(false);
        });

        return () => unsub();
    }, [interval, pickerStart, pickerEnd, refreshTrigger, initialAgentId, allowedAgentIds]);

    // NEW STATE FOR FILTERS
    const [agentTypeFilter, setAgentTypeFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
    const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
    const [availableAgents, setAvailableAgents] = useState<{ id: string, name: string, type: string }[]>([]);
    const [agentMap, setAgentMap] = useState<Record<string, { name: string, type: string }>>({});
    const [customFields, setCustomFields] = useState<any[]>([]);

    // Fetch Custom Fields Config (Prioritize subworkspaceId, then agentId)
    useEffect(() => {
        if (!initialAgentId && !subworkspaceId) {
            setCustomFields([]);
            return;
        }
        const fetchConfig = async () => {
            try {
                let data: any = null;

                // Priority 1: Direct Subworkspace ID (Most reliable)
                if (subworkspaceId) {
                    const docSnap = await getDoc(doc(db, "subworkspaces", subworkspaceId));
                    if (docSnap.exists()) {
                        data = docSnap.data();
                    }
                }
                // Priority 2: Query by Agent ID (Legacy)
                else if (initialAgentId) {
                    const q = query(collection(db, "subworkspaces"), where("retell_agent_id", "==", initialAgentId));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        data = snap.docs[0].data();
                    }
                }

                if (data) {
                    const fields = data.analysis_config?.custom_fields || [];
                    setCustomFields(fields.filter((f: any) => !f.isArchived));
                }
            } catch (e) {
                console.error("Error fetching agent config", e);
            }
        };
        fetchConfig();
    }, [initialAgentId, subworkspaceId]);

    // Fetch Agent Info for Filtering
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "subworkspaces"), (snap) => {
            const list: { id: string, name: string, type: string }[] = [];
            const map: Record<string, { name: string, type: string }> = {};
            snap.docs.forEach(d => {
                const data = d.data();
                if (data.retell_agent_id) {
                    const info = {
                        id: data.retell_agent_id,
                        name: data.name || "Agente",
                        type: data.type || 'outbound'
                    };
                    list.push(info);
                    map[data.retell_agent_id] = info;
                }
            });
            setAvailableAgents(list);
            setAgentMap(map);
        });
        return () => unsub();
    }, []);

    // Derived Campaign IDs
    useEffect(() => {
        // Use 'calls' (full list) instead of 'filteredCalls' so the dropdown options don't disappear when filtering
        const cIds = Array.from(new Set(calls.map(c => c.metadata?.campaign_id || c.agent_id).filter(Boolean))) as string[];
        setUniqueCampaignIds(cIds);
    }, [calls]);

    // Client-side Filtering
    useEffect(() => {
        let result = calls;

        // 1. Campaign Filter
        if (selectedCampaignId === "testing") {
            result = result.filter(c => c.metadata?.type === 'testing' || (!c.metadata?.campaign_id && !campaignMap[c.agent_id]));
        } else if (selectedCampaignId !== "all") {
            result = result.filter(c =>
                c.metadata?.campaign_id === selectedCampaignId ||
                c.agent_id === selectedCampaignId
            );
        }

        // 2. Type Filter
        if (agentTypeFilter !== 'all') {
            result = result.filter(c => {
                const info = agentMap[c.agent_id];
                const type = info?.type || 'outbound';
                return type === agentTypeFilter;
            });
        }

        // 3. Multi-Agent Filter
        if (selectedAgentIds.length > 0) {
            result = result.filter(c => selectedAgentIds.includes(c.agent_id));
        }

        setFilteredCalls(result);
    }, [calls, selectedCampaignId, campaignMap, agentTypeFilter, selectedAgentIds, agentMap]);

    const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());

    const toggleSummary = (id: string) => {
        const newSet = new Set(expandedSummaries);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedSummaries(newSet);
    };

    const getSentimentConfig = (sentiment?: string) => {
        if (!sentiment) return { label: "N/A", icon: MoreHorizontal, color: "bg-gray-100 text-gray-600" };
        const s = sentiment.toLowerCase();
        if (s.includes("positive") || s.includes("positiva")) return { label: "Positivo", icon: Smile, color: "bg-green-100 text-green-700 border-green-200" };
        if (s.includes("negative") || s.includes("negativa")) return { label: "Negativo", icon: Frown, color: "bg-red-100 text-red-700 border-red-200" };
        return { label: "Neutral", icon: Meh, color: "bg-blue-50 text-blue-700 border-blue-200" };
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return "--";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <>
            <div className="space-y-4">
                {/* Header & Controls - ALWAYS VISIBLE */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Historial de Llamadas
                            </h2>
                            <p className="text-xs text-gray-500">
                                {filteredCalls.length} resultados encontrados
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">


                    {/* Type Filter - Only show if NO initialAgentId */}
                    {!initialAgentId && (
                        <Select value={agentTypeFilter} onValueChange={(v: any) => setAgentTypeFilter(v)}>
                            <SelectTrigger className="w-[140px] h-9 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800">
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
                    )}

                    {/* Multi-select Agents - Only show if NO initialAgentId (Global View) */}
                    {!initialAgentId && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-9 bg-white dark:bg-gray-950 border-dashed border-gray-200 dark:border-gray-800 text-sm font-normal">
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
                    )}

                    {/* Campaign Filter */}
                    <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                        <SelectTrigger className="w-[200px] h-9 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800">
                            <Megaphone className="w-3.5 h-3.5 mr-2 text-gray-400" />
                            <SelectValue placeholder={initialAgentId ? "Filtrar por campaña" : "Campaña"} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                {initialAgentId
                                    ? (agentMap[initialAgentId]?.type === 'inbound' ? "Agente en producción" : "Todas las campañas del agente")
                                    : "Todas las campañas"}
                            </SelectItem>
                            <SelectItem value="testing" className="text-amber-600 dark:text-amber-400 font-medium">
                                Entorno de Pruebas
                            </SelectItem>
                            {uniqueCampaignIds
                                .filter((cid: string) => (campaignMap[cid] || "Campaña desconocida") !== "Campaña desconocida")
                                .map((cid: string) => (
                                    <SelectItem key={cid} value={cid}>
                                        {campaignMap[cid]}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>

                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 mx-1" />

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setLoading(true);
                            setRefreshTrigger(prev => prev + 1);
                        }}
                        className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300"
                    >
                        <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                        Actualizar
                    </Button>

                    <Select value={interval} onValueChange={setInterval}>
                        <SelectTrigger className="w-[180px] h-9 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800">
                            <Clock className="w-3.5 h-3.5 mr-2 text-gray-400" />
                            <SelectValue placeholder="Selecciona periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1h">Última hora</SelectItem>
                            <SelectItem value="24h">Últimas 24 horas</SelectItem>
                            <SelectItem value="7d">Última semana</SelectItem>
                            <SelectItem value="30d">Último mes</SelectItem>
                            <SelectItem value="custom">Personalizado</SelectItem>
                        </SelectContent>
                    </Select>

                    {interval === "custom" && (
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

            {/* Content Area */}
            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-red-200 bg-red-50 rounded-xl text-red-600">
                    <p>{error}</p>
                </div>
            ) : filteredCalls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-900/50">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-full shadow-sm mb-4">
                        <PhoneIncoming className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sin llamadas registradas</h3>
                    <p className="text-sm text-gray-500 max-w-sm mt-1">
                        No hay llamadas que coincidan con los filtros seleccionados.
                    </p>
                </div>
            ) : (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-gray-50/50 dark:bg-gray-900">
                            <TableRow>
                                <TableHead className="w-[180px]">Fecha y Hora</TableHead>
                                <TableHead className="w-[140px]">Campaña</TableHead>
                                <TableHead className="w-[100px]">Duración</TableHead>
                                <TableHead className="w-[140px]">Sentimiento</TableHead>
                                {/* Custom Fields Columns Removed */}
                                <TableHead>Resumen de la Conversación</TableHead>
                                <TableHead className="text-right w-[120px]">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCalls.map((call) => {
                                const sentiment = getSentimentConfig(call.analysis?.user_sentiment);
                                const SentimentIcon = sentiment.icon;
                                const isExpanded = expandedSummaries.has(call.id);

                                // Try lookup by campaign_id (metadata) OR agent_id (direct map)
                                const campaignName = (call.metadata?.campaign_id ? campaignMap[call.metadata.campaign_id] : null)
                                    || campaignMap[call.agent_id];

                                return (
                                    <TableRow key={call.id} className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900 dark:text-white">
                                                    {call.timestamp?.toDate ?
                                                        (() => {
                                                            const dist = formatDistanceToNow(call.timestamp.toDate(), { addSuffix: true, locale: es });
                                                            return dist.charAt(0).toUpperCase() + dist.slice(1);
                                                        })()
                                                        : "Reciente"}
                                                </span>
                                                <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                    <Calendar className="h-3 w-3" />
                                                    {call.timestamp?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {campaignName ? (
                                                <Badge variant="outline" className="font-medium text-xs border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
                                                    {campaignName}
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="font-mono text-[10px] text-gray-400 border-dashed">
                                                    Prueba / Manual
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="font-mono font-normal text-xs bg-gray-100 dark:bg-gray-800">
                                                {formatDuration(call.duration)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full w-fit text-xs font-medium border", sentiment.color)}>
                                                <SentimentIcon className="h-3.5 w-3.5" />
                                                {sentiment.label}
                                            </div>
                                        </TableCell>
                                        {/* Custom Fields Columns Removed */}
                                        <TableCell>
                                            <div className="max-w-md">
                                                <div
                                                    onClick={() => toggleSummary(call.id)}
                                                    className={cn(
                                                        "text-sm text-gray-600 dark:text-gray-300 cursor-pointer transition-all duration-300",
                                                        isExpanded ? "" : "line-clamp-2"
                                                    )}
                                                    title={isExpanded ? "Click para reducir" : "Click para expandir"}
                                                >
                                                    {(() => {
                                                        const customData = call.analysis?.custom_analysis_data;
                                                        const spanishSummary = Array.isArray(customData)
                                                            ? customData.find(d => d.name === "resumen_espanol")?.value
                                                            : null;

                                                        return spanishSummary || call.analysis?.call_summary || (
                                                            (() => {
                                                                const callTime = call.timestamp?.toDate ? call.timestamp.toDate().getTime() : 0;
                                                                const now = new Date().getTime();
                                                                const diffMinutes = (now - callTime) / 1000 / 60;

                                                                if (diffMinutes > 1) {
                                                                    return (
                                                                        <span className="text-red-400 italic flex items-center gap-1">
                                                                            <Frown className="h-3 w-3" /> No se pudo procesar la llamada
                                                                        </span>
                                                                    );
                                                                }

                                                                return (
                                                                    <span className="text-gray-400 italic flex items-center gap-1">
                                                                        <Loader2 className="h-3 w-3 animate-spin" /> Procesando resumen...
                                                                    </span>
                                                                );
                                                            })()
                                                        );
                                                    })()}
                                                </div>
                                                    // Render badges for all custom fields found in the data
                                                const customData = call.analysis?.custom_analysis_data;
                                                    if (Array.isArray(customData) && customData.length > 0) {
                                                        const visibleMetrics = customData.filter((d: any) =>
                                                // Filter out internal or summary text fields to only show "metrics"
                                                d.name !== 'resumen_espanol' &&
                                                d.name !== 'summary' &&
                                                d.value !== null &&
                                                d.value !== undefined &&
                                                d.value !== ""
                                                );

                                                        if (visibleMetrics.length > 0) {
                                                            return (
                                                <div className="flex gap-2 mt-2 flex-wrap">
                                                    {visibleMetrics.map((d: any, i: number) => (
                                                        <Badge
                                                            key={i}
                                                            variant="secondary"
                                                            className="rounded-md font-medium text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800"
                                                        >
                                                            <span className="opacity-70 mr-1.5 uppercase tracking-wide font-bold">{d.name}:</span>
                                                            <span className="truncate max-w-[200px]">{String(d.value)}</span>
                                                        </Badge>
                                                    ))}
                                                </div>
                                                );
                                                        }
                                                    }
                                                })()}

                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedCall(call)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 text-blue-600 border-blue-200"
                                            >
                                                <MessageSquare className="h-4 w-4 mr-2" />
                                                Chat
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div >
            )
            }

            <Dialog open={!!selectedCall} onOpenChange={(open) => !open && setSelectedCall(null)}>
                <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
                    <DialogHeader className="p-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                        <DialogTitle className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <span>Transcripción de Llamada</span>
                                <span className="text-xs font-normal text-gray-500">
                                    {selectedCall?.timestamp?.toDate?.().toLocaleString()}
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
        </>
    );
}
