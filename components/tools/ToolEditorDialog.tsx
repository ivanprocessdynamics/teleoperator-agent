"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Globe, Key, Braces, Play } from "lucide-react";
import { AgentTool, ToolParameter } from "@/types/tools";
import { v4 as uuidv4 } from "uuid";

interface ToolEditorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    toolToEdit?: AgentTool | null;
    onSave: (tool: AgentTool) => void;
}

export function ToolEditorDialog({ open, onOpenChange, toolToEdit, onSave }: ToolEditorDialogProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [url, setUrl] = useState("");
    const [method, setMethod] = useState<"GET" | "POST" | "PATCH" | "PUT" | "DELETE">("GET");
    const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
    const [parameters, setParameters] = useState<ToolParameter[]>([]);

    useEffect(() => {
        if (open) {
            if (toolToEdit) {
                setName(toolToEdit.name);
                setDescription(toolToEdit.description);
                setUrl(toolToEdit.url);
                setMethod(toolToEdit.method);
                setHeaders(toolToEdit.headers || []);
                setParameters(toolToEdit.parameters || []);
            } else {
                // Reset for new tool
                setName("");
                setDescription("");
                setUrl("");
                setMethod("GET");
                setHeaders([]);
                setParameters([]);
            }
        }
    }, [open, toolToEdit]);

    const handleSave = () => {
        if (!name || !url) return;

        // Allow any name (will be sanitized for LLM function name on sync)
        const finalName = name.trim();

        const newTool: AgentTool = {
            id: toolToEdit?.id || uuidv4(),
            name: finalName,
            description,
            url,
            method,
            headers,
            parameters
        };
        onSave(newTool);
        onOpenChange(false);
    };

    const addHeader = () => setHeaders([...headers, { key: "", value: "" }]);
    const updateHeader = (index: number, field: "key" | "value", val: string) => {
        const newHeaders = [...headers];
        newHeaders[index] = { ...newHeaders[index], [field]: val };
        setHeaders(newHeaders);
    };
    const removeHeader = (index: number) => setHeaders(headers.filter((_, i) => i !== index));

    const addParameter = () => setParameters([...parameters, { name: "", type: "string", description: "", required: true }]);
    const updateParameter = (index: number, field: keyof ToolParameter, val: any) => {
        const newParams = [...parameters];
        newParams[index] = { ...newParams[index], [field]: val };
        setParameters(newParams);
    };
    const removeParameter = (index: number) => setParameters(parameters.filter((_, i) => i !== index));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{toolToEdit ? "Editar Herramienta" : "Nueva Herramienta"}</DialogTitle>
                    <DialogDescription>
                        Configura un endpoint API para que el agente pueda usarlo.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* General Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nombre de la Herramienta</Label>
                            <Input
                                placeholder="ej. Buscar Cliente"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="font-semibold"
                            />
                            <p className="text-xs text-muted-foreground">Nombre identificativo para el agente.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Descripción (Prompt)</Label>
                            <Textarea
                                placeholder="Explica al LLM qué hace esto y cuándo usarlo..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="h-[38px] min-h-[38px] resize-none overflow-hidden hover:overflow-y-auto focus:overflow-y-auto focus:h-20 transition-all"
                            />
                        </div>
                    </div>

                    {/* Request Config */}
                    <div className="space-y-4 border rounded-md p-4 bg-muted/30">
                        <div className="flex items-center gap-2 font-medium text-sm text-primary mb-2">
                            <Globe className="h-4 w-4" /> Configuración de Petición
                        </div>
                        <div className="flex gap-2">
                            <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {["GET", "POST", "PUT", "PATCH", "DELETE"].map(m => (
                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                placeholder="https://api.ejemplo.com/v1/resource"
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                                className="flex-1 font-mono text-sm"
                            />
                        </div>

                        {/* Headers */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs font-medium flex items-center gap-1"><Key className="h-3 w-3" /> Headers</Label>
                                <Button variant="ghost" size="sm" onClick={addHeader} className="h-6 text-xs hover:bg-transparent text-primary p-0">+ Añadir Header</Button>
                            </div>
                            {headers.map((h, i) => (
                                <div key={i} className="flex gap-2 items-center">
                                    <Input placeholder="Key" value={h.key} onChange={e => updateHeader(i, "key", e.target.value)} className="h-8 text-xs font-mono" />
                                    <Input placeholder="Value" value={h.value} onChange={e => updateHeader(i, "value", e.target.value)} className="h-8 text-xs font-mono flex-1" />
                                    <Button variant="ghost" size="icon" onClick={() => removeHeader(i)} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            ))}
                            {headers.length === 0 && <p className="text-xs text-muted-foreground italic">Sin headers configurados.</p>}
                        </div>
                    </div>

                    {/* Parameters */}
                    <div className="space-y-4 border rounded-md p-4 bg-muted/30">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2 font-medium text-sm text-primary">
                                <Braces className="h-4 w-4" /> Parámetros (Inputs)
                            </div>
                            <Button variant="outline" size="sm" onClick={addParameter} className="h-7 text-xs">
                                <Plus className="h-3 w-3 mr-1" /> Añadir Parámetro
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {parameters.map((p, i) => (
                                <div key={i} className="flex flex-col gap-2 p-3 bg-background rounded-md border shadow-sm">
                                    <div className="flex gap-2 items-start">
                                        <div className="w-1/3 space-y-1">
                                            <Input
                                                placeholder="Nombre (ej. phone)"
                                                value={p.name}
                                                onChange={e => updateParameter(i, "name", e.target.value)}
                                                className="h-8 text-xs font-mono"
                                            />
                                            <Select value={p.type} onValueChange={v => updateParameter(i, "type", v)}>
                                                <SelectTrigger className="h-7 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="string">String</SelectItem>
                                                    <SelectItem value="number">Number</SelectItem>
                                                    <SelectItem value="boolean">Boolean</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <Input
                                                placeholder="Descripción para la IA..."
                                                value={p.description}
                                                onChange={e => updateParameter(i, "description", e.target.value)}
                                                className="h-8 text-xs"
                                            />
                                            <div className="flex items-center gap-2 pt-1">
                                                <Label className="text-xs cursor-pointer flex items-center gap-2">
                                                    <Switch
                                                        checked={p.required}
                                                        onCheckedChange={c => updateParameter(i, "required", c)}
                                                        className="scale-75 origin-left"
                                                    />
                                                    Obligatorio
                                                </Label>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => removeParameter(i)} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            ))}
                            {parameters.length === 0 && (
                                <div className="text-center py-4 text-sm text-muted-foreground border-dashed border-2 rounded-md">
                                    Esta herramienta no requiere parámetros de entrada.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={!name || !url}>Guardar Herramienta</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
