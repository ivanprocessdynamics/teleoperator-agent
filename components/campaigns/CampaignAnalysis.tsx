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

interface CampaignAnalysisProps {
    config: AnalysisConfig;
    onChange: (newConfig: AnalysisConfig) => void;
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
    hidden_standard_fields: []
};

export function CampaignAnalysis({ config = DEFAULT_CONFIG, onChange }: CampaignAnalysisProps) {
    const [newField, setNewField] = useState<Partial<AnalysisField>>({
        type: 'string',
        name: '',
        description: ''
    });

    const [isAddingField, setIsAddingField] = useState(false);

    const addCustomField = () => {
        if (!newField.name || !newField.description || !newField.type) return;

        const field: AnalysisField = {
            id: Math.random().toString(36).substr(2, 9),
            name: newField.name,
            description: newField.description,
            type: newField.type as any,
            isArchived: false
        };

        onChange({
            ...config,
            custom_fields: [...config.custom_fields, field]
        });

        setNewField({ type: 'string', name: '', description: '' });
        setIsAddingField(false);
    };

    const removeCustomField = (id: string) => {
        onChange({
            ...config,
            custom_fields: config.custom_fields.filter(f => f.id !== id)
        });
    };

    const toggleArchiveField = (id: string) => {
        onChange({
            ...config,
            custom_fields: config.custom_fields.map(f =>
                f.id === id ? { ...f, isArchived: !f.isArchived } : f
            )
        });
    };

    const activeFields = config.custom_fields.filter(f => !f.isArchived);
    const archivedFields = config.custom_fields.filter(f => f.isArchived);

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
                    {/* Add Form (Collapsible/Inline) */}
                    {isAddingField && (
                        <div className="p-6 bg-gray-50/80 dark:bg-gray-900/80 border-b border-gray-100 dark:border-gray-800 animate-in slide-in-from-top-2 duration-200">
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
                                        placeholder="ej: ¿Cuál fue la razón exacta por la que el cliente dijo que no?"
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
                                        <Button variant="ghost" size="sm" onClick={() => toggleArchiveField(field.id)} className="text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10">
                                            <Archive className="h-4 w-4 mr-2" />
                                            Archivar
                                        </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            !isAddingField && (
                                <div className="py-12 flex flex-col items-center justify-center text-center">
                                    <div className="h-12 w-12 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-3">
                                        <Brain className="h-6 w-6 text-gray-300 dark:text-gray-600" />
                                    </div>
                                    <h5 className="text-gray-900 dark:text-white font-medium">Sin métricas personalizadas</h5>
                                    <p className="text-sm text-gray-500 max-w-xs mt-1">Añade campos específicos que quieras que la IA detecte en cada llamada.</p>
                                </div>
                            )
                        )}
                    </div>

                    {/* Archived Section */}
                    {archivedFields.length > 0 && (
                        <div className="bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
                            <div className="px-4 py-3 bg-gray-100/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                                <Archive className="h-4 w-4 text-gray-400" />
                                <span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Métricas Archivadas (Ocultas)</span>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-gray-800 opacity-60 hover:opacity-100 transition-opacity p-2">
                                {archivedFields.map((field) => (
                                    <div key={field.id} className="flex items-center justify-between p-3 rounded hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 line-through decoration-gray-300">{field.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => toggleArchiveField(field.id)} className="h-7 w-7 text-gray-400 hover:text-green-600 hover:bg-green-50" title="Restaurar Visibilidad">
                                                <RefreshCcw className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => removeCustomField(field.id)} className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50" title="Eliminar definitivamente">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
