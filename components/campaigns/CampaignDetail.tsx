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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function CampaignDetail({ campaignId, subworkspaceId, onBack }: CampaignDetailProps) {
    // ... (existing state)
    const [showRelaunchDialog, setShowRelaunchDialog] = useState(false);
    const [relaunchStartLine, setRelaunchStartLine] = useState("1");
    const [showRelaunchLineDialog, setShowRelaunchLineDialog] = useState(false);

    // ...

    // Campaign Executor
    const executor = useCampaignExecutor({
        campaignId: campaignId,
        agentId: retellAgentId || '',
        callingConfig: campaign?.calling_config || { from_number: '+34877450708', concurrency_limit: 1, retry_failed: false },
        phoneColumnId: phoneColumnId,
        campaignPrompt: campaign?.prompt_template || '',
        columns: campaign?.columns || [] // Pass columns for dynamic variables
    });

    // ...

    {/* Relaunch Card - Premium Redesign */ }
    {
        executor.hasBeenRun && !executor.state.isRunning && (
            <div className="group relative overflow-hidden bg-white dark:bg-gray-900 border border-amber-200/50 dark:border-amber-800/50 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                {/* Background Gradient Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

                <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900 dark:to-amber-800 flex items-center justify-center shadow-inner">
                            <Phone className="h-6 w-6 text-amber-700 dark:text-amber-300" />
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                Campaña Finalizada
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

                    <div className="flex items-center gap-3 w-full sm:w-auto">
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
            </div>
        )
    }

    {/* Relaunch Confirmation Dialog */ }
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
                        executor.start();
                    }}
                >
                    Confirmar y Relanzar
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    {/* Relaunch From Line Dialog */ }
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
                            executor.start();
                        }
                    }}
                >
                    Relanzar
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    {/* Main Split View */ }
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
        </div >
    );
}
