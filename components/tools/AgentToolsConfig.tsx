"use client";

import { useState, useEffect } from "react";
import { Plus, Database, RefreshCw, Trash2, Edit, Code, Globe, Zap, History, ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentTool, ToolExecutionLog } from "@/types/tools";
import { ToolEditorDialog } from "@/components/tools/ToolEditorDialog";
import { cn } from "@/lib/utils";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useParams } from "next/navigation";

interface AgentToolsConfigProps {
    tools: AgentTool[];
    onSaveTools: (tools: AgentTool[]) => void;
    onSync?: () => Promise<void>; // Optional Sync Handler
}

export function AgentToolsConfig({ tools, onSaveTools, onSync }: AgentToolsConfigProps) {
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingTool, setEditingTool] = useState<AgentTool | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [logs, setLogs] = useState<ToolExecutionLog[]>([]);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    const params = useParams();
    // Identify context: Campaign or Subworkspace
    const campaignId = params.campaignId as string;
    const workspaceId = params.workspaceId as string; // This might be subworkspace or workspace?
    // In InboundAgentView, usually we don't have URL params for subworkspace if embedded?
    // Actually InboundView assumes subworkspace is passed or derived.
    // BUT logs are stored in subworkspaces/{id}/tool_logs or campaigns/{id}/tool_logs

    // We need the parent ID to fetch logs.
    // IMPORTANT: The parent component should probably pass the log fetching logic or the ID.
    // For now, let's try to deduce or rely on props?
    // Let's rely on params. If campaignId exists, it's campaign.
    // If not, we might need the subworkspace ID.
    // Current usage in CampaignDetail passes campaign.tools.
    // Current usage in InboundAgentView passes subworkspace.tools.

    // It's safer if we accept `logParentPath` as a prop: `campaigns/${id}` or `subworkspaces/${id}`.
    // But modifying props requires changing parents.
    // Let's try to use the params first.

    const collectionPath = campaignId
        ? `campaigns/${campaignId}/tool_logs`
        : null; // TODO: Handle Inbound case (need subworkspace ID from somewhere)

    useEffect(() => {
        if (!collectionPath) return;

        const q = query(collection(db, collectionPath), orderBy("timestamp", "desc"), limit(20));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newLogs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ToolExecutionLog[];
            setLogs(newLogs);
        });

        return () => unsubscribe();
    }, [collectionPath]);


    const handleAdd = () => {
        setEditingTool(null);
        setEditorOpen(true);
    };

    const handleEdit = (tool: AgentTool) => {
        setEditingTool(tool);
        setEditorOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm("¿Estás seguro de eliminar esta herramienta?")) {
            const newTools = tools.filter(t => t.id !== id);
            onSaveTools(newTools);

            if (onSync) {
                setIsSyncing(true);
                try {
                    await onSync();
                } finally {
                    setIsSyncing(false);
                }
            }
        }
    };

    const handleSaveTool = async (tool: AgentTool) => {
        let newTools = [...tools];
        const index = newTools.findIndex(t => t.id === tool.id);

        if (index >= 0) {
            newTools[index] = tool;
        } else {
            newTools.push(tool);
        }
        onSaveTools(newTools);

        if (onSync) {
            setIsSyncing(true);
            try {
                await onSync();
            } finally {
                setIsSyncing(false);
            }
        }
    };

    const toggleLog = (id: string) => {
        setExpandedLogId(expandedLogId === id ? null : id);
    };

    return (
        <div className="space-y-8">
            {/* HERRAMIENTAS SECTION */}
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Database className="h-5 w-5 text-indigo-500" />
                            Herramientas y APIs
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Capacidades externas del agente.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isSyncing && (
                            <span className="text-xs text-muted-foreground animate-pulse flex items-center gap-1">
                                <RefreshCw className="h-3 w-3 animate-spin" /> Guardando...
                            </span>
                        )}
                        <Button onClick={handleAdd} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md transition-all">
                            <Plus className="h-4 w-4" /> Nueva Herramienta
                        </Button>
                    </div>
                </div>

                {tools.length === 0 ? (
                    <div className="border border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-12 flex flex-col items-center justify-center text-center bg-gray-50/50 dark:bg-gray-900/50 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                        <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4 ring-8 ring-indigo-50 dark:ring-indigo-900/10">
                            <Zap className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h4 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">No hay herramientas activas</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-8 leading-relaxed">
                            Conecta tu agente a servicios externos (CRM, Calendario, Base de Datos) para que pueda realizar acciones reales.
                        </p>
                        <Button variant="outline" onClick={handleAdd} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900/50">
                            Configurar mi primera herramienta
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {tools.map((tool) => (
                            <div
                                key={tool.id}
                                className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all hover:shadow-md cursor-pointer"
                                onClick={() => handleEdit(tool)}
                            >
                                <div className={cn(
                                    "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm shadow-sm",
                                    tool.method === 'GET' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                                        tool.method === 'POST' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                                            tool.method === 'DELETE' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                                "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                                )}>
                                    {tool.method}
                                </div>

                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center gap-3">
                                        <h4 className="font-bold text-gray-900 dark:text-white text-base truncate">
                                            {tool.name}
                                        </h4>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                                            {tool.parameters.length} params
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                                        {tool.description || "Sin descripción"}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono truncate pt-1 opacity-80">
                                        <Globe className="h-3 w-3" /> {tool.url}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(tool); }} className="h-9 w-9 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(tool.id); }} className="h-9 w-9 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* LOGS SECTION */}
            {collectionPath && (
                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <History className="h-5 w-5 text-gray-500" />
                            Historial de Ejecución
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Últimos eventos y respuestas de las herramientas.
                        </p>
                    </div>

                    <div className="space-y-3">
                        {logs.length === 0 ? (
                            <div className="text-sm text-gray-500 italic p-4 text-center bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                                No hay registros de ejecución recientes.
                            </div>
                        ) : (
                            logs.map(log => (
                                <div key={log.id} className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                                    <div
                                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                        onClick={() => toggleLog(log.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            {log.success ? (
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                            ) : (
                                                <XCircle className="h-4 w-4 text-red-500" />
                                            )}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">{log.tool_name}</span>
                                                    <span className={cn(
                                                        "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                                                        log.response.status >= 200 && log.response.status < 300 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                    )}>
                                                        {log.response.status}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Reciente'} • {log.duration_ms}ms
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {expandedLogId === log.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                        </div>
                                    </div>

                                    {expandedLogId === log.id && (
                                        <div className="p-3 bg-gray-50 dark:bg-black/50 border-t border-gray-200 dark:border-gray-800 text-xs font-mono overflow-x-auto">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <div className="font-bold text-gray-500 mb-1">Request</div>
                                                    <div className="bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-800">
                                                        <div className="mb-1 text-indigo-600 font-bold">{log.request.method} {log.request.url}</div>
                                                        <pre className="whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                                                            {JSON.stringify(log.request.body, null, 2)}
                                                        </pre>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-500 mb-1">Response</div>
                                                    <div className="bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-800">
                                                        <pre className="whitespace-pre-wrap text-emerald-600 dark:text-emerald-400">
                                                            {JSON.stringify(log.response.data || log.response.error, null, 2)}
                                                        </pre>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            <ToolEditorDialog
                open={editorOpen}
                onOpenChange={setEditorOpen}
                toolToEdit={editingTool}
                onSave={handleSaveTool}
            />
        </div>
    );
}
