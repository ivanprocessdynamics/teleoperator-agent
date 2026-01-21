"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Campaign, CampaignColumn } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Save, Check, Loader2 } from "lucide-react";
import { CampaignTable } from "./CampaignTable";
import { CampaignPrompt } from "./CampaignPrompt";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CampaignDetailProps {
    campaignId: string;
    onBack: () => void;
}

const THEME_STYLES: Record<string, { badge: string; button: string; variable: string }> = {
    gray: { badge: "bg-gray-100 text-gray-700 border-gray-200", button: "bg-gray-900 text-white hover:bg-black", variable: "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200" },
    blue: { badge: "bg-blue-50 text-blue-700 border-blue-200", button: "bg-blue-600 text-white hover:bg-blue-700", variable: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100" },
    green: { badge: "bg-green-50 text-green-700 border-green-200", button: "bg-green-600 text-white hover:bg-green-700", variable: "bg-green-50 text-green-700 hover:bg-green-100 border-green-100" },
    yellow: { badge: "bg-yellow-50 text-yellow-700 border-yellow-200", button: "bg-yellow-600 text-white hover:bg-yellow-700", variable: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-100" },
    red: { badge: "bg-red-50 text-red-700 border-red-200", button: "bg-red-600 text-white hover:bg-red-700", variable: "bg-red-50 text-red-700 hover:bg-red-100 border-red-100" },
    purple: { badge: "bg-purple-50 text-purple-700 border-purple-200", button: "bg-purple-600 text-white hover:bg-purple-700", variable: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-100" },
    pink: { badge: "bg-pink-50 text-pink-700 border-pink-200", button: "bg-pink-600 text-white hover:bg-pink-700", variable: "bg-pink-50 text-pink-700 hover:bg-pink-100 border-pink-100" },
    orange: { badge: "bg-orange-50 text-orange-700 border-orange-200", button: "bg-orange-600 text-white hover:bg-orange-700", variable: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-100" },
};

export function CampaignDetail({ campaignId, onBack }: CampaignDetailProps) {
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [loading, setLoading] = useState(true);

    // Saving State
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Debounce Refs
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!campaignId) return;
        const unsub = onSnapshot(doc(db, "campaigns", campaignId), (doc) => {
            if (doc.exists()) {
                const data = { id: doc.id, ...doc.data() } as Campaign;
                // Only update full object if not saving to prevent overwriting local edits
                // We trust local strict equality if we are the editor
                setCampaign(prev => {
                    if (prev?.id === data.id) {
                        // Merge carefully? 
                        // For now, we take remote updates but we might want to ignore 
                        // specific fields if we are typing. 
                        // But since we use local state inside Table/Prompt components typically, 
                        // top level merge is usually okay unless we hold state here.
                        // We DO hold 'name' and 'prompt' here.
                        return data;
                    }
                    return data;
                });
            }
            setLoading(false);
        });
        return () => unsub();
    }, [campaignId]);

    // Helpers for Debounced Save
    const debouncedSave = useCallback((updates: Partial<Campaign>) => {
        setIsSaving(true);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(async () => {
            if (!campaignId) return;
            await updateDoc(doc(db, "campaigns", campaignId), updates);
            setIsSaving(false);
            setLastSaved(new Date());
        }, 1500); // 1.5s delay
    }, [campaignId]);


    // Handlers
    const handleUpdateColumns = async (newCols: CampaignColumn[]) => {
        // Columns usually don't need debounce as they are discrete actions
        if (!campaign) return;
        setIsSaving(true);
        await updateDoc(doc(db, "campaigns", campaign.id), { columns: newCols });
        setIsSaving(false);
        setLastSaved(new Date());
    };

    const handleUpdatePrompt = (newPrompt: string) => {
        if (!campaign) return;
        // 1. Optimistic Update
        setCampaign(prev => prev ? ({ ...prev, prompt_template: newPrompt }) : null);
        // 2. Debounced Save
        debouncedSave({ prompt_template: newPrompt });
    };

    const handleNameChange = (newName: string) => {
        if (!campaign) return;
        // 1. Optimistic Update
        setCampaign(prev => prev ? ({ ...prev, name: newName }) : null);
        // 2. Debounced Save
        debouncedSave({ name: newName });
    };

    if (loading) return <div className="p-10 text-center text-gray-500">Cargando editor...</div>;
    if (!campaign) return <div className="p-10 text-center text-red-500">Campaña no encontrada</div>;

    const theme = campaign.color || "gray";
    const styles = THEME_STYLES[theme] || THEME_STYLES.gray;

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] gap-4">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Input
                        value={campaign.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        className="text-xl font-bold text-gray-900 border-none px-0 h-auto focus-visible:ring-0 bg-transparent w-[300px]"
                        placeholder="Nombre de la Campaña"
                    />
                    <div className="flex items-center gap-2">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors",
                            // Keep semantic colors for active states, thematic for draft/idle
                            campaign.status === 'running' ? "bg-blue-50 text-blue-700 border-blue-200" : styles.badge
                        )}>
                            {campaign.status}
                        </span>

                        {/* Auto-Save Indicator */}
                        <div className="flex items-center text-xs text-gray-400 ml-2 transition-opacity duration-500">
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Guardando...
                                </>
                            ) : lastSaved ? (
                                <>
                                    <Check className="h-3 w-3 mr-1" /> Guardado
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button className={cn("shadow-sm transition-colors", styles.button)}>
                        <Play className="mr-2 h-4 w-4" /> Lanzar Campaña
                    </Button>
                </div>
            </div>

            {/* Main Split View */}
            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                {/* Left: Table Editor (7 cols) - Scrollable */}
                <div className="col-span-12 lg:col-span-7 h-full overflow-y-auto">
                    <CampaignTable
                        campaign={campaign}
                        onColumnsChange={handleUpdateColumns}
                    />
                </div>

                {/* Right: Prompt Editor (5 cols) - Sticky */}
                <div className="col-span-12 lg:col-span-5 h-full overflow-y-auto">
                    <div className="sticky top-0">
                        <CampaignPrompt
                            prompt={campaign.prompt_template || ""}
                            columns={campaign.columns || []}
                            onChange={handleUpdatePrompt}
                            variableClass={styles.variable}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
