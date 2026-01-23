"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { VoiceOrb } from "@/components/VoiceOrb";
import { CampaignAnalysis } from "@/components/campaigns/CampaignAnalysis";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Check, Loader2, FileText, Mic, Brain, ChevronDown, ChevronUp, Cloud } from "lucide-react";
import { AnalysisConfig } from "@/types/campaign";

import { useDebounce } from "@/hooks/use-debounce";

interface TestingEnvironmentProps {
    subworkspaceId: string;
}

export function TestingEnvironment({ subworkspaceId }: TestingEnvironmentProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [prompt, setPrompt] = useState("");
    const [activePrompt, setActivePrompt] = useState("");
    const [retellAgentId, setRetellAgentId] = useState("");

    // Status states
    const [savingDraft, setSavingDraft] = useState(false);
    const [draftSaved, setDraftSaved] = useState(false);
    const [activating, setActivating] = useState(false);
    const [activeSuccess, setActiveSuccess] = useState(false);

    // Variable State
    const [variables, setVariables] = useState<Record<string, string>>({});

    // Analysis Config State
    const [analysisConfig, setAnalysisConfig] = useState<AnalysisConfig | undefined>(undefined);
    const [showAnalysis, setShowAnalysis] = useState(false);

    // Debounced prompt for auto-saving
    const debouncedPrompt = useDebounce(prompt, 2000);

    // Key to reset uncontrolled Textarea
    const [initialLoadKey, setInitialLoadKey] = useState(0);

    // Load subworkspace data
    useEffect(() => {
        async function loadData() {
            if (!subworkspaceId) return;
            setError(null);
            setLoading(true);

            try {
                const snap = await getDoc(doc(db, "subworkspaces", subworkspaceId));
                if (snap.exists()) {
                    const data = snap.data();
                    const liveActive = data.active_prompt || "";
                    const liveDraft = data.draft_prompt;

                    // If we have a draft, load it. If not, default to active. 
                    const initialPrompt = liveDraft !== undefined ? liveDraft : liveActive;

                    setPrompt(initialPrompt);
                    setActivePrompt(liveActive);

                    setRetellAgentId(data.retell_agent_id || "");
                    setAnalysisConfig(data.analysis_config);
                    setInitialLoadKey(prev => prev + 1);
                } else {
                    setError("No se encontró la configuración del workspace.");
                }
            } catch (error) {
                console.error("Error loading subworkspace:", error);
                setError("Error de conexión al cargar el prompt. Verifica tu internet y recarga.");
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [subworkspaceId]);

    // Auto-save Draft
    useEffect(() => {
        if (loading || !subworkspaceId) return;

        const saveDraft = async () => {
            setSavingDraft(true);
            try {
                await updateDoc(doc(db, "subworkspaces", subworkspaceId), {
                    draft_prompt: debouncedPrompt
                });
                setDraftSaved(true);
                setTimeout(() => setDraftSaved(false), 2000);
            } catch (err) {
                console.error("Error auto-saving draft:", err);
            } finally {
                setSavingDraft(false);
            }
        };

        if (debouncedPrompt !== undefined) {
            saveDraft();
        }

    }, [debouncedPrompt, subworkspaceId, loading]);

    // Helper Functions
    const extractVariables = (text: string) => {
        const regex = /\{\{([^}]+)\}\}/g;
        const matches = text.match(regex);
        const uniqueVars = matches ? Array.from(new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))) : [];
        return uniqueVars.filter(v => v !== 'campaign_prompt');
    };

    const foundVariables = extractVariables(prompt);

    const handleVariableChange = (name: string, value: string) => {
        setVariables(prev => ({ ...prev, [name]: value }));
    };

    const getPromptWithVariables = () => {
        let finalPrompt = prompt;
        foundVariables.forEach(v => {
            const value = variables[v] || `[${v}]`;
            finalPrompt = finalPrompt.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), value);
        });
        return finalPrompt;
    };

    const handleActivate = async () => {
        if (!subworkspaceId) return;

        setActivating(true);
        try {
            await updateDoc(doc(db, "subworkspaces", subworkspaceId), {
                active_prompt: prompt,
                draft_prompt: prompt
            });

            setActivePrompt(prompt);
            setActiveSuccess(true);
            setTimeout(() => setActiveSuccess(false), 3000);
        } catch (error) {
            console.error("Error activating prompt:", error);
            alert("Error al activar el prompt");
        } finally {
            setActivating(false);
        }
    };

    const handleUpdateAnalysis = async (newConfig: AnalysisConfig) => {
        setAnalysisConfig(newConfig);
        if (subworkspaceId) {
            try {
                await updateDoc(doc(db, "subworkspaces", subworkspaceId), {
                    analysis_config: newConfig,
                });
                if (retellAgentId) {
                    await fetch('/api/retell/update-agent', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            agent_id: retellAgentId,
                            analysis_config: newConfig
                        })
                    });
                }
            } catch (error) {
                console.error("Error saving analysis config:", error);
            }
        }
    };

    const hasUnactivatedChanges = prompt !== activePrompt;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-red-500">{error}</p>
                <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                >
                    Reintentar
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
            {/* Left Column: Prompt Editor & Variables & Analysis */}
            <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2">
                {/* Prompt Editor */}
                <div className={`rounded-xl border transition-colors ${hasUnactivatedChanges ? 'border-amber-200 dark:border-amber-500/30' : 'border-gray-200 dark:border-green-500/30'} bg-white dark:bg-gray-800/20 overflow-hidden shrink-0`}>
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                            <FileText className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Prompt de Prueba</h3>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Edita en vivo. Se guarda automáticamente.
                                </p>
                                {savingDraft ? (
                                    <span className="text-xs text-blue-500 flex items-center animate-pulse"><Cloud className="h-3 w-3 mr-1" /> Guardando...</span>
                                ) : draftSaved ? (
                                    <span className="text-xs text-gray-400 flex items-center"><Check className="h-3 w-3 mr-1" /> Borrador guardado</span>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="p-5 space-y-4">
                        <Textarea
                            key={initialLoadKey}
                            defaultValue={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Escribe aquí el prompt para tu agente de voz..."
                            className="min-h-[250px] resize-none border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 font-sans text-base leading-relaxed"
                        />

                        <div className="flex items-center justify-between">
                            <div className="text-xs">
                                {hasUnactivatedChanges ? (
                                    <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                                        ● Cambios pendientes de activar
                                    </span>
                                ) : (
                                    <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                        ● Todo activado y sincronizado
                                    </span>
                                )}
                            </div>

                            <Button
                                onClick={handleActivate}
                                disabled={activating || !hasUnactivatedChanges}
                                className={`
                                    transition-all
                                    ${activeSuccess
                                        ? "bg-green-600 hover:bg-green-700 text-white"
                                        : "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800"
                                    }
                                `}
                            >
                                {activating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Activando...
                                    </>
                                ) : activeSuccess ? (
                                    <>
                                        <Check className="mr-2 h-4 w-4" />
                                        ¡Activado!
                                    </>
                                ) : (
                                    "Activar"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Variables Section */}
                {foundVariables.length > 0 && (
                    <div className="rounded-xl border border-gray-200 dark:border-blue-500/30 bg-white dark:bg-blue-500/10 overflow-hidden shrink-0">
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
                                <span className="text-xs font-bold">{"{ }"}</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">Variables Detectadas</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Define los valores para las variables en tu prompt
                                </p>
                            </div>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {foundVariables.map(v => (
                                <div key={v} className="space-y-2">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                        {`{{${v}}}`}
                                    </label>
                                    <input
                                        type="text"
                                        value={variables[v] || ''}
                                        onChange={(e) => handleVariableChange(v, e.target.value)}
                                        placeholder={`Valor para ${v}`}
                                        className="w-full text-sm px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Analysis Config Section (Collapsible) */}
                <div className="rounded-xl border border-gray-200 dark:border-blue-500/30 bg-white dark:bg-blue-500/10 overflow-hidden shrink-0">
                    <button
                        onClick={() => setShowAnalysis(!showAnalysis)}
                        className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
                                <Brain className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                                <h3 className="font-semibold text-gray-900 dark:text-white">Análisis e IA</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Configura qué datos recoger de las llamadas
                                </p>
                            </div>
                        </div>
                        {showAnalysis ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                    </button>

                    {showAnalysis && (
                        <div className="p-5 border-t border-gray-100 dark:border-gray-700">
                            <CampaignAnalysis
                                config={analysisConfig}
                                onChange={handleUpdateAnalysis}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Voice Orb */}
            <div className="h-full">
                <div className="rounded-xl border border-gray-200 dark:border-blue-500/30 bg-white dark:bg-blue-500/10 p-8 h-full flex flex-col justify-center items-center relative overflow-hidden">
                    {/* Decorative background elements */}
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20 dark:opacity-10">
                        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-400 rounded-full blur-3xl mix-blend-multiply filter" />
                        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-400 rounded-full blur-3xl mix-blend-multiply filter" />
                    </div>

                    <div className="relative z-10 flex flex-col items-center max-w-md text-center space-y-8">
                        <div>
                            <div className="flex items-center justify-center gap-2 mb-3">
                                <Mic className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Probar Agente</h3>
                            </div>
                            <p className="text-gray-500 dark:text-gray-400">
                                Habla con tu agente para probar el prompt configurado.
                                <br />
                                <span className="text-xs text-blue-500 font-medium">Estás probando la versión en pantalla (Borrador)</span>
                            </p>
                        </div>

                        {retellAgentId ? (
                            <div className="transform scale-125">
                                <VoiceOrb
                                    agentId={retellAgentId}
                                    prompt={getPromptWithVariables()}
                                    analysisConfig={analysisConfig}
                                />
                            </div>
                        ) : (
                            <div className="py-8 text-center text-gray-500">
                                No hay agente de voz configurado.
                            </div>
                        )}

                        {retellAgentId && (
                            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700/50 w-full">
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    Agent ID: <code className="font-mono">{retellAgentId}</code>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
