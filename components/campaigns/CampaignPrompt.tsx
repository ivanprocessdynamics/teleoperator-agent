"use client";

import { useState, useEffect } from "react";
import { Campaign, CampaignColumn } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, MessageSquare, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CampaignPromptProps {
    prompt: string;
    columns: CampaignColumn[];
    onChange: (newPrompt: string) => void;
    variableClass?: string;
}

export function CampaignPrompt({ prompt, columns, onChange, variableClass }: CampaignPromptProps) {
    const [localPrompt, setLocalPrompt] = useState(prompt);
    const [isFocused, setIsFocused] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout>(null);

    // Sync from props only if not focused (to avoid overwriting user input with old server data)
    useEffect(() => {
        if (!isFocused) {
            setLocalPrompt(prompt);
        }
    }, [prompt, isFocused]);

    const handleChange = (newValue: string) => {
        setLocalPrompt(newValue);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            onChange(newValue);
        }, 1000); // 1 second debounce
    };

    const insertVariable = (variable: string) => {
        const toInsert = `{{${variable}}}`;
        const newValue = localPrompt + (localPrompt.slice(-1) === " " ? "" : " ") + toInsert;
        handleChange(newValue);
    };

    return (
        <div className="flex flex-col border border-gray-200 dark:border-blue-500/30 rounded-xl bg-white dark:bg-blue-500/10 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Prompt del Agente</h3>
                </div>
            </div>

            <div className="flex flex-col p-4 gap-4">
                <Textarea
                    value={localPrompt}
                    onChange={(e) => handleChange(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Escribe las instrucciones para el agente aquí. Usa las variables de abajo para personalizar el mensaje..."
                    rows={10}
                    className="resize-none border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 text-base leading-relaxed p-4 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />

                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Variables Disponibles</p>
                    <div className="flex flex-wrap gap-2">
                        {columns.map(col => (
                            <button
                                key={col.id}
                                onClick={() => insertVariable(col.key)}
                                className={cn("inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border",
                                    variableClass || "bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/30 border-blue-100 dark:border-blue-500/30"
                                )}
                            >
                                <Copy className="mr-1.5 h-3 w-3 opacity-50" />
                                {col.label} <span className="ml-1 opacity-75 font-mono">{'{{' + col.key + '}}'}</span>
                            </button>
                        ))}
                        {columns.length === 0 && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 italic">Añade columnas en la tabla para ver variables aquí.</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
