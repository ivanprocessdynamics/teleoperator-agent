"use client";

import { useState, useEffect } from "react";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CampaignKnowledgeBaseProps {
    subworkspaceId: string | null;
}

export function CampaignKnowledgeBase({ subworkspaceId }: CampaignKnowledgeBaseProps) {
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        if (!subworkspaceId) return;

        const unsub = onSnapshot(doc(db, "subworkspaces", subworkspaceId), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                // Only update content if not currently editing (or initial load) to avoid cursor jumps
                // actually, for simplicity in this version, we might overwrite. 
                // Better pattern: separate local state and db state, but for a simple textarea, 
                // we'll just set it initially and then debounce saves.
                // For now, let's just set it once on load to avoid overwriting user while typing if we used onSnapshot for everything.
                // But wait, onSnapshot triggers on own writes too.
                // Let's rely on local state for editing and only load initially.
            }
        });

        // Initial fetch only to avoid cursor jumping
        // Actually, we can just use onSnapshot but guard against overwriting if we have local changes?
        // Let's do a simple fetch approach for the text content to be safe, or handle snapshot carefully.
        // Simplified: Listen to document, but only setContent if it's the first load.
    }, [subworkspaceId]);

    // Better approach: Just fetch once on mount, then save manually.
    useEffect(() => {
        if (!subworkspaceId) return;
        setLoading(true);
        import("firebase/firestore").then(({ getDoc, doc }) => {
            getDoc(doc(db, "subworkspaces", subworkspaceId)).then((snap) => {
                if (snap.exists()) {
                    setContent(snap.data().knowledge_base || "");
                }
                setLoading(false);
            });
        });
    }, [subworkspaceId]);

    const handleSave = async () => {
        if (!subworkspaceId) return;
        setSaving(true);
        setStatus('idle');
        try {
            await updateDoc(doc(db, "subworkspaces", subworkspaceId), {
                knowledge_base: content
            });
            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (error) {
            console.error("Error saving knowledge base:", error);
            setStatus('error');
        } finally {
            setSaving(false);
        }
    };

    if (!subworkspaceId) {
        return <div className="text-center text-gray-500 py-10">Cargando agente...</div>;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Base de Conocimiento</h3>
                    <p className="text-xs text-gray-500">Información de contexto para el agente (Horarios, Precios, FAQs)</p>
                </div>

                <div className="flex items-center gap-2">
                    {status === 'success' && (
                        <span className="text-xs font-medium text-green-600 flex items-center gap-1 animate-in fade-in">
                            <CheckCircle2 className="w-3 h-3" /> Guardado
                        </span>
                    )}
                    {status === 'error' && (
                        <span className="text-xs font-medium text-red-600 flex items-center gap-1 animate-in fade-in">
                            <AlertCircle className="w-3 h-3" /> Error
                        </span>
                    )}
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        size="sm"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Guardar
                    </Button>
                </div>
            </div>

            <div className="flex-1 p-4 bg-gray-50 dark:bg-gray-950">
                <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Escribe aquí toda la información que el agente debe saber. Ej: 'Nuestros horarios son de 9 a 18h. El precio del servicio básico es 50€. Para emergencias llamar al...'"
                    className="w-full h-full min-h-[400px] resize-none border-0 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 shadow-sm focus-visible:ring-1 focus-visible:ring-indigo-500 p-4 leading-relaxed font-mono text-sm"
                />
            </div>
        </div>
    );
}
