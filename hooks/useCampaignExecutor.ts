"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CampaignRow, CallingConfig, CampaignColumn } from "@/types/campaign";

interface ExecutorState {
    isRunning: boolean;
    isPaused: boolean;
    activeCalls: number;
    totalRows: number;
    completedCount: number;
    failedCount: number;
    pendingCount: number;
}

interface UseCampaignExecutorProps {
    campaignId: string;
    agentId: string;
    callingConfig: CallingConfig;
    phoneColumnId: string;
    campaignPrompt: string;  // The prompt template for the agent
}

export function useCampaignExecutor({
    campaignId,
    agentId,
    callingConfig,
    phoneColumnId,
    campaignPrompt,
    columns
}: UseCampaignExecutorProps & { columns: CampaignColumn[] }) {
    const [state, setState] = useState<ExecutorState>({
        isRunning: false,
        isPaused: false,
        activeCalls: 0,
        totalRows: 0,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 0,
    });

    const [rows, setRows] = useState<CampaignRow[]>([]);
    const isRunningRef = useRef(false);
    const isPausedRef = useRef(false);

    // Listen to campaign rows in real-time
    useEffect(() => {
        if (!campaignId) return;

        const q = query(
            collection(db, "campaign_rows"),
            where("campaign_id", "==", campaignId)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CampaignRow));
            setRows(data);
        });

        return () => unsub();
    }, [campaignId]);

    // Derived state and stats calculation
    useEffect(() => {
        // Only count rows with valid phone numbers
        const rowsWithPhones = rows.filter(r => {
            const phone = r.data[phoneColumnId]?.trim();
            return phone && phone.length >= 7;
        });

        const completed = rowsWithPhones.filter(r => r.status === 'completed').length;
        const failed = rowsWithPhones.filter(r => ['failed', 'no_answer'].includes(r.status)).length;
        const pending = rowsWithPhones.filter(r => r.status === 'pending').length;
        const calling = rowsWithPhones.filter(r => r.status === 'calling').length;

        setState(prev => ({
            ...prev,
            totalRows: rowsWithPhones.length,
            completedCount: completed,
            failedCount: failed,
            pendingCount: pending,
            activeCalls: calling,
        }));

        // Check for completion
        if (isRunningRef.current && !isPausedRef.current) {
            if (pending === 0 && calling === 0 && rowsWithPhones.length > 0) {
                console.log("Campaign complete - all calls finished");
                isRunningRef.current = false;
                setState(prev => ({ ...prev, isRunning: false }));
            }
        }
    }, [rows, phoneColumnId]);

    // Orchestration Effect: Trigger calls when state allows
    useEffect(() => {
        if (state.isRunning && !state.isPaused) {
            processNextCalls();
        }
    }, [state.isRunning, state.isPaused, rows, callingConfig.concurrency_limit]); // Re-run when rows update

    const processNextCalls = useCallback(() => {
        if (!isRunningRef.current || isPausedRef.current) return;



        // Filter pending rows that HAVE a valid phone number
        const pendingRows = rows.filter(r => {
            if (r.status !== 'pending') return false;
            const phone = r.data[phoneColumnId]?.trim();
            const isValid = phone && phone.length >= 7;
            if (!isValid && r.status === 'pending') {
                // Warn about pending rows with invalid phones?
                // console.log("Skipping row due to invalid phone:", r.id, phone);
            }
            return isValid;
        });

        const callingCount = rows.filter(r => r.status === 'calling').length;
        const availableSlots = callingConfig.concurrency_limit - callingCount;



        if (availableSlots <= 0 || pendingRows.length === 0) return;

        // Take next rows up to available slots
        const nextBatch = pendingRows.slice(0, availableSlots);



        nextBatch.forEach(row => {
            initiateCall(row);
        });
    }, [rows, callingConfig.concurrency_limit, phoneColumnId]);

    const initiateCall = useCallback(async (row: CampaignRow) => {
        const phoneNumber = row.data[phoneColumnId];
        console.log(`[Executor] Initiating call for row ${row.id}. PhoneCol: ${phoneColumnId}, Val: ${phoneNumber}`);

        if (!phoneNumber) {
            await updateDoc(doc(db, "campaign_rows", row.id), {
                status: 'failed',
                last_error: 'No phone number provided'
            });
            return;
        }

        const normalizedPhone = phoneNumber.replace(/\s+/g, '');

        try {
            await updateDoc(doc(db, "campaign_rows", row.id), {
                status: 'calling',
                called_at: Timestamp.now(),
            });

            // Map IDs to Names for dynamic variables
            const dynamicVariables: Record<string, string> = {};
            Object.entries(row.data).forEach(([key, value]) => {
                // If we have column definitions, use the Name, otherwise ID
                const colDef = columns?.find(c => c.id === key);
                // Use the column KEY (sanitized name) for the variable name
                const varName = colDef ? colDef.key : key;
                dynamicVariables[varName] = value;
            });

            // Hydrate the prompt with variables (Client-side interpolation)
            let hydratedPrompt = campaignPrompt;

            // Build normalized lookup map for case-insensitive matching
            const varLookup: Record<string, string> = {};
            Object.entries(dynamicVariables).forEach(([key, value]) => {
                varLookup[key.trim().toLowerCase()] = String(value || '');
            });

            // Replace all {{ key }} occurrences using regex that captures the key
            // Supports: {{name}}, {{ Name }}, {{ NOMBRE }}
            hydratedPrompt = hydratedPrompt.replace(/\{\{\s*([a-zA-Z0-9_À-ÿ\s]+?)\s*\}\}/g, (match, capturedKey) => {
                const searchKey = capturedKey.trim().toLowerCase();
                const replacement = varLookup[searchKey];
                return replacement !== undefined ? replacement : match;
            });

            console.log("[Hydration] Final Prompt:", hydratedPrompt);

            const response = await fetch('/api/retell/create-phone-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_number: callingConfig.from_number,
                    to_number: normalizedPhone,
                    agent_id: agentId,
                    dynamic_variables: {
                        ...dynamicVariables,
                        campaign_prompt: hydratedPrompt // Send the fully substituted prompt
                    },
                    metadata: {
                        campaign_id: campaignId,
                        row_id: row.id,
                    }
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'API Error');
            }

            const result = await response.json();

            await updateDoc(doc(db, "campaign_rows", row.id), {
                call_id: result.call_id,
            });

        } catch (error: any) {
            console.error("Error initiating call for row:", row.id, error);
            await updateDoc(doc(db, "campaign_rows", row.id), {
                status: 'failed',
                last_error: error.message || 'Unknown error',
            });
        }
    }, [campaignId, agentId, callingConfig.from_number, phoneColumnId, columns, campaignPrompt]);

    const start = useCallback(() => {
        isRunningRef.current = true;
        isPausedRef.current = false;
        setState(prev => ({ ...prev, isRunning: true, isPaused: false }));
        // Effect will pick up processing
    }, []);

    const pause = useCallback(() => {
        isPausedRef.current = true;
        setState(prev => ({ ...prev, isPaused: true }));
    }, []);

    const resume = useCallback(() => {
        isPausedRef.current = false;
        setState(prev => ({ ...prev, isPaused: false }));
    }, []);

    const stop = useCallback(() => {
        isRunningRef.current = false;
        isPausedRef.current = false;
        setState(prev => ({ ...prev, isRunning: false, isPaused: false }));
    }, []);

    const resetRows = useCallback(async (startFromIndex: number = 0) => {
        const sortedRows = [...rows].sort((a, b) => a.id.localeCompare(b.id));
        const rowsToReset = sortedRows.slice(startFromIndex);

        for (const row of rowsToReset) {
            const phone = row.data[phoneColumnId]?.trim();
            if (phone && phone.length >= 7) {
                await updateDoc(doc(db, "campaign_rows", row.id), {
                    status: 'pending',
                    call_id: null,
                    last_error: null,
                    called_at: null
                });
            }
        }
    }, [rows, phoneColumnId]);

    const hasBeenRun = rows.some(r => ['completed', 'failed', 'no_answer'].includes(r.status));

    return {
        state,
        start,
        pause,
        resume,
        stop,
        rows,
        resetRows,
        hasBeenRun,
    };
}
