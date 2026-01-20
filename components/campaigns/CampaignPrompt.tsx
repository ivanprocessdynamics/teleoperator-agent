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
}

export function CampaignPrompt({ prompt, columns, onChange }: CampaignPromptProps) {

    const insertVariable = (variable: string) => {
        // Simple append for now, ideally insertion at cursor
        const toInsert = `{{${variable}}}`;
        onChange(prompt + (prompt.slice(-1) === " " ? "" : " ") + toInsert);
    };

    return (
        <div className="flex flex-col h-full border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Prompt del Agente</h3>
                </div>
            </div>

            <div className="flex-1 flex flex-col p-4 gap-4">
                <Textarea
                    value={prompt}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Escribe las instrucciones para el agente aquí. Usa las variables de la derecha para personalizar el mensaje..."
                    className="flex-1 resize-none border-gray-200 focus:border-gray-900 focus:ring-0 text-base leading-relaxed p-4"
                />

                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Variables Disponibles</p>
                    <div className="flex flex-wrap gap-2">
                        {columns.map(col => (
                            <button
                                key={col.id}
                                onClick={() => insertVariable(col.key)}
                                className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-100"
                            >
                                <Copy className="mr-1.5 h-3 w-3 opacity-50" />
                                {col.label} <span className="ml-1 opacity-75 font-mono">{'{{' + col.key + '}}'}</span>
                            </button>
                        ))}
                        {columns.length === 0 && (
                            <span className="text-xs text-gray-400 italic">Añade columnas en la tabla para ver variables aquí.</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
