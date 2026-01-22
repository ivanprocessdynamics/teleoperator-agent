"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChatTranscript } from "./ChatTranscript";
import { Loader2, MessageSquare, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { cn } from "@/lib/utils";

interface CallRecord {
    id: string;
    agent_id: string;
    analysis: {
        post_call_summary?: string;
        post_call_sentiment?: string; // 'Positive' | 'Negative' | 'Neutral'
        custom_analysis_data?: { name: string; value: any }[];
    };
    transcript_object: { role: 'user' | 'agent', content: string }[];
    recording_url?: string;
    duration?: number;
    timestamp: Timestamp;
}

interface CallHistoryTableProps {
    agentId?: string; // If provided, filter by agent
}

function timeAgo(date: Date) {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return "hace " + Math.floor(interval) + " años";
    interval = seconds / 2592000;
    if (interval > 1) return "hace " + Math.floor(interval) + " meses";
    interval = seconds / 86400;
    if (interval > 1) return "hace " + Math.floor(interval) + " días";
    interval = seconds / 3600;
    if (interval > 1) return "hace " + Math.floor(interval) + " horas";
    interval = seconds / 60;
    if (interval > 1) return "hace " + Math.floor(interval) + " min";
    return "hace unos segundos";
}

export function CallHistoryTable({ agentId }: CallHistoryTableProps) {
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);

    useEffect(() => {
        let q = query(collection(db, "calls"), orderBy("timestamp", "desc"), limit(50));

        if (agentId) {
            q = query(collection(db, "calls"), where("agent_id", "==", agentId), orderBy("timestamp", "desc"), limit(50));
        }

        const unsub = onSnapshot(q, (snapshot) => {
            console.log(`[CallHistory] Querying for agentId: ${agentId || 'ALL'}`);
            console.log(`[CallHistory] Found ${snapshot.docs.length} documents.`);
            snapshot.docs.forEach(d => console.log("Doc:", d.id, d.data().agent_id, d.data().timestamp));

            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CallRecord));
            setCalls(data);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching calls:", err);
            setLoading(false);
        });

        return () => unsub();
    }, [agentId]);

    const getSentimentColor = (sentiment?: string) => {
        if (!sentiment) return "bg-gray-100 text-gray-800";
        const s = sentiment.toLowerCase();
        if (s.includes("positive") || s.includes("positiva")) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
        if (s.includes("negative") || s.includes("negativa")) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return "--";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Debug state
    const [allCallsCount, setAllCallsCount] = useState<number | null>(null);

    useEffect(() => {
        // Parallel debug query: Count ALL calls in the system
        const debugQ = query(collection(db, "calls"));
        onSnapshot(debugQ, (snap) => setAllCallsCount(snap.size));
    }, []);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

    if (calls.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500 gap-4">
                <p>No se encontraron llamadas para este Agente.</p>

                {/* Debug Info Box */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-md text-sm text-left max-w-lg">
                    <p className="font-bold text-yellow-800 dark:text-yellow-500 mb-2">🔧 Panel de Diagnóstico:</p>
                    <ul className="space-y-1 font-mono text-xs">
                        <li>Filtro Agent ID: <span className="font-bold">{agentId || "(Vacío)"}</span></li>
                        <li>Llamadas mostradas: 0</li>
                        <li>Llamadas TOTALES en DB: {allCallsCount !== null ? allCallsCount : "Cargando..."}</li>
                        <li className="text-gray-500 mt-2">
                            {allCallsCount && allCallsCount > 0
                                ? "💡 Hay llamadas en el sistema, pero no coinciden con este Agent ID."
                                : "💡 La base de datos está vacía. El webhook no ha guardado nada aún."}
                        </li>
                    </ul>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="rounded-md border border-gray-200 dark:border-gray-800 overflow-hidden">
                <Table>
                    <TableHeader className="bg-gray-50 dark:bg-gray-900">
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Duración</TableHead>
                            <TableHead>Sentimiento</TableHead>
                            <TableHead>Resumen/Resultado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {calls.map((call) => (
                            <TableRow key={call.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <span>{call.timestamp?.toDate ? timeAgo(call.timestamp.toDate()) : "Reciente"}</span>
                                        <span className="text-xs text-gray-400">{call.timestamp?.toDate?.().toLocaleString()}</span>
                                    </div>
                                </TableCell>
                                <TableCell>{formatDuration(call.duration)}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={cn("border-0", getSentimentColor(call.analysis.post_call_sentiment))}>
                                        {call.analysis.post_call_sentiment || "N/A"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="max-w-xs truncate" title={call.analysis.post_call_summary}>
                                    {call.analysis.post_call_summary || (
                                        <span className="text-gray-400 italic">Sin resumen</span>
                                    )}
                                    {/* Display some custom data if available */}
                                    {call.analysis.custom_analysis_data && call.analysis.custom_analysis_data.length > 0 && (
                                        <div className="flex gap-1 mt-1 flex-wrap">
                                            {call.analysis.custom_analysis_data.slice(0, 2).map((d, i) => (
                                                <span key={i} className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                                                    {d.name}: {String(d.value)}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedCall(call)}>
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        Ver Chat
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={!!selectedCall} onOpenChange={(open) => !open && setSelectedCall(null)}>
                <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="p-6 pb-2 border-b border-gray-100 dark:border-gray-800">
                        <DialogTitle className="flex items-center gap-2">
                            <PhoneIncoming className="h-5 w-5 text-blue-500" />
                            Detalles de la Llamada
                            <span className="text-sm font-normal text-gray-500 ml-auto">
                                {selectedCall?.timestamp?.toDate?.().toLocaleString()}
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    {selectedCall && (
                        <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900/50">
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
