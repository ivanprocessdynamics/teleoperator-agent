"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, updateDoc, getDoc, arrayUnion, arrayRemove, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Campaign, CampaignColumn, AnalysisConfig, AnalysisField, CallingConfig } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Save, Check, Loader2, FileText, Phone, Users, Target, Zap, Star, MessageCircle, Mail, Pause, Square, Settings, Activity, Globe, Database, BookOpen } from "lucide-react";
import { CampaignTable } from "./CampaignTable";
import { CampaignPrompt } from "./CampaignPrompt";
import { CampaignAnalysis } from "./CampaignAnalysis";
import { AgentToolsConfig } from "@/components/tools/AgentToolsConfig";
import { AgentTool } from "@/types/tools";
import { DataResetButton } from "@/components/common/DataResetButton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { CallHistoryTable } from "@/components/calls/CallHistoryTable";
import { StatsDashboard } from "@/components/stats/StatsDashboard";
import { History as HistoryIcon, BarChart3 } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useCampaignExecutor } from "@/hooks/useCampaignExecutor";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
    const params = useParams();
    const urlSubworkspaceId = params?.subId as string;
    const { userData } = useAuth();

    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [retellAgentId, setRetellAgentId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [globalFields, setGlobalFields] = useState<AnalysisField[] | null>(null);

    const [importableAgents, setImportableAgents] = useState<{ id: string; name: string; fields: AnalysisField[] }[]>([]);

    const [showRelaunchDialog, setShowRelaunchDialog] = useState(false);
    const [relaunchStartLine, setRelaunchStartLine] = useState("1");
    const [showRelaunchLineDialog, setShowRelaunchLineDialog] = useState(false);

    const [phoneNumbers, setPhoneNumbers] = useState<{ phone_number: string; nickname?: string }[]>([]);

    useEffect(() => {
        async function fetchNumbers() {
            try {
                const res = await fetch("/api/retell/get-phone-numbers");
                if (res.ok) {
                    const data = await res.json();
                    setPhoneNumbers(data);
                }
            } catch (error) {
                console.error("Error fetching available numbers:", error);
            }
        }
        fetchNumbers();
    }, []);

    // Fetch Campaign
    useEffect(() => {
        if (!campaignId) return;
        const unsub = onSnapshot(doc(db, "campaigns", campaignId), (doc) => {
            if (doc.exists()) {
                setCampaign({ id: doc.id, ...doc.data() } as Campaign);
            }
            setIsLoading(false);
        });
        return () => unsub();
    }, [campaignId]);

    const activeSubworkspaceId = subworkspaceId || campaign?.subworkspace_id || urlSubworkspaceId;

    // Fetch Subworkspace (for Retell Agent ID AND Global Fields)
    useEffect(() => {
        async function fetchSubworkspace() {
            if (!activeSubworkspaceId) return;
            try {
                const docRef = doc(db, "subworkspaces", activeSubworkspaceId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setRetellAgentId(data.retell_agent_id);
                    // USE Global Definitions as the TRUE Global Source (Active + Archived)
                    setGlobalFields(data.global_analysis_definitions || []);
                }
            } catch (err) {
                console.error("Error fetching subworkspace:", err);
            }
        }
        fetchSubworkspace();
    }, [activeSubworkspaceId]);

    // Fetch ALL Subworkspaces for Import
    useEffect(() => {
        async function fetchAllAgents() {
            try {
                // Assuming all subworkspaces are in the same parent workspace collection path structure or accessible
                // For this demo, we fetch the top-level 'subworkspaces' collection if that's how it's structured,
                // or we need to know the workspaceId.
                // Based on `app/(dashboard)/workspaces/[workspaceId]/sub/[subId]/page.tsx`, subworkspaces seem to be a root collection or subcollection?
                // The retrieval above uses `doc(db, "subworkspaces", activeSubworkspaceId)`, so "subworkspaces" is a root collection.

                const snap = await getDocs(collection(db, "subworkspaces"));
                const agents = snap.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name || "Sin nombre",
                    fields: doc.data().global_analysis_definitions || []
                })).filter(a => a.fields.length > 0 && a.id !== activeSubworkspaceId); // Exclude current agent and empty ones

                setImportableAgents(agents);
            } catch (error) {
                console.error("Error fetching importable agents:", error);
            }
        }
        fetchAllAgents();
    }, [activeSubworkspaceId]);

    const handleAddGlobalField = async (field: AnalysisField) => {
        if (!activeSubworkspaceId) return;
        // Optimistic update of Global Fields (Source of Truth)
        setGlobalFields(prev => [...(prev || []), field]);

        try {
            const docRef = doc(db, "subworkspaces", activeSubworkspaceId);
            // Add to the Global Registry (Available everywhere, initially Archived)
            await updateDoc(docRef, {
                global_analysis_definitions: arrayUnion(field)
            });
        } catch (error) {
            console.error("Error adding global field:", error);
        }
    };

    const handleDeleteGlobalField = async (fieldId: string) => {
        if (!activeSubworkspaceId || !globalFields) return;

        console.log(`[Global Delete] Attempting to delete field ${fieldId} from subworkspace ${activeSubworkspaceId}`);

        // Optimistic Update
        setGlobalFields(prev => (prev ? prev.filter(f => f.id !== fieldId) : null));

        try {
            const docRef = doc(db, "subworkspaces", activeSubworkspaceId);
            const snap = await getDoc(docRef);

            if (snap.exists()) {
                const data = snap.data();
                const currentDefinitions = data.global_analysis_definitions || [];
                const newDefinitions = currentDefinitions.filter((f: AnalysisField) => f.id !== fieldId);

                if (currentDefinitions.length !== newDefinitions.length) {
                    await updateDoc(docRef, {
                        global_analysis_definitions: newDefinitions
                    });
                    console.log(`[Global Delete] Successfully removed field ${fieldId} from Firestore.`);
                } else {
                    console.warn(`[Global Delete] Field ${fieldId} not found in Firestore definitions.`);
                }
            }
        } catch (error) {
            console.error("Error deleting global field:", error);
        }
    };

    const debouncedSave = useCallback(async (updates: Partial<Campaign>) => {
        if (!campaignId) return;
        await updateDoc(doc(db, "campaigns", campaignId), updates);
    }, [campaignId]);

    const handleUpdateColumns = (columns: CampaignColumn[]) => debouncedSave({ columns });

    // Save to Firestore (Auto-save)
    const handlePromptChange = useCallback((prompt_template: string) => {
        debouncedSave({ prompt_template });
    }, [debouncedSave]);

    // Sync to Retell (Manual trigger)
    const handleSyncPrompt = useCallback(async (prompt_template: string) => {
        if (!retellAgentId) {
            console.warn('⚠️ No Retell Agent ID found - skipping sync');
            return;
        }

        console.log('📡 Calling /api/retell/update-agent...');
        try {
            const response = await fetch('/api/retell/update-agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_id: retellAgentId,
                    prompt: prompt_template,
                    analysis_config: campaign?.analysis_config // Sync analysis config too
                })
            });
            const result = await response.json();
            console.log('✅ Prompt synced to Retell agent:', result);
            return result;
        } catch (error) {
            console.error('❌ Failed to sync prompt to Retell:', error);
            throw error;
        }
    }, [retellAgentId]);

    const handleUpdateAnalysis = (analysis_config: AnalysisConfig) => debouncedSave({ analysis_config });

    const handleUpdateTools = (tools: AgentTool[]) => debouncedSave({ tools });

    // Active Sync: Global (Subworkspace) -> Campaign
    // FIX: Do NOT auto-add new global fields to local active list.
    // They should be available as "Archived" (Inactive) options.
    // Only Sync updates to ALREADY ACTIVE fields, and remove DELETED fields.
    useEffect(() => {
        if (!campaign || globalFields === null) return;

        const currentLocal = campaign.analysis_config?.custom_fields || [];
        let hasChanges = false;

        // 1. Map Global Fields for quick lookup
        const globalMap = new Map(globalFields.map(f => [f.name, f]));

        // 2. Filter Local Fields: Keep only those that still exist in Global
        // AND update their definitions (Description/Type) if changed Globaly.
        const newLocalFields = currentLocal.reduce((acc: AnalysisField[], localField) => {
            const globalMatch = globalMap.get(localField.name);

            if (globalMatch) {
                // Field exists globally. Check if definition needs update.
                if (localField.description !== globalMatch.description || localField.type !== globalMatch.type) {
                    hasChanges = true;
                    // Preserve local ID? No, use Global ID for consistency usually, but persistence implies local state.
                    // Important: The UI uses ID to distinguish. Let's sync to Global ID if possible or keep local?
                    // "Reflected in all sites" -> standardize on Global ID.
                    acc.push({ ...globalMatch, isArchived: localField.isArchived });
                } else {
                    // No change
                    acc.push(localField);
                }
            } else {
                // Field deleted globally -> Remove from local
                hasChanges = true;
            }
            return acc;
        }, []);

        // 3. Detect if meaningful changes happened (Deletions or Updates)
        if (currentLocal.length !== newLocalFields.length) hasChanges = true;

        if (hasChanges) {
            console.log("🔄 Syncing Campaign with Global Metrics (Updates/Deletions only)...");
            const newConfig = {
                ...(campaign.analysis_config || {
                    enable_transcription: true,
                    standard_fields: {
                        satisfaction_score: true, sentiment: true, summary: true, user_sentiment: true, call_successful: true
                    },
                    custom_fields: []
                }),
                custom_fields: newLocalFields
            };
            handleUpdateAnalysis(newConfig);
        }
    }, [globalFields, campaign?.analysis_config?.custom_fields]);

    const phoneColumnId = campaign?.phone_column_id || campaign?.columns?.find(c => c.isPhoneColumn)?.id || "col_phone";

    // Track latest prompt for safe launch
    const latestPromptRef = useRef(campaign?.prompt_template || "");
    useEffect(() => {
        if (campaign?.prompt_template) latestPromptRef.current = campaign.prompt_template;
    }, [campaign?.prompt_template]);

    // Campaign Executor
    const executor = useCampaignExecutor({
        campaignId: campaignId,
        agentId: retellAgentId || '',
        callingConfig: campaign?.calling_config || { from_number: '+34877450708', concurrency_limit: 1, retry_failed: false },
        phoneColumnId: phoneColumnId,
        campaignPrompt: campaign?.prompt_template || '',
        columns: campaign?.columns || [], // Pass columns for dynamic variables
        subworkspaceId: activeSubworkspaceId || ''
    });

    const handleLaunch = async () => {
        // 1. Force save pending prompt if different
        const currentPrompt = latestPromptRef.current;
        if (currentPrompt && currentPrompt !== campaign?.prompt_template) {
            console.log("Saving prompt before launch...");
            await updateDoc(doc(db, "campaigns", campaignId), {
                prompt_template: currentPrompt
            });
        }

        // 2. Start with EXPLICIT overriding prompt to avoid stale closure in hook
        executor.start(currentPrompt);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                Campaña no encontrada
            </div>
        );
    }

    const styles = THEME_STYLES[campaign.color || 'blue'] || THEME_STYLES.blue;

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950 p-6">
            {/* Back Button */}
            <div className="mb-4">
                <Button
                    variant="ghost"
                    onClick={onBack}
                    className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white pl-0 hover:bg-transparent"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver a la lista
                </Button>
            </div>

            {/* Active Campaign Dashboard */}
            {
                // Only show "Start" card if not running AND not paused AND status is draft (or no executor activity)
                !executor.state.isRunning &&
                !executor.state.isPaused &&
                executor.state.activeCalls === 0 &&
                campaign.status !== 'completed' && (
                    <div className="mb-6 bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800 rounded-xl p-6 shadow-md animate-in fade-in slide-in-from-top-2 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

                        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-5">
                                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 flex items-center justify-center shadow-inner">
                                    <Play className="h-6 w-6 text-green-700 dark:text-green-300 ml-1" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        Campaña Lista
                                        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                                            No enviada
                                        </span>
                                    </h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                        {executor.state.totalRows} contactos listos para llamar
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <Globe className="h-4 w-4 text-gray-500" />
                                    <Select
                                        value={campaign.calling_config?.target_country_code || "+34"}
                                        onValueChange={(value) => {
                                            const newConfig: CallingConfig = {
                                                ...campaign.calling_config!,
                                                target_country_code: value
                                            };
                                            debouncedSave({ calling_config: newConfig });
                                        }}
                                    >
                                        <SelectTrigger className="h-7 w-[140px] border-0 bg-transparent text-xs focus:ring-0 px-0">
                                            <SelectValue placeholder="País" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectLabel>Europa</SelectLabel>
                                                <SelectItem value="+34">🇪🇸 España (+34)</SelectItem>
                                                <SelectItem value="+44">🇬🇧 Reino Unido (+44)</SelectItem>
                                                <SelectItem value="+33">🇫🇷 Francia (+33)</SelectItem>
                                            </SelectGroup>
                                            <SelectGroup>
                                                <SelectLabel>América</SelectLabel>
                                                <SelectItem value="+1">🇺🇸 EEUU (+1)</SelectItem>
                                                <SelectItem value="+52">🇲🇽 México (+52)</SelectItem>
                                                <SelectItem value="+57">🇨🇴 Colombia (+57)</SelectItem>
                                                <SelectItem value="+54">🇦🇷 Argentina (+54)</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    onClick={handleLaunch}
                                    disabled={executor.state.totalRows === 0}
                                    className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20 px-8 py-6 text-lg font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                                >
                                    <Play className="mr-2 h-5 w-5 fill-current" />
                                    Iniciar Campaña
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                // Show "Sending" card if Running OR Paused OR Active Calls exist
                (executor.state.isRunning || executor.state.isPaused || executor.state.activeCalls > 0) && (
                    <div className="mb-6 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-xl p-6 shadow-md animate-in fade-in slide-in-from-top-2 relative overflow-hidden">
                        {/* Background Pulse Animation */}
                        {executor.state.isRunning && !executor.state.isPaused && (
                            <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50 animate-pulse" />
                        )}

                        <div className="flex flex-col gap-6">
                            {/* Header & Status */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner transition-colors",
                                        executor.state.isPaused ? "bg-amber-100 dark:bg-amber-900/30" : "bg-blue-100 dark:bg-blue-900/30"
                                    )}>
                                        {executor.state.isPaused ? (
                                            <Pause className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                        ) : (
                                            <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-pulse" />
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                            {executor.state.isPaused
                                                ? "Campaña Pausada"
                                                : (!executor.state.isRunning && executor.state.activeCalls > 0)
                                                    ? "Deteniendo..."
                                                    : "Enviando..."}
                                            <span className={cn(
                                                "text-xs font-medium px-2.5 py-0.5 rounded-full border",
                                                executor.state.isPaused
                                                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
                                                    : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                                            )}>
                                                {executor.state.isPaused
                                                    ? "En espera"
                                                    : (!executor.state.isRunning && executor.state.activeCalls > 0)
                                                        ? "Finalizando..."
                                                        : "Llamando..."}
                                            </span>
                                        </h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                            {executor.state.activeCalls} llamadas activas ahora mismo
                                        </p>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-3">
                                    {executor.state.isPaused ? (
                                        <Button
                                            onClick={executor.resume}
                                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                                        >
                                            <Play className="mr-2 h-4 w-4 fill-current" /> Reanudar
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            onClick={executor.pause}
                                            className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20"
                                        >
                                            <Pause className="mr-2 h-4 w-4" /> Pausar
                                        </Button>
                                    )}

                                    <Button
                                        variant="destructive"
                                        onClick={executor.stop}
                                        className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 shadow-none dark:bg-red-900/10 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-900/30"
                                    >
                                        <Square className="mr-2 h-4 w-4 fill-current" />
                                        {(!executor.state.isRunning && executor.state.activeCalls > 0) ? "Forzar Detención" : "Detener"}
                                    </Button>
                                </div>
                            </div>

                            {/* Progress Stats */}
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border border-gray-100 dark:border-gray-800">
                                {/* Progress Bar */}
                                <div className="md:col-span-3 space-y-2">
                                    <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-400">
                                        <span>Progreso Total</span>
                                        <span>{Math.round((executor.state.completedCount / Math.max(executor.state.totalRows, 1)) * 100)}%</span>
                                    </div>
                                    <Progress value={(executor.state.completedCount / Math.max(executor.state.totalRows, 1)) * 100} className="h-2" />
                                </div>

                                <div className="flex flex-col items-center justify-center p-2">
                                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{executor.state.completedCount}</span>
                                    <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Completadas
                                    </span>
                                </div>

                                <div className="flex flex-col items-center justify-center p-2 border-l border-r border-gray-200 dark:border-gray-700">
                                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{executor.state.pendingCount}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Pendientes
                                    </span>
                                </div>

                                <div className="flex flex-col items-center justify-center p-2">
                                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{executor.state.failedCount}</span>
                                    <span className="text-xs text-red-500 dark:text-red-400 font-medium flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Fallidas
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Relaunch Card - Premium Redesign */}
            {
                executor.hasBeenRun && !executor.state.isRunning && (
                    <div className="mb-6 group relative overflow-hidden bg-white dark:bg-gray-900 border border-amber-200/50 dark:border-amber-800/50 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                        {/* Background Gradient Decoration */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

                        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-5">
                                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900 dark:to-amber-800 flex items-center justify-center shadow-inner">
                                    <Phone className="h-6 w-6 text-amber-700 dark:text-amber-300" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        Enviada
                                        <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700">
                                            Historial
                                        </span>
                                    </h4>
                                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                                        <span className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-green-500" />
                                            {executor.state.completedCount} completadas
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-red-500" />
                                            {executor.state.failedCount} fallidas
                                        </span>
                                        <span className="text-gray-400">|</span>
                                        <span>{executor.state.totalRows} total</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full sm:w-auto">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-2 sm:mb-0">
                                <Globe className="h-4 w-4 text-gray-500" />
                                <Select
                                    value={campaign.calling_config?.target_country_code || "+34"}
                                    onValueChange={(value) => {
                                        const newConfig: CallingConfig = {
                                            ...campaign.calling_config!,
                                            target_country_code: value
                                        };
                                        debouncedSave({ calling_config: newConfig });
                                    }}
                                >
                                    <SelectTrigger className="h-7 w-[90px] border-0 bg-transparent text-xs focus:ring-0 px-0">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel>Europa</SelectLabel>
                                            <SelectItem value="+34">🇪🇸 ES (+34)</SelectItem>
                                            <SelectItem value="+44">🇬🇧 UK (+44)</SelectItem>
                                            <SelectItem value="+33">🇫🇷 FR (+33)</SelectItem>
                                            <SelectItem value="+39">🇮🇹 IT (+39)</SelectItem>
                                            <SelectItem value="+49">🇩🇪 DE (+49)</SelectItem>
                                            <SelectItem value="+351">🇵🇹 PT (+351)</SelectItem>
                                        </SelectGroup>
                                        <SelectGroup>
                                            <SelectLabel>América</SelectLabel>
                                            <SelectItem value="+1">🇺🇸 US (+1)</SelectItem>
                                            <SelectItem value="+52">🇲🇽 MX (+52)</SelectItem>
                                            <SelectItem value="+57">🇨🇴 CO (+57)</SelectItem>
                                            <SelectItem value="+54">🇦🇷 AR (+54)</SelectItem>
                                            <SelectItem value="+56">🇨🇱 CL (+56)</SelectItem>
                                            <SelectItem value="+591">🇧🇴 BO (+591)</SelectItem>
                                            <SelectItem value="+593">🇪🇨 EC (+593)</SelectItem>
                                            <SelectItem value="+595">🇵🇾 PY (+595)</SelectItem>
                                            <SelectItem value="+598">🇺🇾 UY (+598)</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setShowRelaunchLineDialog(true)}
                                className="flex-1 sm:flex-none border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                            >
                                <span className="mr-2 text-amber-600">↳</span> Desde fila...
                            </Button>
                            <Button
                                onClick={() => setShowRelaunchDialog(true)}
                                className="flex-1 sm:flex-none bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg shadow-amber-500/20 border-0 transition-all hover:scale-105 active:scale-95"
                            >
                                <Play className="mr-2 h-4 w-4 fill-current" /> Relanzar Todo
                            </Button>
                        </div>
                    </div>
                )
            }

            {/* Relaunch Confirmation Dialog */}
            <Dialog open={showRelaunchDialog} onOpenChange={setShowRelaunchDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Relanzar Campaña Completa?</DialogTitle>
                        <DialogDescription>
                            Esta acción <strong>reiniciará todas las filas</strong> (incluyendo las completadas) y comenzará a llamar nuevamente desde el principio.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRelaunchDialog(false)}>Cancelar</Button>
                        <Button
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={async () => {
                                setShowRelaunchDialog(false);
                                await executor.resetRows(0);
                                await executor.resetRows(0);
                                executor.start(latestPromptRef.current);
                            }}
                        >
                            Confirmar y Relanzar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Relaunch From Line Dialog */}
            <Dialog open={showRelaunchLineDialog} onOpenChange={setShowRelaunchLineDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Relanzar desde una fila específica</DialogTitle>
                        <DialogDescription>
                            Las filas anteriores a la seleccionada se ignorarán. Las filas a partir de la seleccionada (inclusive) se reiniciarán.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium mb-2 block">Número de fila (1-{executor.state.totalRows}):</label>
                        <Input
                            type="number"
                            min="1"
                            max={executor.state.totalRows}
                            value={relaunchStartLine}
                            onChange={(e) => setRelaunchStartLine(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRelaunchLineDialog(false)}>Cancelar</Button>
                        <Button
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={async () => {
                                setShowRelaunchLineDialog(false);
                                const idx = parseInt(relaunchStartLine) - 1;
                                if (!isNaN(idx) && idx >= 0) {
                                    await executor.resetRows(idx);
                                    await executor.resetRows(idx);
                                    executor.start(latestPromptRef.current);
                                }
                            }}
                        >
                            Relanzar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                        <TabsList className="grid w-full grid-cols-7 mb-4 bg-gray-100 dark:bg-gray-800">
                            <TabsTrigger value="prompt">Prompt</TabsTrigger>
                            <TabsTrigger value="tools"><Database className="h-3.5 w-3.5" /></TabsTrigger>
                            <TabsTrigger value="knowledge"><BookOpen className="h-3.5 w-3.5" /></TabsTrigger>
                            <TabsTrigger value="analysis">Análisis</TabsTrigger>
                            <TabsTrigger value="calling"><Phone className="h-3.5 w-3.5" /></TabsTrigger>
                            <TabsTrigger value="history"><HistoryIcon className="h-3.5 w-3.5" /></TabsTrigger>
                            <TabsTrigger value="stats"><BarChart3 className="h-3.5 w-3.5" /></TabsTrigger>
                        </TabsList>

                        <TabsContent value="tools">
                            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-10 flex flex-col items-center justify-center text-center min-h-[300px]">
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-full mb-4">
                                    <Database className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Herramientas y APIs</h3>
                                <p className="text-gray-500 max-w-sm">
                                    Todavía no funciona, estoy en ello.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="knowledge">
                            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-10 flex flex-col items-center justify-center text-center min-h-[300px]">
                                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-full mb-4">
                                    <BookOpen className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Base de Conocimiento</h3>
                                <p className="text-gray-500 max-w-sm">
                                    Todavía no funciona, estoy en ello.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="prompt">
                            <CampaignPrompt
                                prompt={campaign?.prompt_template || ""}
                                columns={campaign?.columns || []}
                                onChange={handlePromptChange}
                                onImmediateChange={(val) => latestPromptRef.current = val}
                                onSyncAgent={handleSyncPrompt}
                                variableClass={styles.variable}
                                campaignId={campaignId}
                                subworkspaceId={activeSubworkspaceId || ""}
                                isAgentLevel={false}
                            />
                        </TabsContent>

                        <TabsContent value="analysis">
                            <CampaignAnalysis
                                config={campaign?.analysis_config || {
                                    enable_transcription: true,
                                    standard_fields: {
                                        satisfaction_score: true, sentiment: true, summary: true, user_sentiment: true, call_successful: true
                                    },
                                    custom_fields: []
                                }}
                                onChange={handleUpdateAnalysis}
                                globalFields={globalFields}
                                onAddGlobalField={handleAddGlobalField}
                                onDeleteGlobalField={handleDeleteGlobalField}
                                importableAgents={importableAgents}
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
                                                <Select
                                                    value={campaign.calling_config?.from_number || ""}
                                                    onValueChange={(value) => {
                                                        const newConfig: CallingConfig = {
                                                            ...campaign.calling_config!,
                                                            from_number: value,
                                                            concurrency_limit: campaign.calling_config?.concurrency_limit || 1,
                                                            retry_failed: campaign.calling_config?.retry_failed || false
                                                        };
                                                        debouncedSave({ calling_config: newConfig });
                                                    }}
                                                >
                                                    <SelectTrigger className="flex-1 h-9 text-sm border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500">
                                                        <SelectValue placeholder="Seleccionar número..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {phoneNumbers.length > 0 ? (
                                                            phoneNumbers.map((phone) => (
                                                                <SelectItem key={phone.phone_number} value={phone.phone_number}>
                                                                    <div className="flex items-center gap-2">
                                                                        <span>{phone.phone_number}</span>
                                                                        {phone.nickname && (
                                                                            <span className="text-gray-500 text-xs">({phone.nickname})</span>
                                                                        )}
                                                                    </div>
                                                                </SelectItem>
                                                            ))
                                                        ) : (
                                                            <div className="p-2 text-sm text-gray-500 text-center">
                                                                No hay números disponibles
                                                            </div>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1">Número de Retell utilizado para realizar las llamadas.</p>
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



                                        {/* Country Selector */}
                                        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                                                País de los teléfonos
                                            </label>
                                            <Select
                                                value={campaign.calling_config?.target_country_code || "+34"}
                                                onValueChange={(value) => {
                                                    const newConfig: CallingConfig = {
                                                        ...campaign.calling_config!,
                                                        target_country_code: value
                                                    };
                                                    debouncedSave({ calling_config: newConfig });
                                                }}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Seleccionar país..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectLabel>Europa</SelectLabel>
                                                        <SelectItem value="+34">🇪🇸 España (+34)</SelectItem>
                                                        <SelectItem value="+44">🇬🇧 Reino Unido (+44)</SelectItem>
                                                        <SelectItem value="+33">🇫🇷 Francia (+33)</SelectItem>
                                                        <SelectItem value="+49">🇩🇪 Alemania (+49)</SelectItem>
                                                        <SelectItem value="+39">🇮🇹 Italia (+39)</SelectItem>
                                                    </SelectGroup>
                                                    <SelectGroup>
                                                        <SelectLabel>América</SelectLabel>
                                                        <SelectItem value="+1">🇺🇸 Estados Unidos (+1)</SelectItem>
                                                        <SelectItem value="+52">🇲🇽 México (+52)</SelectItem>
                                                        <SelectItem value="+57">🇨🇴 Colombia (+57)</SelectItem>
                                                        <SelectItem value="+54">🇦🇷 Argentina (+54)</SelectItem>
                                                        <SelectItem value="+56">🇨🇱 Chile (+56)</SelectItem>
                                                        <SelectItem value="+51">🇵🇪 Perú (+51)</SelectItem>
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[10px] text-gray-400 mt-1">
                                                <Globe className="inline h-3 w-3 mr-1" />
                                                Se usará para normalizar números sin prefijo (ej: 600... → +34600...)
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Danger Zone */}
                                <div className="border-t border-gray-200 dark:border-gray-800 pt-6 mt-6">
                                    <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2 mb-4">
                                        Zona de Peligro
                                    </h3>
                                    <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4 flex items-center justify-between border border-red-100 dark:border-red-900/30">
                                        <div className="mr-4">
                                            <p className="text-sm font-medium text-red-900 dark:text-red-200">
                                                Restablecer datos de campaña
                                            </p>
                                            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                                Elimina todo el historial de llamadas y estadísticas asociadas a esta campaña.
                                            </p>
                                        </div>
                                        <DataResetButton type="campaign" id={campaignId} />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* HISTORY TAB */}
                        <TabsContent value="history">
                            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                        <HistoryIcon className="h-5 w-5 text-gray-500" />
                                        Historial de Llamadas
                                    </h3>
                                    {userData?.role === 'superadmin' && (
                                        <DataResetButton
                                            type="campaign"
                                            id={campaignId}
                                            variant="outline"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        />
                                    )}
                                </div>
                                <CallHistoryTable
                                    initialCampaignId={campaignId}
                                    subworkspaceId={activeSubworkspaceId}
                                />
                            </div>
                        </TabsContent>

                        {/* STATS TAB */}
                        <TabsContent value="stats">
                            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                                <div className="flex justify-end mb-4">
                                    {userData?.role === 'superadmin' && (
                                        <DataResetButton
                                            type="campaign"
                                            id={campaignId}
                                            variant="outline"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        />
                                    )}
                                </div>
                                {/* Wrap Stats in explicit height if needed or just block */}
                                <StatsDashboard
                                    initialCampaignId={campaignId}
                                    subworkspaceId={activeSubworkspaceId}
                                    showWorkspaceSelector={false}
                                />
                            </div>
                        </TabsContent>
                    </Tabs>
                </div >
            </div >
        </div >
    );
}
