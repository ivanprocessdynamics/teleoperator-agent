"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CampaignRow, CallingConfig } from "@/types/campaign";

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
    campaignPrompt
}: UseCampaignExecutorProps) {
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
    const callQueueRef = useRef<string[]>([]); // IDs of pending rows
    const activeCallsRef = useRef<Set<string>>(new Set());
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

            // Update counts
            const completed = data.filter(r => r.status === 'completed').length;
            const failed = data.filter(r => ['failed', 'no_answer'].includes(r.status)).length;
            const pending = data.filter(r => r.status === 'pending').length;
            const calling = data.filter(r => r.status === 'calling').length;

            setState(prev => ({
                ...prev,
                totalRows: data.length,
                completedCount: completed,
                failedCount: failed,
                pendingCount: pending,
                activeCalls: calling,
            }));

            // If a call just finished and we're running, process next
            if (isRunningRef.current && !isPausedRef.current) {
                processNextCalls(data);
            }
        });

        return () => unsub();
    }, [campaignId]);

    const processNextCalls = useCallback((currentRows: CampaignRow[]) => {
        // Filter pending rows that HAVE a valid phone number
        const pendingRows = currentRows.filter(r => {
            if (r.status !== 'pending') return false;
            const phone = r.data[phoneColumnId]?.trim();
            // Must have phone and it should look like a valid number
            return phone && phone.length >= 7;
        });

        const callingCount = currentRows.filter(r => r.status === 'calling').length;
        const availableSlots = callingConfig.concurrency_limit - callingCount;

        if (availableSlots <= 0 || pendingRows.length === 0) return;

        // Take next rows up to available slots
        const nextBatch = pendingRows.slice(0, availableSlots);

        nextBatch.forEach(row => {
            initiateCall(row);
        });
    }, [callingConfig.concurrency_limit, phoneColumnId]);

    const initiateCall = useCallback(async (row: CampaignRow) => {
        const phoneNumber = row.data[phoneColumnId];

        if (!phoneNumber) {
            // Mark as failed - no phone number
            await updateDoc(doc(db, "campaign_rows", row.id), {
                status: 'failed',
                last_error: 'No phone number provided'
            });
            return;
        }

        // Normalize phone number (remove spaces, ensure E.164)
        const normalizedPhone = phoneNumber.replace(/\s+/g, '');

        try {
            // Mark as calling immediately (optimistic)
            await updateDoc(doc(db, "campaign_rows", row.id), {
                status: 'calling',
                called_at: Timestamp.now(),
            });

            // Build dynamic variables from row data
            const dynamicVariables: Record<string, string> = {};
            Object.entries(row.data).forEach(([key, value]) => {
                // Use column ID as variable name
                dynamicVariables[key] = value;
            });

            const response = await fetch('/api/retell/create-phone-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_number: callingConfig.from_number,
                    to_number: normalizedPhone,
                    agent_id: agentId,
                    dynamic_variables: {
                        ...dynamicVariables,
                        campaign_prompt: campaignPrompt  // Pass the prompt to the agent
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

            // Store call_id on the row
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
    }, [campaignId, agentId, callingConfig.from_number, phoneColumnId]);

    const start = useCallback(() => {
        isRunningRef.current = true;
        isPausedRef.current = false;
        setState(prev => ({ ...prev, isRunning: true, isPaused: false }));
        processNextCalls(rows);
    }, [rows, processNextCalls]);

    const pause = useCallback(() => {
        isPausedRef.current = true;
        setState(prev => ({ ...prev, isPaused: true }));
    }, []);

    const resume = useCallback(() => {
        isPausedRef.current = false;
        setState(prev => ({ ...prev, isPaused: false }));
        processNextCalls(rows);
    }, [rows, processNextCalls]);

    const stop = useCallback(() => {
        isRunningRef.current = false;
        isPausedRef.current = false;
        setState(prev => ({ ...prev, isRunning: false, isPaused: false }));
        // Note: Active calls will continue until they end naturally
    }, []);

    // Reset rows for relaunch
    const resetRows = useCallback(async (startFromIndex: number = 0) => {
        const sortedRows = [...rows].sort((a, b) => a.id.localeCompare(b.id));
        const rowsToReset = sortedRows.slice(startFromIndex);

        // Reset each row to pending
        for (const row of rowsToReset) {
            // Only reset rows that have phone numbers
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

    // Check if campaign was previously run
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
