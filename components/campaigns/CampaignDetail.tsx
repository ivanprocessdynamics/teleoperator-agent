"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Campaign, CampaignColumn } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Save, Check, Loader2, FileText, Phone, Users, Target, Zap, Star, MessageCircle, Mail } from "lucide-react";
import { CampaignTable } from "./CampaignTable";
import { CampaignPrompt } from "./CampaignPrompt";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CampaignDetailProps {
    campaignId: string;
    subworkspaceId?: string;
    onBack: () => void;
}

const ICONS = [
    { name: 'FileText', icon: FileText },
    { name: 'Phone', icon: Phone },
    { name: 'Users', icon: Users },
    { name: 'Target', icon: Target },
    { name: 'Zap', icon: Zap },
    { name: 'Star', icon: Star },
    { name: 'MessageCircle', icon: MessageCircle },
    { name: 'Mail', icon: Mail },
];

const COLORS = [
    { name: 'gray', class: 'bg-gray-100 text-gray-600', pickerClass: 'bg-gray-500' },
    { name: 'blue', class: 'bg-blue-50 text-blue-600', pickerClass: 'bg-blue-500' },
    { name: 'green', class: 'bg-green-50 text-green-600', pickerClass: 'bg-green-500' },
    { name: 'yellow', class: 'bg-yellow-50 text-yellow-600', pickerClass: 'bg-yellow-500' },
    { name: 'red', class: 'bg-red-50 text-red-600', pickerClass: 'bg-red-500' },
    { name: 'purple', class: 'bg-purple-50 text-purple-600', pickerClass: 'bg-purple-500' },
    { name: 'pink', class: 'bg-pink-50 text-pink-600', pickerClass: 'bg-pink-500' },
    { name: 'orange', class: 'bg-orange-50 text-orange-600', pickerClass: 'bg-orange-500' },
];

