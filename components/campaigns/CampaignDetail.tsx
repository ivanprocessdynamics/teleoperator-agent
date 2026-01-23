"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Campaign, CampaignColumn, AnalysisConfig, CallingConfig } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Save, Check, Loader2, FileText, Phone, Users, Target, Zap, Star, MessageCircle, Mail, Pause, Square, Settings } from "lucide-react";
import { CampaignTable } from "./CampaignTable";
import { CampaignPrompt } from "./CampaignPrompt";
import { CampaignAnalysis } from "./CampaignAnalysis";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCampaignExecutor } from "@/hooks/useCampaignExecutor";
import { Progress } from "@/components/ui/progress";

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

    // Retell Agent ID
    const [retellAgentId, setRetellAgentId] = useState<string | null>(null);

    // Get phone column ID
    const phoneColumnId = campaign?.columns.find(c => c.isPhoneColumn)?.id || 'col_phone';

    // Campaign Executor
    const executor = useCampaignExecutor({
        campaignId: campaignId,
        agentId: retellAgentId || '',
        callingConfig: campaign?.calling_config || { from_number: '+34877450708', concurrency_limit: 1, retry_failed: false },
        phoneColumnId: phoneColumnId,
        campaignPrompt: campaign?.prompt_template || ''
    });

    useEffect(() => {
        if (!campaignId) return;
        const unsub = onSnapshot(doc(db, "campaigns", campaignId), (doc) => {
            if (doc.exists()) {
                const data = { id: doc.id, ...doc.data() } as Campaign;
                setCampaign(prev => {
                    if (prev?.id === data.id) {
                        return data;
                    }
                    return data;
                });
            }
            setLoading(false);
        });
        return () => unsub();
    }, [campaignId]);

    // Fetch Retell Agent ID from subworkspace
    useEffect(() => {
        if (!subworkspaceId) return;
        const fetchAgentId = async () => {
            const subSnap = await getDoc(doc(db, "subworkspaces", subworkspaceId));
            if (subSnap.exists()) {
                setRetellAgentId(subSnap.data().retell_agent_id || null);
            }
        };
        fetchAgentId();
    }, [subworkspaceId]);

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
        if (!campaign) return;
        setIsSaving(true);
        await updateDoc(doc(db, "campaigns", campaign.id), { columns: newCols });
        setIsSaving(false);
        setLastSaved(new Date());
    };

    const handleUpdatePrompt = (newPrompt: string) => {
        if (!campaign) return;
        setCampaign(prev => prev ? ({ ...prev, prompt_template: newPrompt }) : null);
        debouncedSave({ prompt_template: newPrompt });
    };

    const handleUpdateAnalysis = (newConfig: AnalysisConfig) => {
        if (!campaign) return;
        setCampaign(prev => prev ? ({ ...prev, analysis_config: newConfig }) : null);
        debouncedSave({ analysis_config: newConfig });
    };

    const handleNameChange = (newName: string) => {
        if (!campaign) return;
        setCampaign(prev => prev ? ({ ...prev, name: newName }) : null);
        debouncedSave({ name: newName });
    };

    const handleUpdateVisuals = async (newIcon: string, newColor: string) => {
        if (!campaign) return;
        setCampaign(prev => prev ? ({ ...prev, icon: newIcon, color: newColor }) : null);
        setIsSaving(true);
        await updateDoc(doc(db, "campaigns", campaign.id), { icon: newIcon, color: newColor });
        setIsSaving(false);
        setLastSaved(new Date());
    };

    const handleActivateCampaign = async () => {
        if (!campaign || !subworkspaceId) return;

        // Validate phone numbers exist
        const rowsWithPhones = executor.rows.filter(r => r.data[phoneColumnId]?.trim());
        if (rowsWithPhones.length === 0) {
            alert("No hay números de teléfono válidos en la tabla. Añade al menos un número.");
            return;
        }

        setIsActivating(true);
        try {
            const subRef = doc(db, "subworkspaces", subworkspaceId);

            // 1. Update active prompt
            await updateDoc(subRef, {
                active_prompt: campaign.prompt_template || ""
            });

            // 2. Update campaign status
            await updateDoc(doc(db, "campaigns", campaign.id), {
                status: "running"
            });

            // 3. Update Analysis Config (Push to Retell)
            if (campaign.analysis_config && retellAgentId) {
                await fetch('/api/retell/update-agent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agent_id: retellAgentId,
                        analysis_config: campaign.analysis_config
                    })
                });
            }

            // 4. Start the campaign executor
            executor.start();

            setIsActivated(true);
        } catch (error) {
            console.error("Error activating campaign:", error);
            alert("Error al activar la campaña. Revisa la consola.");
        } finally {
            setIsActivating(false);
        }
    };

    const handlePauseCampaign = () => {
        executor.pause();
    };

    const handleResumeCampaign = () => {
        executor.resume();
    };

    const handleStopCampaign = async () => {
        executor.stop();
        if (campaign) {
            await updateDoc(doc(db, "campaigns", campaign.id), { status: "paused" });
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
                <div className="flex items-center gap-3">
                    {/* Progress Display when running */}
                    {executor.state.isRunning && (
                        <div className="flex items-center gap-3 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex flex-col min-w-[120px]">
                                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Progreso</span>
                                <div className="flex items-center gap-2">
                                    <Progress
                                        value={executor.state.totalRows > 0
                                            ? ((executor.state.completedCount + executor.state.failedCount) / executor.state.totalRows) * 100
                                            : 0
                                        }
                                        className="w-24 h-1.5"
                                    />
                                    <span className="text-xs font-mono text-gray-600 dark:text-gray-300">
                                        {executor.state.completedCount + executor.state.failedCount}/{executor.state.totalRows}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                <span className="text-green-600">{executor.state.completedCount} ✓</span>
                                <span className="text-red-500">{executor.state.failedCount} ✗</span>
                                {executor.state.activeCalls > 0 && (
                                    <span className="text-blue-500 flex items-center gap-0.5">
                                        <Loader2 className="h-3 w-3 animate-spin" />{executor.state.activeCalls}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Control Buttons */}
                    {executor.state.isRunning ? (
                        <div className="flex gap-2">
                            {executor.state.isPaused ? (
                                <Button onClick={handleResumeCampaign} variant="outline" size="sm" className="bg-green-50 text-green-600 border-green-200 hover:bg-green-100">
                                    <Play className="mr-1.5 h-3.5 w-3.5" /> Reanudar
                                </Button>
                            ) : (
                                <Button onClick={handlePauseCampaign} variant="outline" size="sm" className="bg-yellow-50 text-yellow-600 border-yellow-200 hover:bg-yellow-100">
                                    <Pause className="mr-1.5 h-3.5 w-3.5" /> Pausar
                                </Button>
                            )}
                            <Button onClick={handleStopCampaign} variant="outline" size="sm" className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100">
                                <Square className="mr-1.5 h-3.5 w-3.5" /> Detener
                            </Button>
                        </div>
                    ) : (
                        <Button
                            onClick={handleActivateCampaign}
                            disabled={isActivating || !subworkspaceId || !retellAgentId}
                            className={cn("shadow-sm transition-colors", styles.button)}
                        >
                            {isActivating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Iniciando...
                                </>
                            ) : isActivated ? (
                                <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Campaña en Marcha
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Lanzar Campaña
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Relaunch Card - Shows when campaign was previously run */}
            {executor.hasBeenRun && !executor.state.isRunning && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                            <Phone className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Campaña Ejecutada Anteriormente</h4>
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                {executor.state.completedCount} completadas, {executor.state.failedCount} fallidas de {executor.state.totalRows} filas
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                                const startLine = prompt("¿Desde qué línea quieres relanzar? (1 = primera línea)");
                                if (startLine) {
                                    const idx = parseInt(startLine) - 1;
                                    if (!isNaN(idx) && idx >= 0) {
                                        await executor.resetRows(idx);
                                        executor.start();
                                    }
                                }
                            }}
                            className="bg-white dark:bg-gray-800 text-amber-700 border-amber-300 hover:bg-amber-50"
                        >
                            Desde línea X...
                        </Button>
                        <Button
                            size="sm"
                            onClick={async () => {
                                if (confirm("¿Estás seguro de relanzar TODA la campaña? Se resetearán todas las filas.")) {
                                    await executor.resetRows(0);
                                    executor.start();
                                }
                            }}
                            className="bg-amber-600 text-white hover:bg-amber-700"
                        >
                            <Play className="mr-1.5 h-3.5 w-3.5" /> Relanzar Todo
                        </Button>
                    </div>
                </div>
            )}

            {/* Main Split View */}
            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                {/* Left: Table Editor (7 cols) - Scrollable */}
                <div className="col-span-12 lg:col-span-7 h-full overflow-y-auto">
                    <CampaignTable
                        campaign={campaign}
                        onColumnsChange={handleUpdateColumns}
                    />
                </div>

                {/* Right: Prompt Editor & Analysis (5 cols) - Sticky */}
                <div className="col-span-12 lg:col-span-5 h-full overflow-y-auto pr-2">
                    <Tabs defaultValue="prompt" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-4 bg-gray-100 dark:bg-gray-800">
                            <TabsTrigger value="prompt">Prompt (Guion)</TabsTrigger>
                            <TabsTrigger value="analysis">Análisis & IA</TabsTrigger>
                            <TabsTrigger value="calling"><Phone className="h-3.5 w-3.5 mr-1.5" />Llamadas</TabsTrigger>
                        </TabsList>

                        <TabsContent value="prompt">
                            <CampaignPrompt
                                prompt={campaign?.prompt_template || ""}
                                columns={campaign?.columns || []}
                                onChange={handleUpdatePrompt}
                                variableClass={styles.variable}
                            />
                        </TabsContent>

                        <TabsContent value="analysis">
                            <CampaignAnalysis
                                config={campaign?.analysis_config || {
                                    enable_transcription: true,
                                    standard_fields: {
                                        satisfaction_score: true,
                                        sentiment: true,
                                        summary: true,
                                        user_sentiment: true,
                                        call_successful: true
                                    },
                                    custom_fields: []
                                }}
                                onChange={handleUpdateAnalysis}
                            />
                        </TabsContent>

                        <TabsContent value="calling">
                            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-6">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                                        <Settings className="h-4 w-4" /> Configuración de Llamadas
                                    </h3>

                                    <div className="space-y-4">
                                        {/* From Number */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                                                Número de Origen (E.164)
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="+34877450708"
                                                    value={campaign.calling_config?.from_number || "+34877450708"}
                                                    onChange={(e) => {
                                                        const newConfig: CallingConfig = {
                                                            from_number: e.target.value,
                                                            concurrency_limit: campaign.calling_config?.concurrency_limit || 1,
                                                            retry_failed: campaign.calling_config?.retry_failed || false
                                                        };
                                                        debouncedSave({ calling_config: newConfig });
                                                    }}
                                                    className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1">Formato E.164: +34XXXXXXXXX</p>
                                        </div>

                                        {/* Concurrency Limit */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                                                Llamadas Simultáneas
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="5"
                                                    value={campaign.calling_config?.concurrency_limit || 1}
                                                    onChange={(e) => {
                                                        const newConfig: CallingConfig = {
                                                            from_number: campaign.calling_config?.from_number || "+34877450708",
                                                            concurrency_limit: parseInt(e.target.value),
                                                            retry_failed: campaign.calling_config?.retry_failed || false
                                                        };
                                                        debouncedSave({ calling_config: newConfig });
                                                    }}
                                                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                                />
                                                <span className="text-lg font-bold text-gray-900 dark:text-white w-8 text-center">
                                                    {campaign.calling_config?.concurrency_limit || 1}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1">Máximo de llamadas en paralelo (recomendado: 1-2)</p>
                                        </div>

                                        {/* Retry Failed */}
                                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <div>
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reintentar fallidas</span>
                                                <p className="text-[10px] text-gray-400">Volver a llamar si no contestan</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={campaign.calling_config?.retry_failed || false}
                                                    onChange={(e) => {
                                                        const newConfig: CallingConfig = {
                                                            from_number: campaign.calling_config?.from_number || "+34877450708",
                                                            concurrency_limit: campaign.calling_config?.concurrency_limit || 1,
                                                            retry_failed: e.target.checked
                                                        };
                                                        debouncedSave({ calling_config: newConfig });
                                                    }}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Info Box */}
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                        <strong>Nota:</strong> Al pulsar "Lanzar Campaña", el sistema comenzará a llamar secuencialmente a cada número de la tabla, respetando el límite de concurrencia configurado.
                                    </p>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
