"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChatTranscript } from "@/components/calls/ChatTranscript";
import {
    GraduationCap, AlertTriangle, ChevronDown, ChevronUp,
    Loader2, Sparkles, BookOpen, MessageSquare, Target,
    Lightbulb, TrendingUp, Clock, Zap, FileText, ArrowRight,
    Plus, Pencil, Trash2, TriangleAlert
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth-fetch";

// ─── Types ────────────────────────────────────────────────────────────────
interface TrainingError {
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    transcript_excerpt: string;
}

interface TrainingFlags {
    has_errors: boolean;
    overall_score: number;
    errors: TrainingError[];
}

interface FlaggedCall {
    id: string;
    caller_phone: string | null;
    duration: number;
    start_timestamp: number;
    recording_url: string | null;
    transcript_object: { role: "user" | "agent"; content: string }[];
    training_flags: TrainingFlags;
}

interface Suggestion {
    type: 'add' | 'modify' | 'remove';
    section?: string;
    topic?: string;
    current?: string;
    suggested: string;
    reason: string;
}

interface RecurringIssue {
    issue: string;
    frequency: string;
    impact: 'low' | 'medium' | 'high';
}

interface GlobalAnalysis {
    summary: string;
    overall_score: number;
    prompt_suggestions: Suggestion[];
    kb_suggestions: Suggestion[];
    recurring_issues: RecurringIssue[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────
const ERROR_TYPE_LABELS: Record<string, { label: string; icon: typeof AlertTriangle }> = {
    kb_contradiction: { label: 'Contradice la KB', icon: BookOpen },
    instruction_violation: { label: 'No sigue instrucciones', icon: Target },
    incorrect_info: { label: 'Info incorrecta', icon: AlertTriangle },
    poor_handling: { label: 'Mala gestión', icon: MessageSquare },
    missed_opportunity: { label: 'Oportunidad perdida', icon: Lightbulb },
};

const SEVERITY_CONFIG = {
    high: { label: 'Alta', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    medium: { label: 'Media', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    low: { label: 'Baja', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
};

function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(s: number) {
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function ScoreCircle({ score }: { score: number }) {
    const color = score >= 8 ? 'text-green-600' : score >= 5 ? 'text-amber-600' : 'text-red-600';
    const bg = score >= 8 ? 'bg-green-50 dark:bg-green-900/20' : score >= 5 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-red-50 dark:bg-red-900/20';
    return (
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border", bg, color)}>
            {score}
        </div>
    );
}

// ─── Error Card ───────────────────────────────────────────────────────────
function ErrorCallCard({ call, expanded, onToggle }: { call: FlaggedCall; expanded: boolean; onToggle: () => void }) {
    const flags = call.training_flags;
    const highSeverity = flags.errors.filter(e => e.severity === 'high').length;
    const medSeverity = flags.errors.filter(e => e.severity === 'medium').length;

    return (
        <div className={cn(
            "rounded-xl border transition-all duration-200",
            highSeverity > 0 ? "border-red-200 dark:border-red-800" : "border-amber-200 dark:border-amber-800",
            expanded ? "shadow-lg" : "shadow-sm hover:shadow-md"
        )}>
            <div className="p-4 cursor-pointer select-none" onClick={onToggle}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ScoreCircle score={flags.overall_score} />
                        <div>
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                                <span>{formatDate(call.start_timestamp)}</span>
                                <span className="text-gray-400">·</span>
                                <span className="text-gray-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDuration(call.duration)}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                {highSeverity > 0 && (
                                    <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                                        {highSeverity} error{highSeverity > 1 ? 'es' : ''} grave{highSeverity > 1 ? 's' : ''}
                                    </span>
                                )}
                                {medSeverity > 0 && (
                                    <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                                        {medSeverity} medio{medSeverity > 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>

                {/* Error summaries (always visible) */}
                <div className="mt-3 space-y-1.5">
                    {flags.errors.slice(0, expanded ? undefined : 2).map((err, i) => {
                        const typeConfig = ERROR_TYPE_LABELS[err.type] || ERROR_TYPE_LABELS.poor_handling;
                        const Icon = typeConfig.icon;
                        const sevConfig = SEVERITY_CONFIG[err.severity];
                        return (
                            <div key={i} className="flex items-start gap-2 text-xs">
                                <span className={cn("px-1.5 py-0.5 rounded font-medium flex-shrink-0", sevConfig.color)}>
                                    <Icon className="w-3 h-3 inline mr-1" />
                                    {typeConfig.label}
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">{err.description}</span>
                            </div>
                        );
                    })}
                    {!expanded && flags.errors.length > 2 && (
                        <span className="text-xs text-gray-400">+{flags.errors.length - 2} más...</span>
                    )}
                </div>
            </div>

            {/* Expanded: full transcript */}
            {expanded && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                    {/* Error excerpts */}
                    {flags.errors.some(e => e.transcript_excerpt) && (
                        <div className="p-4 bg-red-50/50 dark:bg-red-900/10 border-b border-gray-200 dark:border-gray-700 space-y-2">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Fragmentos con errores</p>
                            {flags.errors.filter(e => e.transcript_excerpt).map((err, i) => (
                                <div key={i} className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg p-3 border border-red-100 dark:border-red-800/30">
                                    <span className="font-medium text-red-600 dark:text-red-400">"{err.transcript_excerpt}"</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="h-[400px]">
                        <ChatTranscript messages={call.transcript_object || []} audioUrl={call.recording_url} />
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Suggestion Card ──────────────────────────────────────────────────────
function SuggestionCard({ suggestion, type }: { suggestion: Suggestion; type: 'prompt' | 'kb' }) {
    const typeIcons = { add: Plus, modify: Pencil, remove: Trash2 };
    const typeLabels = { add: 'Añadir', modify: 'Modificar', remove: 'Eliminar' };
    const typeColors = {
        add: 'text-green-600 bg-green-50 dark:bg-green-900/20',
        modify: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
        remove: 'text-red-600 bg-red-50 dark:bg-red-900/20',
    };
    const Icon = typeIcons[suggestion.type] || Pencil;

    return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1", typeColors[suggestion.type])}>
                        <Icon className="w-3 h-3" />
                        {typeLabels[suggestion.type]}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {type === 'prompt' ? suggestion.section : suggestion.topic}
                    </span>
                </div>
            </div>
            <div className="p-3 space-y-2">
                {suggestion.current && (
                    <div className="rounded bg-red-50 dark:bg-red-900/10 p-2 text-xs font-mono text-red-800 dark:text-red-300 border border-red-100 dark:border-red-800/30">
                        <span className="text-red-500 font-bold mr-1">−</span>
                        {suggestion.current}
                    </div>
                )}
                {suggestion.suggested && (
                    <div className="rounded bg-green-50 dark:bg-green-900/10 p-2 text-xs font-mono text-green-800 dark:text-green-300 border border-green-100 dark:border-green-800/30">
                        <span className="text-green-500 font-bold mr-1">+</span>
                        {suggestion.suggested}
                    </div>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">{suggestion.reason}</p>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────
export function AgentTraining({ agentId, subworkspaceId }: { agentId: string; subworkspaceId: string }) {
    const [flaggedCalls, setFlaggedCalls] = useState<FlaggedCall[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Global analysis state
    const [analyzing, setAnalyzing] = useState(false);
    const [globalAnalysis, setGlobalAnalysis] = useState<GlobalAnalysis | null>(null);
    const [callCount, setCallCount] = useState(20);
    const [analysisError, setAnalysisError] = useState('');

    // Fetch calls with training errors
    useEffect(() => {
        if (!agentId) return;

        const q = query(
            collection(db, 'calls'),
            where('agent_id', '==', agentId),
            where('training_flags.has_errors', '==', true),
            orderBy('start_timestamp', 'desc')
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FlaggedCall));
            setFlaggedCalls(data);
            setLoading(false);
        }, (err) => {
            console.error('Error loading training data:', err);
            setLoading(false);
        });

        return () => unsub();
    }, [agentId]);

    const handleGlobalAnalysis = async () => {
        setAnalyzing(true);
        setAnalysisError('');
        setGlobalAnalysis(null);
        try {
            const res = await authFetch('/api/web/training-analysis', {
                method: 'POST',
                body: JSON.stringify({ subworkspaceId, callCount }),
            });
            const data = await res.json();
            if (res.ok && data.analysis) {
                setGlobalAnalysis(data.analysis);
            } else {
                setAnalysisError(data.error || 'Error en el análisis');
            }
        } catch (e) {
            setAnalysisError('Error de conexión');
        } finally {
            setAnalyzing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* ─── Global Analysis Panel ─────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-800/40 rounded-xl">
                            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">Análisis Global con IA</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Analiza las últimas conversaciones junto con el prompt y KB para proponer mejoras
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                    <label className="text-sm text-gray-700 dark:text-gray-300 font-medium">Últimas</label>
                    <select
                        value={callCount}
                        onChange={e => setCallCount(Number(e.target.value))}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm"
                    >
                        <option value={10}>10 llamadas</option>
                        <option value={20}>20 llamadas</option>
                        <option value={50}>50 llamadas</option>
                    </select>
                    <button
                        onClick={handleGlobalAnalysis}
                        disabled={analyzing}
                        className="ml-auto bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                    >
                        {analyzing ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Analizando...</>
                        ) : (
                            <><Zap className="w-4 h-4" /> Analizar y proponer mejoras</>
                        )}
                    </button>
                </div>

                {analysisError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg text-sm flex items-center gap-2">
                        <TriangleAlert className="w-4 h-4" />
                        {analysisError}
                    </div>
                )}

                {/* Global Analysis Results */}
                {globalAnalysis && (
                    <div className="space-y-5 mt-4">
                        {/* Summary */}
                        <div className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                            <ScoreCircle score={globalAnalysis.overall_score} />
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">Valoración General</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{globalAnalysis.summary}</p>
                            </div>
                        </div>

                        {/* Recurring Issues */}
                        {globalAnalysis.recurring_issues?.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-amber-600" />
                                    Problemas Recurrentes
                                </h4>
                                <div className="space-y-2">
                                    {globalAnalysis.recurring_issues.map((issue, i) => (
                                        <div key={i} className="flex items-start gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                            <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0", SEVERITY_CONFIG[issue.impact].color)}>
                                                {SEVERITY_CONFIG[issue.impact].label}
                                            </span>
                                            <div>
                                                <p className="text-sm text-gray-900 dark:text-white">{issue.issue}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{issue.frequency}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Prompt Suggestions */}
                        {globalAnalysis.prompt_suggestions?.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                    Sugerencias para el Prompt ({globalAnalysis.prompt_suggestions.length})
                                </h4>
                                <div className="space-y-3">
                                    {globalAnalysis.prompt_suggestions.map((s, i) => (
                                        <SuggestionCard key={i} suggestion={s} type="prompt" />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* KB Suggestions */}
                        {globalAnalysis.kb_suggestions?.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-green-600" />
                                    Sugerencias para la Base de Conocimiento ({globalAnalysis.kb_suggestions.length})
                                </h4>
                                <div className="space-y-3">
                                    {globalAnalysis.kb_suggestions.map((s, i) => (
                                        <SuggestionCard key={i} suggestion={s} type="kb" />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ─── Flagged Calls List ────────────────────────────────────────── */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Conversaciones con Errores
                    </h2>
                    <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                        {flaggedCalls.length}
                    </span>
                </div>

                {flaggedCalls.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                        <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Sin errores detectados</p>
                        <p className="text-xs mt-1">Las conversaciones con errores aparecerán aquí automáticamente</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {flaggedCalls.map(call => (
                            <ErrorCallCard
                                key={call.id}
                                call={call}
                                expanded={expandedId === call.id}
                                onToggle={() => setExpandedId(expandedId === call.id ? null : call.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
