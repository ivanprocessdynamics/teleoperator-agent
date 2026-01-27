"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, limit, Timestamp, getDocs } from "firebase/firestore";
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
    Megaphone
} from "lucide-react";
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
}

export function CallHistoryTable({ agentId: initialAgentId }: CallHistoryTableProps) {
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
    useEffect(() => {
        // Fetch Agents first (Subworkspaces)
        const unsubAgents = onSnapshot(collection(db, "subworkspaces"), (agentSnap) => {
            const agentMap: Record<string, string> = {};
            agentSnap.docs.forEach(d => {
                const ad = d.data();
                if (ad.retell_agent_id) {
                    agentMap[ad.retell_agent_id] = ad.name || "Agente sin nombre";
                }
            });

            // Fetch Campaigns
            const unsubCampaigns = onSnapshot(collection(db, "campaigns"), (campSnap) => {
                const map: Record<string, string> = {};
                campSnap.docs.forEach(doc => {
                    const data = doc.data();
                    const campName = data.name || "Campaña sin nombre";

                    // If we are in Global Mode (no specific initialAgentId prop), append Agent Name
                    let finalName = campName;
                    if (!initialAgentId && data.retell_agent_id && agentMap[data.retell_agent_id]) {
                        finalName = `${campName} (${agentMap[data.retell_agent_id]})`;
                    } else if (!initialAgentId && data.agent_id && agentMap[data.agent_id]) {
                        // Fallback for older schema using agent_id
                        finalName = `${campName} (${agentMap[data.agent_id]})`;
                    }

                    map[doc.id] = finalName;
                    if (data.vapi_agent_id) {
                        map[data.vapi_agent_id] = finalName;
                    }
                });
                setCampaignMap(map);
            }, (err) => console.error("Error fetching campaigns:", err));

            return () => unsubCampaigns();
        }, (err) => console.error("Error fetching agents:", err));

        return () => unsubAgents();
    }, [initialAgentId]);

    useEffect(() => {
        setError(null);

        // Base query
        let constraints: any[] = [orderBy("timestamp", "desc"), limit(100)];

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
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CallRecord));
            setCalls(data);

            // Extract unique campaigns for filter
            // Check both agent_id and metadata.campaign_id
            const cIds = Array.from(new Set(data.map(c => {
                // If we have a mapped title for the agent_id, use that ID (or the agent_id itself)
                // We prefer metadata.campaign_id, then agent_id
                const candidateId = c.metadata?.campaign_id || c.agent_id;
                // Filter out if it's not a valid ID or if it maps to "Unknown" (optional, but requested)
                return candidateId;
            }).filter(id => id && id !== "undefined" && id !== "null"))) as string[];
            setUniqueCampaignIds(cIds);

            setLoading(false);
        }, (err) => {
            console.error("Error fetching calls:", err);
            setError(err.message || "Error cargando el historial.");
            setLoading(false);
        });

        return () => unsub();
    }, [interval, pickerStart, pickerEnd, refreshTrigger]);

    // Client-side Filtering
    useEffect(() => {
        let result = calls;

        // Filter by Campaign ID (matches agent_id or campaign_id)
        if (selectedCampaignId === "testing") {
            result = result.filter(c => c.metadata?.type === 'testing' || (!c.metadata?.campaign_id && !campaignMap[c.agent_id]));
        } else if (selectedCampaignId !== "all") {
            result = result.filter(c =>
                c.metadata?.campaign_id === selectedCampaignId ||
                c.agent_id === selectedCampaignId
            );
        }

        // Removed separate Source Filter logic as it is now merged

        setFilteredCalls(result);
    }, [calls, selectedCampaignId, campaignMap]);

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


                    {/* Campaign Filter */}
                    <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                        <SelectTrigger className="w-[200px] h-9 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800">
                            <Megaphone className="w-3.5 h-3.5 mr-2 text-gray-400" />
                            <SelectValue placeholder="Campaña" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las campañas</SelectItem>
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
                                                {(() => {
                                                    const customData = call.analysis?.custom_analysis_data;
                                                    if (Array.isArray(customData) && customData.length > 0) {
                                                        return (
                                                            <div className="flex gap-2 mt-2 flex-wrap">
                                                                {customData
                                                                    .filter(d => d.name !== "resumen_espanol")
                                                                    .map((d, i) => (
                                                                        <span key={i} className="inline-flex items-center text-[11px] bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-md border border-purple-100 dark:border-purple-800/50 font-medium shadow-sm">
                                                                            <span className="opacity-70 mr-1 uppercase text-[9px] tracking-wider">{d.name}:</span>
                                                                            <span>{String(d.value)}</span>
                                                                        </span>
                                                                    ))}
                                                            </div>
                                                        );
                                                    }
                                                    return null;
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
                </div>
            )}

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
