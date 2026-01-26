"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Check, Undo2, Redo2, MessageSquare, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface PromptEditorProps {
    initialPrompt: string;
    onSave: (prompt: string) => Promise<void>;
    onChange?: (prompt: string) => void;
    isSaving: boolean;
    headerTitle?: string;
    headerDescription?: string;
    variables?: string[];
    canSave?: boolean;
}

export function PromptEditor({
    initialPrompt,
    onSave,
    onChange,
    isSaving,
    headerTitle = "Prompt del Agente",
    headerDescription = "Escribe las instrucciones para la IA. Usa las variables para personalizar.",
    variables = [],
    canSave = true
}: PromptEditorProps) {
    // Local state
    const [localPrompt, setLocalPrompt] = useState(initialPrompt);
    const [isFocused, setIsFocused] = useState(false);

    // History State
    const [history, setHistory] = useState<string[]>([initialPrompt]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);

    // Refs
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lastSaveRef = useRef<string>(initialPrompt);
    const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Sync from props only if not focused (avoid overwriting user input)
    useEffect(() => {
        if (!isFocused && initialPrompt !== localPrompt && initialPrompt !== lastSaveRef.current) {
            setLocalPrompt(initialPrompt);
            setHistory([initialPrompt]);
            setHistoryIndex(0);
            setHasUnsyncedChanges(false);
            lastSaveRef.current = initialPrompt;
        }
    }, [initialPrompt, isFocused, localPrompt]); // added localPrompt to dep array for correctness if used inside? No, probably safer to exclude but linter complains.

    const markAsUnsynced = () => {
        setHasUnsyncedChanges(true);
    };

    // History Logic
    const pushToHistory = (val: string) => {
        const currentHist = history.slice(0, historyIndex + 1);
        if (currentHist[currentHist.length - 1] !== val) {
            const newHist = [...currentHist, val];
            setHistory(newHist);
            setHistoryIndex(newHist.length - 1);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setLocalPrompt(val);
        markAsUnsynced();

        // Snapshot History (Debounced 800ms)
        if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
        historyTimeoutRef.current = setTimeout(() => {
            pushToHistory(val);
        }, 800);

        // Auto-Save (Debounced 1000ms)
        if (onChange) {
            if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
            autoSaveTimeoutRef.current = setTimeout(() => {
                onChange(val);
            }, 1000);
        }
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const newVal = history[newIndex];
            setHistoryIndex(newIndex);
            setLocalPrompt(newVal);
            markAsUnsynced();
            if (onChange) onChange(newVal);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            const newVal = history[newIndex];
            setHistoryIndex(newIndex);
            setLocalPrompt(newVal);
            markAsUnsynced();
            if (onChange) onChange(newVal);
        }
    };

    const handleSaveClick = async () => {
        await onSave(localPrompt);
        setHasUnsyncedChanges(false);
        lastSaveRef.current = localPrompt;
    };

    const insertVariable = (variable: string) => {
        const textarea = textareaRef.current;
        let newValue = localPrompt;

        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const textBefore = localPrompt.substring(0, start);
            const textAfter = localPrompt.substring(end);

            const prefix = (start > 0 && textBefore[start - 1] !== ' ' && textBefore[start - 1] !== '\n') ? ' ' : '';
            const suffix = (textAfter.length > 0 && textAfter[0] !== ' ' && textAfter[0] !== '\n' && textAfter[0] !== '.' && textAfter[0] !== ',') ? ' ' : '';

            newValue = textBefore + prefix + `{{${variable}}}` + suffix + textAfter;
            pushToHistory(newValue);
        } else {
            newValue = localPrompt + (localPrompt.slice(-1) === " " ? "" : " ") + `{{${variable}}}`;
            pushToHistory(newValue);
        }

        setLocalPrompt(newValue);
        markAsUnsynced();
        if (onChange) onChange(newValue);
    };

    return (
        <div className="flex flex-col border border-gray-200 dark:border-blue-500/30 rounded-xl bg-white dark:bg-blue-500/10 shadow-sm overflow-hidden h-auto min-h-[600px]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{headerTitle}</h3>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Info className="h-3 w-3 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>{headerDescription}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-gray-200 dark:hover:bg-gray-700"
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        title="Deshacer (Ctrl+Z)"
                    >
                        <Undo2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-gray-200 dark:hover:bg-gray-700"
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        title="Rehacer (Ctrl+Shift+Z)"
                    >
                        <Redo2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    </Button>
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-2" />

                    {canSave && (
                        <Button
                            size="sm"
                            onClick={handleSaveClick}
                            disabled={isSaving || !hasUnsyncedChanges}
                            className={cn(
                                "h-8 text-xs font-medium transition-all shadow-sm",
                                isSaving
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                                    : !hasUnsyncedChanges
                                        ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                                        : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                            )}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                    Guardando...
                                </>
                            ) : !hasUnsyncedChanges ? (
                                <>
                                    <Check className="mr-1.5 h-3 w-3" />
                                    Guardado
                                </>
                            ) : (
                                <>
                                    <Save className="mr-1.5 h-3 w-3" />
                                    {/* Generic text, can be customized or prop based if needed */}
                                    Guardar y Actualizar
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Editor */}
            <div className="flex flex-col flex-1 p-0 overflow-hidden relative min-h-[500px]">
                <Textarea
                    ref={textareaRef}
                    value={localPrompt}
                    onChange={handleChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Escribe las instrucciones para el agente aquí..."
                    className="flex-1 w-full resize-none border-0 rounded-none focus-visible:ring-0 p-4 text-base leading-relaxed placeholder:text-gray-400 bg-transparent font-mono"
                />
            </div>

            {/* Variable Helper Bar */}
            {variables.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 p-2">
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs font-semibold text-gray-500 uppercase px-2">Variables:</span>
                        {variables.map(v => (
                            <button
                                key={v}
                                onClick={() => insertVariable(v)}
                                className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                                {`{{${v}}}`}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
