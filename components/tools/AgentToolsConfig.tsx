"use client";

import { useState } from "react";
import { Plus, Settings, RefreshCw, Trash2, Edit, Code, Globe, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentTool } from "@/types/tools";
import { ToolEditorDialog } from "@/components/tools/ToolEditorDialog";
import { cn } from "@/lib/utils";

interface AgentToolsConfigProps {
    tools: AgentTool[];
    onSaveTools: (tools: AgentTool[]) => void;
    onSync?: () => Promise<void>; // Optional Sync Handler
}

export function AgentToolsConfig({ tools, onSaveTools, onSync }: AgentToolsConfigProps) {
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingTool, setEditingTool] = useState<AgentTool | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleAdd = () => {
        setEditingTool(null);
        setEditorOpen(true);
    };

    const handleEdit = (tool: AgentTool) => {
        setEditingTool(tool);
        setEditorOpen(true);
    };

    const handleDelete = (id: string) => {
        if (confirm("¿Estás seguro de eliminar esta herramienta?")) {
            const newTools = tools.filter(t => t.id !== id);
            onSaveTools(newTools);
        }
    };

    const handleSaveTool = (tool: AgentTool) => {
        let newTools = [...tools];
        const index = newTools.findIndex(t => t.id === tool.id);

        if (index >= 0) {
            newTools[index] = tool;
        } else {
            newTools.push(tool);
        }
        onSaveTools(newTools);
    };

    const handleSyncClick = async () => {
        if (!onSync) return;
        setIsSyncing(true);
        try {
            await onSync();
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Database className="h-5 w-5 text-indigo-500" />
                        Herramientas y APIs
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Configura las acciones que el agente puede realizar conectándose a servicios externos.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {onSync && (
                        <Button
                            variant="outline"
                            onClick={handleSyncClick}
                            disabled={isSyncing}
                            className={cn("gap-2", isSyncing && "opacity-80")}
                        >
                            <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                            {isSyncing ? "Sincronizando..." : "Sincronizar con Retell"}
                        </Button>
                    )}
                    <Button onClick={handleAdd} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Plus className="h-4 w-4" /> Añadir Herramienta
                    </Button>
                </div>
            </div>

            {tools.length === 0 ? (
                <div className="border border-dashed border-gray-200 dark:border-gray-800 rounded-lg p-10 flex flex-col items-center justify-center text-center">
                    <div className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4">
                        <Code className="h-6 w-6 text-indigo-500" />
                    </div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">No hay herramientas configuradas</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
                        Añade tu primera herramienta para que el agente pueda buscar información, crear incidencias o consultar bases de datos.
                    </p>
                    <Button variant="outline" onClick={handleAdd}>Empezar ahora</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {tools.map((tool) => (
                        <div
                            key={tool.id}
                            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors shadow-sm"
                        >
                            <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 font-mono text-xs font-bold text-gray-500">
                                {tool.method}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-gray-900 dark:text-white truncate font-mono text-sm">
                                        {tool.name}
                                    </h4>
                                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700">
                                        {tool.parameters.length} params
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                    {tool.description || "Sin descripción"}
                                </p>
                                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400 font-mono truncate">
                                    <Globe className="h-3 w-3" /> {tool.url}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-gray-100 dark:border-gray-800 pt-3 sm:pt-0 sm:pl-3">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(tool)} className="h-8 w-8 text-gray-500 hover:text-indigo-600">
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(tool.id)} className="h-8 w-8 text-gray-500 hover:text-red-600">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
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
