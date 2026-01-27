"use client";

import { useState } from "react";
import { AnalysisConfig, AnalysisField } from "@/types/campaign";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Trash2, Brain, FileText, BarChart3, Archive, RefreshCcw, Eye, EyeOff, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CampaignAnalysisProps {
    config: AnalysisConfig;
    onChange: (newConfig: AnalysisConfig) => void;

    // Global support
    globalFields?: AnalysisField[];
    onAddGlobalField?: (field: AnalysisField) => void;
    onDeleteGlobalField?: (fieldId: string) => void;
    isCampaignMode?: boolean; // If true, disables creation/deletion and only allows toggling active state
}

const DEFAULT_CONFIG: AnalysisConfig = {
    enable_transcription: true,
    standard_fields: {
        satisfaction_score: true,
        sentiment: true,
        summary: true,
        user_sentiment: true,
        call_successful: true
    },
    custom_fields: [],
    hidden_standard_fields: [],
    ignored_custom_fields: []
};

export function CampaignAnalysis({
    config = DEFAULT_CONFIG,
    onChange,
    globalFields,
    onAddGlobalField,
    onDeleteGlobalField,
    isCampaignMode = false
}: CampaignAnalysisProps) {
    const [newField, setNewField] = useState<Partial<AnalysisField>>({
        type: 'string',
        name: '',
        description: ''
    });

    const [isAddingField, setIsAddingField] = useState(false);
    const [fieldToDelete, setFieldToDelete] = useState<AnalysisField | null>(null);

    // Determine Active vs Archived
    // Mode A: Global Mode (if globalFields provided)
    // Mode B: Local Mode (fallback)
    const isGlobalMode = Array.isArray(globalFields);

    const activeFields = isGlobalMode
        ? config.custom_fields.filter(f => !f.isArchived)
        : config.custom_fields.filter(f => !f.isArchived);

    const archivedFields = isGlobalMode
        ? (globalFields || []).filter(gf => {
            const localMatch = config.custom_fields.find(af => af.name === gf.name); // Match by name to support derived local
            return !localMatch || localMatch.isArchived;
        })
        : config.custom_fields.filter(f => f.isArchived);

    const addCustomField = () => {
        if (!newField.name || !newField.description || !newField.type) return;

        const field: AnalysisField = {
            id: Math.random().toString(36).substr(2, 9),
            name: newField.name,
            description: newField.description,
            type: newField.type as any,
            isArchived: false
        };

        // 1. Add to Global (if mode on)
        if (isGlobalMode && onAddGlobalField) {
            onAddGlobalField(field);
        }

        // 2. Add to Local Active
        // Check for duplicates in local first?
        if (!config.custom_fields.some(f => f.name === field.name)) {
            onChange({
                ...config,
                custom_fields: [...config.custom_fields, field]
            });
        }

        setNewField({ type: 'string', name: '', description: '' });
        setIsAddingField(false);
    };

    // "Archivar": Remove from Active List (Global Mode) OR Set isArchived=true (Local Mode)
    const archiveField = (id: string) => {
        if (isGlobalMode) {
            onChange({
                ...config,
                custom_fields: config.custom_fields.filter(f => f.id !== id)
            });
        } else {
            onChange({
                ...config,
                custom_fields: config.custom_fields.map(f => f.id === id ? { ...f, isArchived: true } : f)
            });
        }
    };

    // "Restaurar": Add from Global to Active (Global Mode) OR Set isArchived=false (Local Mode)
    const restoreField = (field: AnalysisField) => {
        if (isGlobalMode) {
            onChange({
                ...config,
                custom_fields: [...config.custom_fields, field]
            });
        } else {
            onChange({
                ...config,
                custom_fields: config.custom_fields.map(f => f.id === field.id ? { ...f, isArchived: false } : f)
            });
        }
    };

    // "Eliminar": Delete from Global (Global Mode) OR Delete from Local (Local Mode)
    const deletePermanent = (id: string) => {
        if (isGlobalMode && onDeleteGlobalField) {
            onDeleteGlobalField(id);
            // Also ensure it's removed from local if present
            onChange({
                ...config,
                custom_fields: config.custom_fields.filter(f => f.id !== id)
            });
        } else {
            const field = config.custom_fields.find(f => f.id === id);
            const ignored = config.ignored_custom_fields || [];
            const newIgnored = field ? [...ignored, field.name] : ignored;

            onChange({
                ...config,
                custom_fields: config.custom_fields.filter(f => f.id !== id),
                ignored_custom_fields: newIgnored
            });
        }
    };

    const confirmDelete = () => {
        if (fieldToDelete) {
            deletePermanent(fieldToDelete.id);
            setFieldToDelete(null);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Custom Extraction */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <CardHeader className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400 ring-4 ring-purple-50 dark:ring-purple-900/10">
                                <Brain className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Extracción Personalizada</CardTitle>
                                <CardDescription>Define datos específicos a extraer</CardDescription>
                            </div>
                        </div>

                        {!isAddingField && (
                            <Button onClick={() => setIsAddingField(true)} size="sm" className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg shadow-gray-200 dark:shadow-none hover:shadow-xl transition-all">
                                <Plus className="h-4 w-4 mr-2" />
                                Nuevo Campo
                            </Button>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {/* Campaign Mode Info Banner */}
                    {isCampaignMode && (
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20 px-6 py-4 flex items-start gap-4">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                <RefreshCcw className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Gestión Centralizada</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
                                    Estas variables se sincronizan automáticamente con el Entorno de Pruebas.
                                    Puedes activar o desactivar cuáles usar en esta campaña, pero para crear nuevas o eliminarlas debes ir al Entorno de Pruebas.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Add Form (Collapsible/Inline) */}
                    {isAddingField && !isCampaignMode && (
                        <div className="p-6 bg-gray-50/80 dark:bg-gray-900/80 border-b border-gray-100 dark:border-gray-800 animate-in slide-in-from-top-2 duration-200">
                            {/* ... (Keep existing form content) ... */}
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                                    Configurar Nuevo Campo
                                </h4>
                                <Button variant="ghost" size="sm" onClick={() => setIsAddingField(false)} className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex flex-col gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre del Dato</Label>
                                        <Input
                                            placeholder="ej: Motivo del Rechazo"
                                            value={newField.name}
                                            onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                                            className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo de Respuesta</Label>
                                        <Select
                                            value={newField.type}
                                            onValueChange={(v) => setNewField({ ...newField, type: v as any })}
                                        >
                                            <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="string">Texto Libre</SelectItem>
                                                <SelectItem value="boolean">Sí / No</SelectItem>
                                                <SelectItem value="number">Numérico</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Instrucción para la IA</Label>
                                    <Input
                                        placeholder="ej: ¿Cuál fue la razón exacta por la que el cliente dijo no?"
                                        value={newField.description}
                                        onChange={(e) => setNewField({ ...newField, description: e.target.value })}
                                        className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-10"
                                    />
                                </div>

                                <div className="pt-2 flex justify-end">
                                    <Button
                                        onClick={addCustomField}
                                        disabled={!newField.name || !newField.description}
                                        className="bg-purple-600 hover:bg-purple-700 text-white w-full md:w-auto min-w-[120px]"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Añadir Campo
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Active Fields List */}
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {activeFields.length > 0 ? (
                            activeFields.map((field) => (
                                <div key={field.id} className="group flex items-start justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <div className="flex gap-4">
                                        <div className="mt-1">
                                            {field.type === 'boolean' && <div className="h-2 w-2 rounded-full bg-green-400 mt-2" title="Sí/No" />}
                                            {field.type === 'number' && <div className="h-2 w-2 rounded-full bg-blue-400 mt-2" title="Número" />}
                                            {field.type === 'string' && <div className="h-2 w-2 rounded-full bg-orange-400 mt-2" title="Texto" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{field.name}</h4>
                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal bg-gray-100 text-gray-500 border-0">
                                                    {field.type === 'boolean' ? 'Sí/No' : field.type === 'number' ? 'Número' : 'Texto'}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{field.description}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="sm" onClick={() => archiveField(field.id)} className="text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10">
                                            <Archive className="h-4 w-4 mr-2" />
                                            {isCampaignMode ? "Desactivar" : "Archivar"}
                                        </Button>
                                        {!isCampaignMode && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setFieldToDelete(field)}
                                                className="text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                                                title="Eliminar definitivamente"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            !isAddingField && (
                                <div className="py-12 flex flex-col items-center justify-center text-center">
                                    <div className="h-12 w-12 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-3">
                                        <Brain className="h-6 w-6 text-gray-300 dark:text-gray-600" />
                                    </div>
                                    <h5 className="text-gray-900 dark:text-white font-medium">Sin métricas activas</h5>
                                    <p className="text-sm text-gray-500 max-w-xs mt-1">
                                        {isCampaignMode
                                            ? "No hay métricas activas. Activa las disponibles abajo."
                                            : (archivedFields.length > 0 ? "Hay métricas disponibles abajo. Restáuralas para usarlas." : "Añade campos específicos que quieras que la IA detecte en cada llamada.")
                                        }
                                    </p>
                                </div>
                            )
                        )}
                    </div>

                    {/* Archived Section */}
                    {archivedFields.length > 0 && (
                        <div className="bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
                            <div className="px-4 py-3 bg-gray-100/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                                <Archive className="h-4 w-4 text-gray-400" />
                                <span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
                                    {isCampaignMode ? "Métricas Disponibles (Inactivas)" : "Métricas Disponibles (Archivadas)"}
                                </span>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-gray-800 opacity-80 hover:opacity-100 transition-opacity p-2">
                                {archivedFields.map((field) => (
                                    <div key={field.id} className="flex items-center justify-between p-3 rounded hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                            <span className={cn(
                                                "text-sm font-medium text-gray-600 dark:text-gray-400",
                                                !isCampaignMode && "line-through decoration-gray-300"
                                            )}>
                                                {field.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => restoreField(field)} className="h-7 w-7 text-gray-400 hover:text-green-600 hover:bg-green-50" title="Activar">
                                                <RefreshCcw className="h-3.5 w-3.5" />
                                            </Button>
                                            {!isCampaignMode && (
                                                <Button variant="ghost" size="icon" onClick={() => setFieldToDelete(field)} className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50" title="Eliminar definitivamente">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!fieldToDelete} onOpenChange={(open) => !open && setFieldToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Eliminar métrica "{fieldToDelete?.name}"?</DialogTitle>
                        <DialogDescription>
                            Estás a punto de eliminar definitivamente esta configuración de métrica. La IA dejará de buscar este dato en futuras llamadas.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFieldToDelete(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
