"use client";

import { useState, useEffect } from "react";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, BarChart3, History, Settings2, Mic } from "lucide-react";
import { TestingEnvironment } from "@/components/TestingEnvironment";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CallHistoryTable } from "@/components/calls/CallHistoryTable";
import { StatsDashboard } from "@/components/stats/StatsDashboard";
import { CampaignPrompt } from "@/components/campaigns/CampaignPrompt";
import { CampaignAnalysis } from "@/components/campaigns/CampaignAnalysis";

interface InboundAgentViewProps {
    subworkspaceId: string;
    agentId: string | null;
}

export function InboundAgentView({ subworkspaceId, agentId }: InboundAgentViewProps) {
    const [activeTab, setActiveTab] = useState("config");
    const [promptData, setPromptData] = useState({ prompt: "" });
    const [analysisConfig, setAnalysisConfig] = useState<any>({ custom_fields: [] }); // Use proper type

    // Fetch Data
    useEffect(() => {
        if (!subworkspaceId) return;
        const unsub = onSnapshot(doc(db, "subworkspaces", subworkspaceId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPromptData({ prompt: data.active_prompt || data.prompt_editable_text || "" });
                setAnalysisConfig(data.analysis_config || { custom_fields: [] });
            }
        });
        return () => unsub();
    }, [subworkspaceId]);

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

    return (
        <div className="flex flex-col gap-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-[800px] grid-cols-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    <TabsTrigger
                        value="config"
                        className="gap-2 text-gray-900 dark:text-gray-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                    >
                        <Settings2 className="h-4 w-4" /> Configuración
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

                {/* CONFIGURATION TAB */}
                <TabsContent value="config" forceMount className="mt-6 data-[state=inactive]:hidden">
                    <div className="flex flex-col gap-6 pb-20">
                        <div className="flex justify-end">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md">
                                        <Mic className="mr-2 h-4 w-4" /> Probar Agente
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                                    <TestingEnvironment subworkspaceId={subworkspaceId} />
                                </DialogContent>
                            </Dialog>
                        </div>

                        {/* Prompt Editor */}
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden min-h-[500px]">
                            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                                <h3 className="font-semibold text-gray-900 dark:text-white">Prompt del Agente</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                <CampaignPrompt
                                    campaignId="agent_level" // Placeholder
                                    subworkspaceId={subworkspaceId}
                                    isAgentLevel={true}
                                    prompt={promptData.prompt}
                                    columns={[]} // No column variables for inbound usually, or maybe generic ones?
                                    onChange={(val) => handleSavePrompt(val)}
                                    onSyncAgent={async (val) => {
                                        // Specific sync logic if needed, or just save
                                        await handleSavePrompt(val);
                                        // Verify if we need to call Retell api here?
                                        // CampaignPrompt usually calls 'onSyncAgent' which triggers backend sync.
                                        // We might need an API endpoint for syncing agent-level prompt if different.
                                        // For now, save to firestore is primary.
                                    }}
                                />
                            </div>
                        </div>

                        {/* Analysis Configuration */}
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                                <h3 className="font-semibold text-gray-900 dark:text-white">Análisis y Variables</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                <CampaignAnalysis
                                    config={analysisConfig}
                                    onChange={handleSaveAnalysis}
                                    isCampaignMode={false} // Allows editing freely
                                />
                            </div>
                        </div>
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
