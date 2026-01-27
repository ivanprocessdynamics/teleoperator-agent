"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CampaignColumn } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Copy, Undo2, Redo2, Save, Check, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CampaignPromptProps {
    prompt: string;
    columns: CampaignColumn[];
    onChange: (newPrompt: string) => void;
    onImmediateChange?: (newPrompt: string) => void;
    onSyncAgent: (newPrompt: string) => Promise<void>;
    variableClass?: string;
}

export function CampaignPrompt({ prompt, columns, onChange, onImmediateChange, onSyncAgent, variableClass }: CampaignPromptProps) {
    const [localPrompt, setLocalPrompt] = useState(prompt);
    const [isFocused, setIsFocused] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);

    // Undo/Redo History
    // We store the history as an array of strings
    const [history, setHistory] = useState<string[]>([prompt]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSaveRef = useRef<string>(prompt);

    // Sync from props only if not focused (avoid overwriting user input)
    // But also need to respect if props changed significantly from outside
    useEffect(() => {
        if (!isFocused && prompt !== localPrompt && prompt !== lastSaveRef.current) {
            setLocalPrompt(prompt);
            onImmediateChange?.(prompt); // Sync up
            setHistory([prompt]);
            setHistoryIndex(0);
            setHasUnsyncedChanges(false);
        }
    }, [prompt, isFocused]); // removed localPrompt to avoid loops, added logic check

    // Add to history with debounce to avoid saving every char
    const addToHistory = useCallback((newText: string) => {
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            // Only add if different from last entry
            if (newHistory[newHistory.length - 1] !== newText) {
                return [...newHistory, newText];
            }
            return prev;
        });
        setHistoryIndex(prev => {
            // If we added a new item (logic above implied), we increment.
            // Since we can't easily check the result of setHistory inside setHistoryIndex without complex logic,
            // we'll simplify: just increment if texts differ:
            return prev + 1; // This logic is slightly flawed in async React state.
            // Better approach below in handleChange
        });
    }, [historyIndex]);

    const markAsUnsynced = () => {
        setHasUnsyncedChanges(true);
    };

    const handleChange = (newValue: string) => {
        setLocalPrompt(newValue);
        onImmediateChange?.(newValue);
        markAsUnsynced();

        // Firestore Auto-Save Debounce
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            onChange(newValue);
            lastSaveRef.current = newValue; // Mark as saved by us
        }, 1000);
    };

    // Snapshot history on pause (e.g. 500ms after typing stops) or space?
    // The user hated "letter by letter". Let's throttle history updates.
    const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setLocalPrompt(val);
        onImmediateChange?.(val);

        // Auto-save logic
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            onChange(val);
            lastSaveRef.current = val;
        }, 1000);

        // History Logic: Debounce the history snapshot
        // If user types "Hello", we don't save H, He, Hel...
        // We save "Hello" after they stop typing for 500ms.
        if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
        historyTimeoutRef.current = setTimeout(() => {
            setHistory(prev => {
                const current = prev.slice(0, historyIndex + 1);
                if (current[current.length - 1] !== val) {
                    return [...current, val];
                }
                return prev;
            });
            setHistoryIndex(prev => {
                // We need to calculate the new index based on the *result* of setHistory
                // But since we can't know if setHistory actually added one without checking,
                // we'll rely on the useEffect below or just simple logic:
                return prev + 1; // This might drift if setHistory didn't add.
                // Let's use a safer approach: direct state update
            });
            // Correction: Implementing safe atomic update
        }, 800);
    };

    // Safe history update
    const pushToHistory = (val: string) => {
        const currentHist = history.slice(0, historyIndex + 1);
        if (currentHist[currentHist.length - 1] !== val) {
            const newHist = [...currentHist, val];
            setHistory(newHist);
            setHistoryIndex(newHist.length - 1);
        }
    };

    // Override handleTextareaChange to use pushToHistory in debounce
    const safeHandleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setLocalPrompt(val);
        onImmediateChange?.(val);
        markAsUnsynced();

        // Firestore Save
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            onChange(val);
            lastSaveRef.current = val;
        }, 1000);

        // History Snapshot
        if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
        historyTimeoutRef.current = setTimeout(() => {
            pushToHistory(val);
        }, 800);
    };


    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const newVal = history[newIndex];
            setHistoryIndex(newIndex);
            setLocalPrompt(newVal);
            onImmediateChange?.(newVal);
            onChange(newVal); // update firestore immediately on undo
            lastSaveRef.current = newVal;
            markAsUnsynced();
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            const newVal = history[newIndex];
            setHistoryIndex(newIndex);
            setLocalPrompt(newVal);
            onImmediateChange?.(newVal);
            onChange(newVal);
            lastSaveRef.current = newVal;
            markAsUnsynced();
        }
    };

    const insertVariable = (variable: string) => {
        const textarea = textareaRef.current;

        let newValue = localPrompt;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const textBefore = localPrompt.substring(0, start);
            const textAfter = localPrompt.substring(end);

            // Add space if needed
            const prefix = (start > 0 && textBefore[start - 1] !== ' ' && textBefore[start - 1] !== '\n') ? ' ' : '';
            const suffix = (textAfter.length > 0 && textAfter[0] !== ' ' && textAfter[0] !== '\n' && textAfter[0] !== '.' && textAfter[0] !== ',') ? ' ' : '';

            newValue = textBefore + prefix + `{{${variable}}}` + suffix + textAfter;

            // Push to history immediately for variables
            pushToHistory(newValue);
        } else {
            // Fallback if ref missing
            newValue = localPrompt + (localPrompt.slice(-1) === " " ? "" : " ") + `{{${variable}}}`;
            pushToHistory(newValue);
        }

        setLocalPrompt(newValue);
        onImmediateChange?.(newValue);
        onChange(newValue);
        markAsUnsynced();
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await onSyncAgent(localPrompt);
            setLastSynced(new Date());
            setHasUnsyncedChanges(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="flex flex-col border border-gray-200 dark:border-blue-500/30 rounded-xl bg-white dark:bg-blue-500/10 shadow-sm overflow-hidden h-auto min-h-[600px]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Prompt del Agente</h3>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Info className="h-3 w-3 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>Escribe las instrucciones para la IA. Usa las variables para personalizar. Guarda para actualizar el agente activo.</p>
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

                    <Button
                        size="sm"
                        onClick={handleSync}
                        disabled={isSyncing || !hasUnsyncedChanges}
                        className={cn(
                            "h-8 text-xs font-medium transition-all shadow-sm",
                            isSyncing
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                                : !hasUnsyncedChanges
                                    ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                                    : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                        )}
                    >
                        {isSyncing ? (
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
                                Guardar y Actualizar
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="flex flex-col flex-1 p-0 overflow-hidden relative min-h-[500px]">
                <Textarea
                    ref={textareaRef}
                    value={localPrompt}
                    onChange={safeHandleChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Escribe las instrucciones para el agente aquí. Usa las variables de abajo para personalizar el mensaje..."
                    className="flex-1 w-full resize-none border-0 rounded-none focus-visible:ring-0 p-4 text-base leading-relaxed placeholder:text-gray-400 bg-transparent font-mono"
                />

                {/* Last Save Indicator */}
                <div className="absolute top-2 right-4 pointer-events-none">
                    {lastSynced ? (
                        <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full flex items-center shadow-sm border border-green-100 dark:border-green-800/50 opacity-0 animate-in fade-in duration-1000 fill-mode-forwards">
                            <Check className="h-2.5 w-2.5 mr-1" />
                            Sincronizado {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    ) : null}
                </div>

                <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Variables Disponibles</p>
                    <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto pr-2 custom-scrollbar">
                        {columns.map(col => (
                            <button
                                key={col.id}
                                onClick={() => insertVariable(col.key)}
                                className={cn("inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border shadow-sm active:scale-95 group",
                                    variableClass || "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400"
                                )}
                            >
                                <Copy className="mr-1.5 h-3 w-3 opacity-50 group-hover:opacity-100" />
                                {col.label} <span className="ml-1 opacity-50 font-mono group-hover:opacity-75">{'{{' + col.key + '}}'}</span>
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
