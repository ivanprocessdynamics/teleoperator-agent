"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChatTranscript } from "@/components/calls/ChatTranscript";
import {
    UserPlus, Phone, ChevronDown, ChevronUp, Star,
    PhoneCall, CheckCircle2, XCircle, Clock, Loader2,
    Sparkles, ArrowRight, Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth-fetch";

interface LeadCall {
    id: string;
    caller_phone: string | null;
    duration: number;
    start_timestamp: number;
    recording_url: string | null;
    transcript_object: { role: "user" | "agent"; content: string }[];
    lead_analysis: {
        is_potential_lead: boolean;
        score: number;
        reason: string;
        interest_topic: string;
        recommended_action: string;
    };
    lead_status: 'new' | 'contacted' | 'converted' | 'dismissed';
}

const STATUS_CONFIG = {
    new: { label: 'Nuevo', icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
    contacted: { label: 'Contactado', icon: PhoneCall, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
    converted: { label: 'Convertido', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' },
    dismissed: { label: 'Descartado', icon: XCircle, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/50', border: 'border-gray-200 dark:border-gray-700' },
};

function ScoreBadge({ score }: { score: number }) {
    const color = score >= 8 ? 'bg-green-500' : score >= 5 ? 'bg-amber-500' : 'bg-red-400';
    return (
        <div className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-xs font-bold", color)}>
            <Star className="w-3 h-3 fill-current" />
            {score}/10
        </div>
    );
}

function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('es-ES', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function LeadCard({ lead, expanded, onToggle }: { lead: LeadCall; expanded: boolean; onToggle: () => void }) {
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const statusConfig = STATUS_CONFIG[lead.lead_status] || STATUS_CONFIG.new;
    const StatusIcon = statusConfig.icon;

    const handleStatusChange = async (newStatus: string) => {
        setUpdatingStatus(true);
        try {
            const res = await authFetch('/api/web/update-lead-status', {
                method: 'POST',
                body: JSON.stringify({ callId: lead.id, status: newStatus }),
            });
            if (!res.ok) throw new Error('Failed');
        } catch (err) {
            console.error('Error updating status:', err);
        } finally {
            setUpdatingStatus(false);
        }
    };

    return (
        <div className={cn(
            "rounded-xl border transition-all duration-200",
            statusConfig.border,
            lead.lead_status === 'dismissed' ? 'opacity-60' : '',
            expanded ? 'shadow-lg' : 'shadow-sm hover:shadow-md'
        )}>
            {/* Card Header */}
            <div
                className={cn("p-4 cursor-pointer select-none", statusConfig.bg)}
                onClick={onToggle}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ScoreBadge score={lead.lead_analysis?.score || 0} />
                        <div>
                            <div className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-gray-500" />
                                <span className="font-semibold text-gray-900 dark:text-white text-sm">
                                    {lead.caller_phone || 'Número no disponible'}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                <span>{formatDate(lead.start_timestamp)}</span>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDuration(lead.duration)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={cn("flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full", statusConfig.color, statusConfig.bg)}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                        </span>
                        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                </div>

                {/* AI Summary (always visible) */}
                <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-gray-900 dark:text-white">Interés:</span>{' '}
                    {lead.lead_analysis?.interest_topic || 'No determinado'}
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">
                    {lead.lead_analysis?.reason || ''}
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                    {/* Recommended Action */}
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800">
                        <div className="flex items-start gap-2">
                            <ArrowRight className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider mb-1">
                                    Acción Recomendada
                                </p>
                                <p className="text-sm text-indigo-900 dark:text-indigo-200">
                                    {lead.lead_analysis?.recommended_action || 'Contactar al cliente'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Status buttons */}
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
                        {updatingStatus && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                            const Icon = config.icon;
                            const isActive = lead.lead_status === key;
                            return (
                                <button
                                    key={key}
                                    onClick={(e) => { e.stopPropagation(); handleStatusChange(key); }}
                                    disabled={isActive || updatingStatus}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                        isActive
                                            ? `${config.bg} ${config.color} ring-1 ring-current`
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                                    )}
                                >
                                    <Icon className="w-3 h-3" />
                                    {config.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Transcript */}
                    <div className="h-[400px]">
                        <ChatTranscript
                            messages={lead.transcript_object || []}
                            audioUrl={lead.recording_url}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export function PotentialClients({ agentId }: { agentId: string }) {
    const [leads, setLeads] = useState<LeadCall[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        if (!agentId) return;

        const q = query(
            collection(db, 'calls'),
            where('agent_id', '==', agentId),
            where('is_potential_lead', '==', true),
            orderBy('start_timestamp', 'desc')
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LeadCall));
            setLeads(data);
            setLoading(false);
        }, (err) => {
            console.error('Error loading leads:', err);
            setLoading(false);
        });

        return () => unsub();
    }, [agentId]);

    const filtered = statusFilter === 'all'
        ? leads
        : leads.filter(l => l.lead_status === statusFilter);

    const counts = {
        all: leads.length,
        new: leads.filter(l => l.lead_status === 'new').length,
        contacted: leads.filter(l => l.lead_status === 'contacted').length,
        converted: leads.filter(l => l.lead_status === 'converted').length,
        dismissed: leads.filter(l => l.lead_status === 'dismissed').length,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header with counts */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Clientes Potenciales
                    </h2>
                    <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                        {counts.new} nuevos
                    </span>
                </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
                {[
                    { key: 'all', label: 'Todos' },
                    { key: 'new', label: 'Nuevos' },
                    { key: 'contacted', label: 'Contactados' },
                    { key: 'converted', label: 'Convertidos' },
                    { key: 'dismissed', label: 'Descartados' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setStatusFilter(tab.key)}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                            statusFilter === tab.key
                                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                    >
                        {tab.label} ({counts[tab.key as keyof typeof counts]})
                    </button>
                ))}
            </div>

            {/* Leads list */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No hay clientes potenciales</p>
                    <p className="text-xs mt-1">Los leads aparecerán aquí cuando el agente detecte llamantes interesados que no agendaron</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(lead => (
                        <LeadCard
                            key={lead.id}
                            lead={lead}
                            expanded={expandedId === lead.id}
                            onToggle={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
