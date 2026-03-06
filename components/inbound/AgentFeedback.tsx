"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Star, MessageSquareText, ShieldAlert, CheckCircle2, Phone, CalendarClock, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface FeedbackEvent {
    id: string;
    incident_id: string;
    agent_id: string;
    score_punctuality: number;
    score_treatment: number;
    score_resolution: number;
    global_score: number;
    comments: string;
    created_at: number;
}

interface IncidentSnapshot {
    id: string;
    client_name: string;
    contact_phone: string;
    issue_details: string;
}

function StarRating({ value }: { value: number }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    className={cn(
                        "w-4 h-4",
                        star <= value
                            ? "fill-indigo-500 text-indigo-500"
                            : "fill-gray-100 text-gray-200 dark:fill-gray-800 dark:text-gray-700"
                    )}
                />
            ))}
        </div>
    );
}

function formatDateSafe(timestamp: number) {
    if (!timestamp) return "Desconocido";
    try {
        return format(new Date(timestamp), "d MMM yyyy, HH:mm", { locale: es });
    } catch (e) {
        return "Fecha inválida";
    }
}

export function AgentFeedback({ agentId, subworkspaceId }: { agentId: string; subworkspaceId: string }) {
    const [feedbacks, setFeedbacks] = useState<FeedbackEvent[]>([]);
    const [incidentsMap, setIncidentsMap] = useState<Record<string, IncidentSnapshot>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!agentId) return;

        const q = query(
            collection(db, "feedbacks"),
            where("agent_id", "==", agentId),
            orderBy("created_at", "desc")
        );

        const unsub = onSnapshot(q, async (snapshot) => {
            const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as FeedbackEvent));
            setFeedbacks(data);

            if (data.length > 0) {
                // Fetch missing incidents for these feedbacks dynamically
                const incidentIds = Array.from(new Set(data.map((f) => f.incident_id).filter(Boolean)));
                if (incidentIds.length > 0) {
                    const incidentsQ = query(collection(db, "incidents"), where("__name__", "in", incidentIds.slice(0, 10)));
                    const incSnap = await getDocs(incidentsQ);
                    const mapping: Record<string, IncidentSnapshot> = {};
                    incSnap.forEach((doc) => {
                        mapping[doc.id] = { id: doc.id, ...doc.data() } as IncidentSnapshot;
                    });
                    setIncidentsMap(prev => ({ ...prev, ...mapping }));
                }
            }

            setLoading(false);
        }, (err) => {
            console.error("Error loading feedbacks:", err);
            setLoading(false);
        });

        return () => unsub();
    }, [agentId]);

    const averageGlobal = feedbacks.length > 0 ? (feedbacks.reduce((acc, f) => acc + f.global_score, 0) / feedbacks.length).toFixed(1) : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (feedbacks.length === 0) {
        return (
            <div className="text-center py-16 text-gray-400">
                <MessageSquareText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-gray-900 dark:text-white">Aún no hay reseñas</p>
                <p className="text-xs mt-1">Cuando los clientes valoren el servicio SMS, aparecerán aquí.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Reseñas del Servicio</h2>
                    <p className="text-sm text-gray-500">Valoraciones enviadas por clientes al finalizar la resolución.</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/30 px-5 py-2.5 rounded-2xl flex items-center gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{averageGlobal}</div>
                        <div className="text-[10px] font-semibold uppercase text-indigo-400 tracking-widest">Media</div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                {feedbacks.map((fb) => {
                    const incident = incidentsMap[fb.incident_id];
                    return (
                        <div key={fb.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-col sm:flex-row gap-4 sm:items-start justify-between mb-4">
                                <div className="space-y-1">
                                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                        {incident?.client_name || "Cliente Particular"}
                                        {incident?.contact_phone && (
                                            <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full flex gap-1 items-center">
                                                <Phone className="w-3 h-3" /> {incident.contact_phone}
                                            </span>
                                        )}
                                    </h3>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                        <CalendarClock className="w-3.5 h-3.5" />
                                        {formatDateSafe(fb.created_at)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-lg shrink-0">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nota Global:</span>
                                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{fb.global_score}/5</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 bg-gray-50/50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-50 dark:border-gray-800 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600 dark:text-gray-400 font-medium">Puntualidad</span>
                                    <StarRating value={fb.score_punctuality} />
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600 dark:text-gray-400 font-medium">Trato Recibido</span>
                                    <StarRating value={fb.score_treatment} />
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600 dark:text-gray-400 font-medium">Resolución Avería</span>
                                    <StarRating value={fb.score_resolution} />
                                </div>
                            </div>

                            {fb.comments && (
                                <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg rounded-tl-none relative">
                                    <MessageSquareText className="w-5 h-5 text-gray-300 absolute -top-1.5 -left-1.5 rotate-[-15deg] bg-white dark:bg-gray-800 rounded-full" />
                                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{fb.comments}"</p>
                                </div>
                            )}

                            {incident && fb.comments && (
                                <div className="mt-3 text-xs text-gray-400 flex gap-1.5 items-start">
                                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>
                                        Conteo de avería original: <span className="text-gray-500 font-medium">{incident.issue_details.substring(0, 100)}...</span>
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
