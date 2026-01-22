"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChatTranscript } from "./ChatTranscript";
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
    FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface CallRecord {
    id: string;
    agent_id: string;
    analysis: {
        call_summary?: string;     // Corrected from post_call_summary
        user_sentiment?: string;   // Corrected from post_call_sentiment
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

export function CallHistoryTable({ agentId }: CallHistoryTableProps) {
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);

    useEffect(() => {
        console.log("CallHistoryTable mounted. AgentId:", agentId);
        let q = query(collection(db, "calls"), orderBy("timestamp", "desc"), limit(50));

        if (agentId) {
            console.log("Setting up query for agent:", agentId);
            // TEMPORARILY REMOVED FILTER FOR DEBUGGING
            // q = query(collection(db, "calls"), where("agent_id", "==", agentId), orderBy("timestamp", "desc"), limit(50));
            // Fetch ALL calls to verify data exists
            q = query(collection(db, "calls"), orderBy("timestamp", "desc"), limit(50));
        } else {
            console.log("No agentId provided, querying all calls (limit 50)");
        }


        const unsub = onSnapshot(q, (snapshot) => {
            console.log("Snapshot received. Docs count:", snapshot.docs.length);
            const data = snapshot.docs.map(doc => {
                const d = doc.data();
                // Log specific fields for debugging
                // console.log(`Doc ${doc.id} Agent: ${d.agent_id} Time: ${d.timestamp}`);
                return { id: doc.id, ...d } as CallRecord;
            });
            setCalls(data);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching calls:", err);
            setLoading(false);
        });

        return () => unsub();
    }, [agentId]);

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

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;

    if (calls.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-900/50">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-full shadow-sm mb-4">
                    <PhoneIncoming className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sin llamadas registradas</h3>
                <p className="text-sm text-gray-500 max-w-sm mt-1">
                    No se han encontrado llamadas para este agente. Realiza una prueba para ver los resultados aquí.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-500" />
                        Historial Reciente
                    </h2>
                    <Badge variant="outline" className="text-xs font-normal">
                        Últimas {calls.length} llamadas
                    </Badge>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-gray-50/50 dark:bg-gray-900">
                            <TableRow>
                                <TableHead className="w-[180px]">Fecha y Hora</TableHead>
                                <TableHead className="w-[100px]">Duración</TableHead>
                                <TableHead className="w-[140px]">Sentimiento</TableHead>
                                <TableHead>Resumen de la Conversación</TableHead>
                                <TableHead className="text-right w-[120px]">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {calls.map((call) => {
                                const sentiment = getSentimentConfig(call.analysis?.user_sentiment);
                                const SentimentIcon = sentiment.icon;
                                const isExpanded = expandedSummaries.has(call.id);

                                return (
                                    <TableRow key={call.id} className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900 dark:text-white">
                                                    {call.timestamp?.toDate ?
                                                        formatDistanceToNow(call.timestamp.toDate(), { addSuffix: true, locale: es })
                                                        : "Reciente"}
                                                </span>
                                                <span className="text-xs text-gray-400 font-mono mt-0.5">
                                                    ID: {call.agent_id?.substring(0, 8)}...
                                                </span>
                                                <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                    <Calendar className="h-3 w-3" />
                                                    {call.timestamp?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
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
                                                    {call.analysis?.call_summary || (
                                                        <span className="text-gray-400 italic flex items-center gap-1">
                                                            <Loader2 className="h-3 w-3 animate-spin" /> Procesando resumen...
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Custom Data Tags */}
                                                {call.analysis?.custom_analysis_data && call.analysis.custom_analysis_data.length > 0 && (
                                                    <div className="flex gap-2 mt-2 flex-wrap">
                                                        {call.analysis.custom_analysis_data.slice(0, 3).map((d, i) => (
                                                            <span key={i} className="inline-flex items-center text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800 font-medium">
                                                                {d.name}: {String(d.value)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
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
            </div>

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
                                messages={selectedCall.transcript_object}
                                audioUrl={selectedCall.recording_url}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
