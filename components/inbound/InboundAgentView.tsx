"use client";

import { useState, useEffect } from "react";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, BarChart3, History, Settings2, Mic, Phone, Database } from "lucide-react";
import { TestingEnvironment } from "@/components/TestingEnvironment";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CallHistoryTable } from "@/components/calls/CallHistoryTable";
import { StatsDashboard } from "@/components/stats/StatsDashboard";
import { CampaignPrompt } from "@/components/campaigns/CampaignPrompt";
import { CampaignAnalysis } from "@/components/campaigns/CampaignAnalysis";
import { ConnectPhoneNumberModal } from "@/components/inbound/PhoneNumberConnectModal";
import { AgentToolsConfig } from "@/components/tools/AgentToolsConfig";
import { AgentTool } from "@/types/tools";

interface InboundAgentViewProps {
    subworkspaceId: string;
    agentId: string | null;
}

export function InboundAgentView({ subworkspaceId, agentId }: InboundAgentViewProps) {
    const [activeTab, setActiveTab] = useState("config");
    const [promptData, setPromptData] = useState({ prompt: "" });
    const [analysisConfig, setAnalysisConfig] = useState<any>({ custom_fields: [] });
    const [tools, setTools] = useState<AgentTool[]>([]);

    // Fetch Data
    useEffect(() => {
        if (!subworkspaceId) return;
        const unsub = onSnapshot(doc(db, "subworkspaces", subworkspaceId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPromptData({ prompt: data.active_prompt || data.prompt_editable_text || "" });
                setAnalysisConfig(data.analysis_config || { custom_fields: [] });
                setTools(data.tools || []);
            }
        });
        return () => unsub();
    }, [subworkspaceId]);

    // Self-healing: Ensure retell_agent_id is synced to the subworkspace document
    useEffect(() => {
        if (!agentId || !subworkspaceId) return;
        updateDoc(doc(db, "subworkspaces", subworkspaceId), {
            retell_agent_id: agentId
        }).catch(err => console.error("Error syncing agent ID:", err));
    }, [subworkspaceId, agentId]);

    const handleSavePrompt = async (newPrompt: string) => {
        try {
            await updateDoc(doc(db, "subworkspaces", subworkspaceId), {
                active_prompt: newPrompt,
                prompt_editable_text: newPrompt
            });
        } catch (e) {
            console.error("Error saving prompt", e);
        }
    };

    const handleSaveAnalysis = async (newConfig: any) => {
        try {
            await updateDoc(doc(db, "subworkspaces", subworkspaceId), {
                analysis_config: newConfig
            });
        } catch (e) {
            console.error("Error saving analysis", e);
        }
    };

    const handleSaveTools = async (newTools: AgentTool[]) => {
        try {
            await updateDoc(doc(db, "subworkspaces", subworkspaceId), {
                tools: newTools
            });
        } catch (e) {
            console.error("Error saving tools", e);
        }
    };

    const handleSyncTools = async () => {
        if (!agentId) return;
        const response = await fetch("/api/retell/update-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                agent_id: agentId,
                tools: tools
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to sync tools to Retell");
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex flex-col xl:flex-row items-center justify-between gap-4 mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white shrink-0">Configuración del Agente</h1>
                    <TabsList className="grid w-full max-w-[600px] grid-cols-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        <TabsTrigger
                            value="config"
                            className="gap-2 text-gray-900 dark:text-gray-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                        >
                            <Settings2 className="h-4 w-4" /> Configuración
                        </TabsTrigger>
                        <TabsTrigger
                            value="tools"
                            className="gap-2 text-gray-900 dark:text-gray-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                        >
                            <Database className="h-4 w-4" /> Herramientas
                        </TabsTrigger>
                        <TabsTrigger
                            value="history"
                            className="gap-2 text-gray-900 dark:text-gray-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                        >
                            <History className="h-4 w-4" /> Historial
                        </TabsTrigger>
                        <TabsTrigger
                            value="stats"
                            className="gap-2 text-gray-900 dark:text-gray-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                        >
                            <BarChart3 className="h-4 w-4" /> Estadísticas
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2 shrink-0">
                        {agentId && (
                            <ConnectPhoneNumberModal
                                agentId={agentId}
                                trigger={
                                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 border-0 transition-all hover:scale-105 active:scale-95">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1 bg-white/20 rounded-full">
                                                <Phone className="h-3.5 w-3.5" />
                                            </div>
                                            <span>Conectar con número</span>
                                        </div>
                                    </Button>
                                }
                            />
                        )}
                    </div>
                </div>

                <TabsContent value="config" forceMount className="mt-0 data-[state=inactive]:hidden text-gray-900 dark:text-gray-100">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-140px)]">
                        {/* LEFT COLUMN: Prompt & Analysis (Unified Scroll) */}
                        <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                            {/* Prompt Editor */}
                            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col shrink-0">
                                <div className="p-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10 rounded-t-lg">
                                    <h3 className="font-semibold text-gray-900 dark:text-white">Prompt del Agente</h3>
                                </div>
                                <div className="p-4">
                                    <CampaignPrompt
                                        campaignId="agent_level"
                                        subworkspaceId={subworkspaceId}
                                        isAgentLevel={true}
                                        prompt={promptData.prompt}
                                        columns={[]}
                                        onChange={(val) => handleSavePrompt(val)}
                                        onSyncAgent={async (val) => {
                                            await handleSavePrompt(val);
                                            // Call API to update Retell
                                            if (agentId) {
                                                try {
                                                    const response = await fetch("/api/retell/update-agent", {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({
                                                            agent_id: agentId,
                                                            prompt: val
                                                        }),
                                                    });

                                                    if (!response.ok) {
                                                        throw new Error("Failed to update Retell agent");
                                                    }
                                                } catch (err) {
                                                    console.error("Error syncing with Retell:", err);
                                                    // Optionally show toast error
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Analysis Configuration */}
                            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col shrink-0">
                                <div className="p-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10 rounded-t-lg">
                                    <h3 className="font-semibold text-gray-900 dark:text-white">Análisis y Variables</h3>
                                </div>
                                <div className="p-4">
                                    <CampaignAnalysis
                                        config={analysisConfig}
                                        onChange={handleSaveAnalysis}
                                        isCampaignMode={false}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Testing Environment */}
                        <div className="h-full bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col relative sticky top-0">
                            <div className="absolute inset-0">
                                <TestingEnvironment subworkspaceId={subworkspaceId} orbOnly={true} />
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="tools" forceMount className="mt-0 data-[state=inactive]:hidden text-gray-900 dark:text-gray-100">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                        <AgentToolsConfig
                            tools={tools}
                            onSaveTools={handleSaveTools}
                            onSync={handleSyncTools}
                        />
                    </div>
                </TabsContent>

                {/* HISTORY TAB */}
                <TabsContent value="history" forceMount className="mt-6 data-[state=inactive]:hidden">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Historial de Llamadas</h2>
                        {agentId ? (
                            <CallHistoryTable agentId={agentId} />
                        ) : (
                            <div className="text-center py-10 text-gray-500">Cargando agente...</div>
                        )}
                    </div>
                </TabsContent>

                {/* STATS TAB */}
                <TabsContent value="stats" forceMount className="mt-6 data-[state=inactive]:hidden">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                        {agentId ? (
                            <StatsDashboard agentId={agentId} subworkspaceId={subworkspaceId} />
                        ) : (
                            <div className="text-center py-10 text-gray-500">Cargando agente...</div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
