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

    const handleSavePrompt = async () => {
        if (!subworkspaceId) return;

        setSaving(true);
        try {
            await updateDoc(doc(db, "subworkspaces", subworkspaceId), {
                active_prompt: prompt,
            });

            // Note: We removed the Push Logic because we now use Dynamic Variables in VoiceOrb

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
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Prompt Editor Section */}
            <div className="rounded-xl border border-gray-200 dark:border-blue-500/30 bg-white dark:bg-blue-500/10 overflow-hidden">
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
                        className="min-h-[200px] resize-none border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400"
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

            {/* Voice Orb Section */}
            <div className="rounded-xl border border-gray-200 dark:border-blue-500/30 bg-white dark:bg-blue-500/10 p-8">
                <div className="flex flex-col items-center text-center">
                    <div className="flex items-center gap-2 mb-2">
                        <Mic className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        <h3 className="font-semibold text-gray-900 dark:text-white">Probar Agente</h3>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-md">
                        Habla con tu agente para probar el prompt configurado. Asegúrate de guardar los cambios antes de probar.
                    </p>

                    {retellAgentId ? (
                        <VoiceOrb agentId={retellAgentId} prompt={prompt} />
                    ) : (
                        <div className="py-8 text-center">
                            <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                                <Mic className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No hay agente de voz configurado para este workspace.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Agent Info */}
            {retellAgentId && (
                <div className="text-center">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        Agent ID: <code className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{retellAgentId}</code>
                    </p>
                </div>
            )}
        </div>
    );
}
