import { useState, useEffect } from "react";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface CampaignKnowledgeBaseProps {
    subworkspaceId: string | null;
}

export function CampaignKnowledgeBase({ subworkspaceId }: CampaignKnowledgeBaseProps) {
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);

    // Initial fetch
    useEffect(() => {
        if (!subworkspaceId) return;
        setLoading(true);
        import("firebase/firestore").then(({ getDoc, doc }) => {
            getDoc(doc(db, "subworkspaces", subworkspaceId)).then((snap) => {
                if (snap.exists()) {
                    setContent(snap.data().knowledge_base || "");
                }
                setLoading(false);
                setHasUnsyncedChanges(false);
            });
        });
    }, [subworkspaceId]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        setHasUnsyncedChanges(true);
    };

    const handleSave = async () => {
        if (!subworkspaceId) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, "subworkspaces", subworkspaceId), {
                knowledge_base: content
            });
            setHasUnsyncedChanges(false);
        } catch (error) {
            console.error("Error saving knowledge base:", error);
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
                    <Button
                        onClick={handleSave}
                        disabled={saving || !hasUnsyncedChanges}
                        className={cn(
                            "h-8 text-xs font-medium transition-all shadow-sm",
                            saving
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                                : !hasUnsyncedChanges
                                    ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                                    : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                        )}
                        size="sm"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                Guardando...
                            </>
                        ) : !hasUnsyncedChanges ? (
                            <>
                                <Check className="mr-1.5 h-3 w-3" />
                                Guardado
                            </>
                        ) : (
                            <>
                                <Save className="mr-1.5 h-3 w-3" />
                                Guardar
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="flex-1 p-4 bg-gray-50 dark:bg-gray-950">
                <Textarea
                    value={content}
                    onChange={handleChange}
                    placeholder="Escribe aquí toda la información que el agente debe saber. Ej: 'Nuestros horarios son de 9 a 18h. El precio del servicio básico es 50€. Para emergencias llamar al...'"
                    className="w-full h-full min-h-[400px] resize-none border-0 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 shadow-sm focus-visible:ring-1 focus-visible:ring-indigo-500 p-4 leading-relaxed font-mono text-sm"
                />
            </div>
        </div>
    );
}
