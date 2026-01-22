"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { VoiceOrb } from "@/components/VoiceOrb";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Check, Loader2, FileText, Mic } from "lucide-react";

interface TestingEnvironmentProps {
    subworkspaceId: string;
}

export function TestingEnvironment({ subworkspaceId }: TestingEnvironmentProps) {
    const [prompt, setPrompt] = useState("");
    const [savedPrompt, setSavedPrompt] = useState("");
    const [retellAgentId, setRetellAgentId] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    // Variable State
    const [variables, setVariables] = useState<Record<string, string>>({});

    // Load subworkspace data
    useEffect(() => {
        async function loadData() {
            if (!subworkspaceId) return;

            try {
                const snap = await getDoc(doc(db, "subworkspaces", subworkspaceId));
                if (snap.exists()) {
                    const data = snap.data();
                    const existingPrompt = data.active_prompt || "";
                    setPrompt(existingPrompt);
                    setSavedPrompt(existingPrompt);
                    setRetellAgentId(data.retell_agent_id || "");
                }
            } catch (error) {
                console.error("Error loading subworkspace:", error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [subworkspaceId]);

    // Extract variables from prompt
    const extractVariables = (text: string) => {
        const regex = /\{\{([^}]+)\}\}/g;
        const matches = text.match(regex);
        const uniqueVars = matches ? Array.from(new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))) : [];
        return uniqueVars.filter(v => v !== 'campaign_prompt'); // Exclude system variable if present
    };

    const foundVariables = extractVariables(prompt);

    // Update variable values
    const handleVariableChange = (name: string, value: string) => {
        setVariables(prev => ({ ...prev, [name]: value }));
    };

    // Inject variables into prompt for testing
    const getPromptWithVariables = () => {
        let finalPrompt = prompt;
        foundVariables.forEach(v => {
            const value = variables[v] || `[${v}]`; // Fallback to placeholder if empty
            // Replace globally
            finalPrompt = finalPrompt.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), value);
        });
        return finalPrompt;
    };


    const handleSavePrompt = async () => {
        if (!subworkspaceId) return;

        setSaving(true);
        try {
            await updateDoc(doc(db, "subworkspaces", subworkspaceId), {
                active_prompt: prompt,
            });

            setSavedPrompt(prompt);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error("Error saving prompt:", error);
            alert("Error al guardar el prompt");
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = prompt !== savedPrompt;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
            {/* Left Column: Prompt Editor & Variables */}
            <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2">
                {/* Prompt Editor */}
                <div className="rounded-xl border border-gray-200 dark:border-blue-500/30 bg-white dark:bg-blue-500/10 overflow-hidden shrink-0">
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                            <FileText className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">Prompt de Prueba</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Escribe el prompt que el agente usará durante las pruebas
                            </p>
                        </div>
                    </div>

                    <div className="p-5 space-y-4">
                        <Textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Escribe aquí el prompt para tu agente de voz..."
                            className="min-h-[300px] resize-none border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 font-mono text-sm leading-relaxed"
                        />

                        <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {hasChanges ? (
                                    <span className="text-amber-600 dark:text-amber-400">● Cambios sin guardar</span>
                                ) : savedPrompt ? (
                                    <span className="text-green-600 dark:text-green-400">● Prompt activo guardado</span>
                                ) : (
                                    <span>Sin prompt configurado</span>
                                )}
                            </p>

                            <Button
                                onClick={handleSavePrompt}
                                disabled={saving || !hasChanges}
                                className="bg-gray-900 dark:bg-white/10 text-white hover:bg-gray-800 dark:hover:bg-white/20"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : saved ? (
                                    <>
                                        <Check className="mr-2 h-4 w-4" />
                                        Guardado
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Guardar y Activar
                                    </>
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
                                {foundVariables.length > 0 && " Los valores de las variables se inyectarán automáticamente."}
                            </p>
                        </div>

                        {retellAgentId ? (
                            <div className="transform scale-125">
                                <VoiceOrb
                                    agentId={retellAgentId}
                                    prompt={getPromptWithVariables()}
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