const THEME_STYLES: Record<string, { badge: string; button: string; variable: string }> = {
    gray: { badge: "bg-gray-100 text-gray-700 border-gray-200", button: "bg-gray-900 text-white hover:bg-black", variable: "bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600" },
    blue: { badge: "bg-blue-50 text-blue-700 border-blue-200", button: "bg-blue-600 text-white hover:bg-blue-700", variable: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/20 border-blue-100 dark:border-blue-500/30" },
    green: { badge: "bg-green-50 text-green-700 border-green-200", button: "bg-green-600 text-white hover:bg-green-700", variable: "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/20 border-green-100 dark:border-green-500/30" },
    yellow: { badge: "bg-yellow-50 text-yellow-700 border-yellow-200", button: "bg-yellow-600 text-white hover:bg-yellow-700", variable: "bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-500/20 border-yellow-100 dark:border-yellow-500/30" },
    red: { badge: "bg-red-50 text-red-700 border-red-200", button: "bg-red-600 text-white hover:bg-red-700", variable: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20 border-red-100 dark:border-red-500/30" },
    purple: { badge: "bg-purple-50 text-purple-700 border-purple-200", button: "bg-purple-600 text-white hover:bg-purple-700", variable: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 border-purple-100 dark:border-purple-500/30" },
    pink: { badge: "bg-pink-50 text-pink-700 border-pink-200", button: "bg-pink-600 text-white hover:bg-pink-700", variable: "bg-pink-50 dark:bg-pink-500/10 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-500/20 border-pink-100 dark:border-pink-500/30" },
    orange: { badge: "bg-orange-50 text-orange-700 border-orange-200", button: "bg-orange-600 text-white hover:bg-orange-700", variable: "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/20 border-orange-100 dark:border-orange-500/30" },
};

export function CampaignDetail({ campaignId, subworkspaceId, onBack }: CampaignDetailProps) {
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [loading, setLoading] = useState(true);

    // Saving State
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Activation State
    const [isActivating, setIsActivating] = useState(false);
    const [isActivated, setIsActivated] = useState(false);

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

    const handleUpdateVisuals = async (newIcon: string, newColor: string) => {
        if (!campaign) return;
        // 1. Optimistic Update
        setCampaign(prev => prev ? ({ ...prev, icon: newIcon, color: newColor }) : null);
        // 2. Immediate Save (discrete action)
        setIsSaving(true);
        await updateDoc(doc(db, "campaigns", campaign.id), { icon: newIcon, color: newColor });
        setIsSaving(false);
        setLastSaved(new Date());
    };

    const handleActivateCampaign = async () => {
        if (!campaign || !subworkspaceId) return;

        setIsActivating(true);
        try {
            // Write the campaign's prompt to the agent's active_prompt
            await updateDoc(doc(db, "subworkspaces", subworkspaceId), {
                active_prompt: campaign.prompt_template || ""
            });

            // Update campaign status to running
            await updateDoc(doc(db, "campaigns", campaign.id), {
                status: "running"
            });

            // NEW: Push Prompt to Retell API
            // Fetch subworkspace to get the retell_agent_id
            const subSnap = await getDoc(doc(db, "subworkspaces", subworkspaceId));
            if (subSnap.exists()) {
                const subData = subSnap.data();
                const retellAgentId = subData?.retell_agent_id;

                if (retellAgentId) {
                    try {
                        const response = await fetch('/api/retell/update-agent', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                agent_id: retellAgentId,
                                prompt: campaign.prompt_template || ""
                            })
                        });

                        if (!response.ok) {
                            const errData = await response.json();
                            console.warn("Failed to push to Retell:", errData);
                            // We don't block UI but we warn
                        } else {
                            console.log("Retell Agent updated successfully");
                        }
                    } catch (apiErr) {
                        console.error("API Call error:", apiErr);
                    }
                }
            }

            setIsActivated(true);
            setTimeout(() => setIsActivated(false), 3000);
        } catch (error) {
            console.error("Error activating campaign:", error);
            alert("Error al activar la campaña. Revisa la consola.");
        } finally {
            setIsActivating(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-500 dark:text-gray-400">Cargando editor...</div>;
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

                    {/* Icon/Color Selector */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div
                                className={cn(
                                    "flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg transition-transform hover:scale-105 active:scale-95 shrink-0",
                                    COLORS.find(c => c.name === (campaign.color || 'gray'))?.class || COLORS[0].class
                                )}
                            >
                                {(() => {
                                    const IconComponent = ICONS.find(i => i.name === (campaign.icon || 'FileText'))?.icon || FileText;
                                    return <IconComponent className="h-5 w-5" />;
                                })()}
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 p-3 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" align="start">
                            <div className="space-y-4">
                                <div>
                                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2 block">Icono</span>
                                    <div className="grid grid-cols-4 gap-2">
                                        {ICONS.map((item) => (
                                            <div
                                                key={item.name}
                                                onClick={() => handleUpdateVisuals(item.name, campaign.color || 'gray')}
                                                className={cn(
                                                    "flex items-center justify-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors",
                                                    campaign.icon === item.name && "bg-gray-100 dark:bg-gray-700 ring-1 ring-gray-900 dark:ring-white"
                                                )}
                                            >
                                                <item.icon className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2 block">Color</span>
                                    <div className="grid grid-cols-4 gap-2">
                                        {COLORS.map((item) => (
                                            <div
                                                key={item.name}
                                                onClick={() => handleUpdateVisuals(campaign.icon || 'FileText', item.name)}
                                                className={cn(
                                                    "h-8 w-full rounded-md cursor-pointer border border-transparent hover:scale-105 transition-all flex items-center justify-center",
                                                    item.pickerClass,
                                                    campaign.color === item.name && "ring-2 ring-offset-2 ring-gray-900 dark:ring-white border-transparent scale-110"
                                                )}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Input
                        value={campaign.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        className="text-xl font-bold text-gray-900 dark:text-white border-none px-2 h-auto focus-visible:ring-0 bg-transparent w-[300px]"
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
                        <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 ml-2 transition-opacity duration-500">
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
                    <Button
                        onClick={handleActivateCampaign}
                        disabled={isActivating || !subworkspaceId}
                        className={cn("shadow-sm transition-colors", styles.button)}
                    >
                        {isActivating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Activando...
                            </>
                        ) : isActivated ? (
                            <>
                                <Check className="mr-2 h-4 w-4" />
                                Campaña Activa
                            </>
                        ) : (
                            <>
                                <Play className="mr-2 h-4 w-4" />
                                Lanzar Campaña
                            </>
                        )}
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
