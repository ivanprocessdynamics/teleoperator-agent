"use client";

import { useState } from "react";
import { AnalysisConfig, AnalysisField } from "@/types/campaign";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Trash2, Brain, FileText, BarChart3 } from "lucide-react";

interface CampaignAnalysisProps {
    config?: AnalysisConfig;
    onChange: (newConfig: AnalysisConfig) => void;
}

const DEFAULT_CONFIG: AnalysisConfig = {
    enable_transcription: true,
    standard_fields: {
        satisfaction_score: true,
        sentiment: true,
        summary: true,
        user_sentiment: false,
        call_successful: false
    },
    custom_fields: []
};

export function CampaignAnalysis({ config = DEFAULT_CONFIG, onChange }: CampaignAnalysisProps) {
    const [newField, setNewField] = useState<Partial<AnalysisField>>({
        type: 'string',
        name: '',
        description: ''
    });

    const handleStandardChange = (key: keyof AnalysisConfig['standard_fields'], value: boolean) => {
        onChange({
            ...config,
            standard_fields: {
                ...config.standard_fields,
                [key]: value
            }
        });
    };

    const addCustomField = () => {
        if (!newField.name || !newField.description || !newField.type) return;

        const field: AnalysisField = {
            id: Math.random().toString(36).substr(2, 9),
            name: newField.name.toLowerCase().replace(/\s+/g, '_'),
            description: newField.description,
            type: newField.type as any
        };

        onChange({
            ...config,
            custom_fields: [...config.custom_fields, field]
        });

        setNewField({ type: 'string', name: '', description: '' });
    };

    const removeCustomField = (id: string) => {
        onChange({
            ...config,
            custom_fields: config.custom_fields.filter(f => f.id !== id)
        });
    };

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Standard Metrics */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                            <BarChart3 className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Métricas Estándar</CardTitle>
                            <CardDescription>Datos que la IA extraerá automáticamente de cada llamada</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="summary" className="flex flex-col gap-1">
                            <span>Resumen de Llamada</span>
                            <span className="font-normal text-xs text-muted-foreground">Genera un resumen conciso de lo hablado</span>
                        </Label>
                        <Switch
                            id="summary"
                            checked={config.standard_fields.summary}
                            onCheckedChange={(c) => handleStandardChange('summary', c)}
                        />
                    </div>
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="satisfaction" className="flex flex-col gap-1">
                            <span>Puntuación de Satisfacción</span>
                            <span className="font-normal text-xs text-muted-foreground">Del 0 al 10, qué tan contento quedó el cliente</span>
                        </Label>
                        <Switch
                            id="satisfaction"
                            checked={config.standard_fields.satisfaction_score}
                            onCheckedChange={(c) => handleStandardChange('satisfaction_score', c)}
                        />
                    </div>
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="sentiment" className="flex flex-col gap-1">
                            <span>Sentimiento General</span>
                            <span className="font-normal text-xs text-muted-foreground">Positivo, Neutro o Negativo</span>
                        </Label>
                        <Switch
                            id="sentiment"
                            checked={config.standard_fields.sentiment}
                            onCheckedChange={(c) => handleStandardChange('sentiment', c)}
                        />
                    </div>
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="successful" className="flex flex-col gap-1">
                            <span>Éxito de la Llamada</span>
                            <span className="font-normal text-xs text-muted-foreground">¿Se cumplió el objetivo principal? (Sí/No)</span>
                        </Label>
                        <Switch
                            id="successful"
                            checked={config.standard_fields.call_successful}
                            onCheckedChange={(c) => handleStandardChange('call_successful', c)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Custom Extraction */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                            <Brain className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Extracción Personalizada</CardTitle>
                            <CardDescription>Define qué información específica quieres que la IA busque</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Add New Field Form */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2 w-full">
                            <Label className="text-xs uppercase text-gray-500">Nombre del Campo</Label>
                            <Input
                                placeholder="ej: motivo_rechazo"
                                value={newField.name}
                                onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                                className="bg-white dark:bg-gray-800"
                            />
                        </div>
                        <div className="flex-[2] space-y-2 w-full">
                            <Label className="text-xs uppercase text-gray-500">¿Qué debe buscar la IA?</Label>
                            <Input
                                placeholder="ej: La razón exacta por la que el cliente dijo que no le interesaba"
                                value={newField.description}
                                onChange={(e) => setNewField({ ...newField, description: e.target.value })}
                                className="bg-white dark:bg-gray-800"
                            />
                        </div>
                        <div className="w-full md:w-32 space-y-2">
                            <Label className="text-xs uppercase text-gray-500">Tipo</Label>
                            <Select
                                value={newField.type}
                                onValueChange={(v) => setNewField({ ...newField, type: v as any })}
                            >
                                <SelectTrigger className="bg-white dark:bg-gray-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="string">Texto</SelectItem>
                                    <SelectItem value="boolean">Sí/No</SelectItem>
                                    <SelectItem value="number">Número</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={addCustomField} disabled={!newField.name || !newField.description} className="shrink-0 bg-gray-900 dark:bg-white text-white dark:text-gray-900">
                            <Plus className="h-4 w-4 mr-2" /> Añadir
                        </Button>
                    </div>

                    {/* List of Fields */}
                    {config.custom_fields.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3">
                            {config.custom_fields.map((field) => (
                                <div key={field.id} className="flex items-start justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm font-semibold text-purple-600 dark:text-purple-400">{field.name}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">{field.type === 'boolean' ? 'Sí/No' : field.type === 'string' ? "Texto" : "Número"}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{field.description}</p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => removeCustomField(field.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm italic">
                            No hay campos personalizados definidos
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
