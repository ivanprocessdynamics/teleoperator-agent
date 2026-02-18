import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { adminDb } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";
import { doc, setDoc, serverTimestamp, getDoc, query, collection, where, getDocs, updateDoc, Timestamp } from "firebase/firestore";
import crypto from 'crypto';
import OpenAI from "openai";
import { executeToolCall } from "@/lib/tools-execution";

// Helper to normalize roles to 'user' | 'agent'
function normalizeRole(role: string): "user" | "agent" {
    if (role === "user" || role === "human") return "user";
    // Default to agent for 'assistant', 'agent', 'model', etc.
    return "agent";
}

// Helper to parse plain text transcript if object is missing
function parseTranscript(transcriptText: string) {
    if (!transcriptText) return [];

    // Simple parser for "Agent: ... User: ..." format
    const lines = transcriptText.split('\n');
    const messages = [];

    for (const line of lines) {
        if (line.startsWith('Agent: ')) {
            messages.push({ role: 'agent', content: line.replace('Agent: ', '').trim() });
        } else if (line.startsWith('User: ')) {
            messages.push({ role: 'user', content: line.replace('User: ', '').trim() });
        }
    }
    return messages;
}

// Helper to normalize transcript object from Retell
function normalizeTranscript(transcript: any[]) {
    if (!Array.isArray(transcript)) return []
    return transcript.map(t => ({
        role: normalizeRole(t.role),
        content: t.content || t.message || ""
    }));
}

// Helper to update campaign row status
// Shared status determination logic
function determineFinalStatus(data: any, callId: string): 'completed' | 'failed' | 'no_answer' {
    const disconnectionReason = data.disconnection_reason;
    const failedReasons = ['dial_failed', 'dial_busy', 'error_unknown', 'error_retell', 'scam_detected', 'error_llm_websocket_open', 'error_llm_websocket_lost_connection'];
    const noAnswerReasons = ['dial_no_answer', 'voicemail_reached', 'user_not_joined', 'registered_call_timeout'];

    if (disconnectionReason && failedReasons.includes(disconnectionReason)) {
        // HEURISTIC: If call lasted > 10 seconds, it's likely NOT a complete failure
        if (data.duration_ms && data.duration_ms > 10000) {
            console.log(`[Campaign Row] Call ${callId} has failure reason '${disconnectionReason}' but duration ${data.duration_ms}ms > 10s. Marking as COMPLETED.`);
            return 'completed';
        }
        return 'failed';
    } else if (disconnectionReason && noAnswerReasons.includes(disconnectionReason)) {
        return 'no_answer';
    }
    return 'completed';
}

// Helper to update campaign row status
async function updateCampaignRowStatus(callId: string, data: any, eventType: 'started' | 'ended') {
    const result = { success: false, method: 'none', error: null as any };
    try {
        console.log(`[Campaign Row] Updating status for call ${callId} (${eventType})`);
        if (eventType === 'ended') {
            console.log(`[Campaign Row] ENDED Event Data for ${callId}:`, JSON.stringify({
                reason: data.disconnection_reason,
                duration: data.duration_ms,
                start: data.start_timestamp,
                end: data.end_timestamp
            }));
        }

        const rowId = data.metadata?.row_id;

        // 1. Try with Admin SDK (Preferred for permissions)
        if (adminDb) {
            console.log("[Campaign Row] Using Admin SDK");
            try {
                let rowDoc = null;

                if (rowId) {
                    console.log(`[Campaign Row] Using direct row_id from metadata: ${rowId}`);
                    const directDoc = await adminDb.collection("campaign_rows").doc(rowId).get();
                    if (directDoc.exists) {
                        rowDoc = directDoc;
                    } else {
                        console.warn(`[Campaign Row] Row ${rowId} not found by ID (Admin). Falling back to query.`);
                    }
                }

                if (!rowDoc) {
                    const rowsSnapshot = await adminDb.collection("campaign_rows").where("call_id", "==", callId).get();
                    if (!rowsSnapshot.empty) {
                        rowDoc = rowsSnapshot.docs[0];
                    }
                }

                if (rowDoc) {
                    console.log(`[Campaign Row] Found row ${rowDoc.id} (Admin)`);

                    if (eventType === 'started') {
                        await rowDoc.ref.update({
                            status: 'calling',
                            called_at: new Date(),
                        });
                    } else if (eventType === 'ended') {
                        const finalStatus = determineFinalStatus(data, callId);
                        await rowDoc.ref.update({
                            status: finalStatus,
                            last_error: finalStatus === 'failed' ? data.disconnection_reason : null,
                        });
                    }
                    console.log(`[Campaign Row] Updated successfully (Admin)`);
                    result.success = true;
                    result.method = 'admin-sdk';
                    return result;
                } else {
                    result.error = 'row-not-found-admin';
                }
            } catch (adminErr: any) {
                console.error("[Campaign Row] Admin SDK error:", adminErr);
                result.error = `admin-error: ${adminErr.message}`;
                // Fallthrough to client SDK
            }
        }

        // 2. Fallback to Client SDK (Local dev / Admin SDK not initialized)
        console.log("[Campaign Row] Falling back to Client SDK");
        try {
            let rowDoc = null;

            if (rowId) {
                console.log(`[Campaign Row] Using direct row_id from metadata: ${rowId} (Client)`);
                const directDoc = await getDoc(doc(db, "campaign_rows", rowId));
                if (directDoc.exists()) {
                    rowDoc = directDoc;
                }
            }

            if (!rowDoc) {
                const q = query(collection(db, "campaign_rows"), where("call_id", "==", callId));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    rowDoc = snapshot.docs[0];
                }
            }

            if (rowDoc) {
                console.log(`[Campaign Row] Found row ${rowDoc.id} (Client SDK)`);

                if (eventType === 'started') {
                    await updateDoc(doc(db, "campaign_rows", rowDoc.id), {
                        status: 'calling',
                        called_at: Timestamp.now(),
                    });
                } else if (eventType === 'ended') {
                    const finalStatus = determineFinalStatus(data, callId);
                    await updateDoc(doc(db, "campaign_rows", rowDoc.id), {
                        status: finalStatus,
                        last_error: finalStatus === 'failed' ? data.disconnection_reason : null,
                    });
                }
                console.log(`[Campaign Row] Updated successfully (Client SDK)`);
                result.success = true;
                result.method = 'client-sdk';
            } else {
                console.log(`[Campaign Row] No row found for call_id ${callId}`);
                if (!result.error) result.error = 'row-not-found-client';
            }
        } catch (clientErr: any) {
            console.error(`[Campaign Row] Client SDK error for call ${callId}:`, clientErr);
            result.error = `client-error: ${clientErr.message}`;
        }
    } catch (error) {
        console.error("Error in updateCampaignRowStatus:", error);
    }
    return result;
}


export async function POST(req: Request) {
    try {
        const bodyText = await req.text();
        // 1. Validate Signature (Optional but recommended)
        const signature = req.headers.get("x-retell-signature");
        if (process.env.RETELL_WEBHOOK_SECRET && signature) {
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RETELL_WEBHOOK_SECRET)
                .update(bodyText)
                .digest('hex');

            if (signature !== expectedSignature) {
                console.error("Invalid Retell signature");
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const body = JSON.parse(bodyText);
        const { event, call_id, call } = body;
        const callId = call_id || call?.call_id;

        if (!callId) {
            return NextResponse.json({ error: "No call_id provided" }, { status: 400 });
        }

        console.log(`Webhook Event: ${event} | Call ID: ${callId} | Body Size: ${bodyText.length}`);

        // Extract Call Data (normalized)
        const callData = call || body; // 'call_ended' puts data in 'call', 'call.analyzed' might be at root or 'call'

        // 2. Event Routing
        let rowUpdateResult = null;

        if (event === "call_ended") {
            // Priority: Save Transcript IMMEDIATELY
            console.log(`[Webhook] Processing call_ended for ${callId}...`);
            await handleCallEnded(callId, callData);

            // Update Campaign Row Status (if this call was part of a campaign)
            rowUpdateResult = await updateCampaignRowStatus(callId, callData, 'ended');
            console.log(`[Webhook] call_ended processing complete for ${callId}`);
        }
        else if (event === "call.analyzed" || event === "call_analyzed") {
            // Secondary: enrich with Analysis later
            console.log(`[Webhook] Processing call_analyzed for ${callId}...`);
            await handleCallAnalyzed(callId, callData);
            console.log(`[Webhook] call_analyzed processing complete for ${callId}`);
        }
        else if (event === "call_started") {
            console.log(`[Webhook] Call started event received for ${callId}`);
            // Update Campaign Row Status to 'calling'
            rowUpdateResult = await updateCampaignRowStatus(callId, callData, 'started');
        }
        // HANDLER FOR TOOL CALLS (Server-Side Function Calling)
        else if (body.interaction_type === "tool_call" || event === "tool_call_invocation") {
            console.log(`[Webhook] Tool Call detected for ${callId}`);
            const toolCall = body.tool_call || body; // Retell structure varies slightly by version
            // Extract from_number from call data (available for real inbound calls)
            const callerPhone = callData?.from_number || body.from_number || null;
            console.log(`[Webhook] Tool Call from_number: ${callerPhone}`);
            const response = await executeToolCall({
                agent_id: body.agent_id || callData?.agent_id,
                name: toolCall.name,
                args: toolCall.arguments || {}, // Usually parsed JSON object
                call_id: callId,
                from_number: callerPhone
            });
            // Return result to Retell immediately
            return NextResponse.json(response);
        }

        return NextResponse.json({ received: true, row_update: rowUpdateResult }, { status: 200 });

    } catch (error: any) {
        console.error("Webhook Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function handleCallEnded(callId: string, data: any) {
    // Determine transcript
    let transcriptNodes: any[] = [];

    // 1. Try Structured Transcript
    if (data.transcript_object && Array.isArray(data.transcript_object) && data.transcript_object.length > 0) {
        transcriptNodes = normalizeTranscript(data.transcript_object);
    }
    // 2. Try Tool Calls Transcript (New from Reference)
    else if (data.transcript_with_tool_calls && Array.isArray(data.transcript_with_tool_calls) && data.transcript_with_tool_calls.length > 0) {
        transcriptNodes = normalizeTranscript(data.transcript_with_tool_calls);
    }
    // 3. Fallback to Text Parsing
    else if (data.transcript) {
        transcriptNodes = parseTranscript(data.transcript);
    }

    // 4. Ultimate Fallback: Summary as Chat (New from Reference)
    if (transcriptNodes.length === 0) {
        const summary = data.call_analysis?.call_summary || data.summary || "Llamada finalizada (Sin transcripción disponible)";
        transcriptNodes = [{ role: 'agent', content: summary }];
    }

    console.log(`[call_ended] Processing ${transcriptNodes.length} transcript messages for ${callId}`);

    // Resolve subworkspace_id: from metadata first, then try to find by agent_id
    let resolvedSubworkspaceId = data.metadata?.subworkspace_id || null;

    try {
        if (!resolvedSubworkspaceId && data.agent_id) {
            // Try to find subworkspace by agent_id
            if (adminDb) {
                const snapshot = await adminDb.collection("subworkspaces").where("retell_agent_id", "==", data.agent_id).get();
                if (!snapshot.empty) {
                    resolvedSubworkspaceId = snapshot.docs[0].id;
                    console.log(`[call_ended] Resolved subworkspace_id from agent_id (Admin): ${resolvedSubworkspaceId}`);
                }
            } else {
                console.warn("[call_ended] Admin SDK not available for subworkspace resolution. Skipping Client SDK fallback to avoid permission errors.");
            }
        }
    } catch (resolutionError) {
        console.error("[call_ended] Error processing subworkspace resolution (skipping to save):", resolutionError);
    }

    // Prepare basic call record
    const docData: any = {
        id: callId,
        agent_id: data.agent_id,
        subworkspace_id: resolvedSubworkspaceId, // Critical for stats filtering
        transcript_object: transcriptNodes, // Structured chat
        recording_url: data.recording_url || null,
        caller_phone: data.from_number || null, // Caller's phone (inbound)
        duration: data.duration_ms ? data.duration_ms / 1000 :
            (data.end_timestamp - data.start_timestamp) / 1000,
        start_timestamp: data.start_timestamp,
        end_timestamp: data.end_timestamp,
        disconnection_reason: data.disconnection_reason,
        event_type: 'call_ended',
        metadata: data.metadata || null,
        timestamp: adminDb ? admin.firestore.FieldValue.serverTimestamp() : serverTimestamp(),
        updated_at: adminDb ? admin.firestore.FieldValue.serverTimestamp() : serverTimestamp(),
    };

    // Save to Firestore (prefer Admin SDK for server-side writes)
    if (adminDb) {
        await adminDb.collection('calls').doc(callId).set(docData, { merge: true });
    } else {
        // Fallback to Client SDK for local dev
        const docRef = doc(db, "calls", callId);
        await setDoc(docRef, docData, { merge: true });
    }
    console.log(`[call_ended] Saved for ${callId}`);
}

async function handleCallAnalyzed(callId: string, data: any) {
    let analysis = data.call_analysis || {};
    // Ensure custom_analysis_data is an array (Retell sometimes sends object or undefined)
    if (!analysis.custom_analysis_data || !Array.isArray(analysis.custom_analysis_data)) {
        analysis.custom_analysis_data = [];
    }

    // We update ONLY the analysis fields + transcript (if improved)
    // Sometimes call.analyzed has a better/final transcript

    let transcriptNodes = null;
    let transcriptText = "";

    if (data.transcript_object && Array.isArray(data.transcript_object)) {
        transcriptNodes = normalizeTranscript(data.transcript_object);
        transcriptText = transcriptNodes.map(t => `${t.role.toUpperCase()}: ${t.content}`).join('\n');
    } else if (data.transcript) {
        transcriptText = data.transcript;
    }

    // Track resolved subworkspace for saving to call document
    let resolvedSubworkspaceId: string | null = data.metadata?.subworkspace_id || null;

    let customFields: any[] = [];
    let configSource = 'none';
    let activeFields: any[] = [];

    // AI Extraction (Primary for Custom Fields)
    // Campaign-First approach: If call has campaign_id, use that Campaign's config.
    // Otherwise, fall back to Subworkspace config (for Testing Environment calls).
    if (data.agent_id) {
        console.log(`[AI Extraction] ========================================`);
        console.log(`[AI Extraction] CRITICAL CHECK: adminDb initialized = ${!!adminDb}`);
        console.log(`[AI Extraction] Starting extraction for agent_id: ${data.agent_id}`);
        console.log(`[AI Extraction] Campaign ID from metadata: ${data.metadata?.campaign_id || 'NONE'}`);
        console.log(`[AI Extraction] Subworkspace ID from metadata: ${data.metadata?.subworkspace_id || 'NONE'}`);
        console.log(`[AI Extraction] Full metadata: ${JSON.stringify(data.metadata)}`);
        console.log(`[AI Extraction] Transcript length: ${transcriptText?.length || 0} chars`);

        try {

            // 1. Check if this call is from a Campaign (via metadata)
            const campaignId = data.metadata?.campaign_id;

            // USE ADMIN SDK FOR READS with Client Fallback
            if (campaignId) {
                if (adminDb) {
                    console.log(`[AI Extraction] Call has campaign_id: ${campaignId}, fetching Campaign config (Admin)...`);
                    const campaignDoc = await adminDb.collection("campaigns").doc(campaignId).get();
                    if (campaignDoc.exists) {
                        const campaignData = campaignDoc.data();
                        customFields = campaignData?.analysis_config?.custom_fields || [];
                        configSource = `campaign:${campaignId}`;
                        console.log(`[AI Extraction] Loaded ${customFields.length} custom fields from Campaign (Admin).`);
                    } else {
                        console.log(`[AI Extraction] Campaign ${campaignId} not found (Admin).`);
                    }
                } else {
                    // Fallback to Client SDK
                    console.log(`[AI Extraction] Call has campaign_id: ${campaignId}, fetching Campaign config (Client)...`);
                    const campaignDoc = await getDoc(doc(db, "campaigns", campaignId));
                    if (campaignDoc.exists()) {
                        const campaignData = campaignDoc.data();
                        customFields = campaignData?.analysis_config?.custom_fields || [];
                        configSource = `campaign:${campaignId}`;
                        console.log(`[AI Extraction] Loaded ${customFields.length} custom fields from Campaign (Client).`);
                    } else {
                        console.log(`[AI Extraction] Campaign ${campaignId} not found (Client).`);
                    }
                }
            }

            // 2. Fallback: Use Subworkspace config
            if (customFields.length === 0) {
                console.log(`[AI Extraction] No campaign config, falling back to Subworkspace lookup...`);

                // PRIORITY 1: Use subworkspace_id from metadata (most reliable)
                const metaSubworkspaceId = data.metadata?.subworkspace_id;

                if (metaSubworkspaceId) {
                    console.log(`[AI Extraction] Found subworkspace_id in metadata: ${metaSubworkspaceId}`);

                    if (adminDb) {
                        const subDoc = await adminDb.collection("subworkspaces").doc(metaSubworkspaceId).get();
                        if (subDoc.exists) {
                            const subSettings = subDoc.data();
                            // DEBUG: Log the full structure of analysis_config
                            console.log(`[AI Extraction] DEBUG - Full analysis_config structure:`, JSON.stringify(subSettings?.analysis_config || 'UNDEFINED', null, 2));
                            console.log(`[AI Extraction] DEBUG - analysis_config keys:`, Object.keys(subSettings?.analysis_config || {}));
                            console.log(`[AI Extraction] DEBUG - global_analysis_definitions count:`, subSettings?.global_analysis_definitions?.length || 0);

                            // PRIORITY: Try analysis_config.custom_fields first
                            customFields = subSettings?.analysis_config?.custom_fields || [];

                            // FALLBACK: If empty, use global_analysis_definitions (where TestingEnvironment stores fields)
                            if (customFields.length === 0 && subSettings?.global_analysis_definitions?.length > 0) {
                                console.log(`[AI Extraction] analysis_config.custom_fields is empty, falling back to global_analysis_definitions`);
                                customFields = subSettings!.global_analysis_definitions.filter((f: any) => !f.isArchived);
                                console.log(`[AI Extraction] Loaded ${customFields.length} active fields from global_analysis_definitions`);
                            }

                            configSource = `subworkspace:${metaSubworkspaceId}`;
                            resolvedSubworkspaceId = metaSubworkspaceId;
                            console.log(`[AI Extraction] FOUND! Total ${customFields.length} custom fields from Subworkspace ID (Admin).`);
                            console.log(`[AI Extraction] Custom fields: ${JSON.stringify(customFields.map((f: any) => f.name))}`);
                        } else {
                            console.log(`[AI Extraction] Subworkspace ${metaSubworkspaceId} not found (Admin)`);
                        }
                    } else {
                        const subDoc = await getDoc(doc(db, "subworkspaces", metaSubworkspaceId));
                        if (subDoc.exists()) {
                            const subSettings = subDoc.data();
                            // PRIORITY: Try analysis_config.custom_fields first
                            customFields = subSettings?.analysis_config?.custom_fields || [];

                            // FALLBACK: If empty, use global_analysis_definitions
                            if (customFields.length === 0 && subSettings?.global_analysis_definitions?.length > 0) {
                                console.log(`[AI Extraction] analysis_config.custom_fields is empty, falling back to global_analysis_definitions (Client)`);
                                customFields = subSettings.global_analysis_definitions.filter((f: any) => !f.isArchived);
                            }

                            configSource = `subworkspace:${metaSubworkspaceId}`;
                            resolvedSubworkspaceId = metaSubworkspaceId;
                            console.log(`[AI Extraction] FOUND! Loaded ${customFields.length} custom fields from Subworkspace ID (Client).`);
                        } else {
                            console.log(`[AI Extraction] Subworkspace ${metaSubworkspaceId} not found (Client)`);
                        }
                    }
                }

                // PRIORITY 2: Fallback to retell_agent_id query (legacy / phone calls)
                if (customFields.length === 0) {
                    console.log(`[AI Extraction] Searching for subworkspace with retell_agent_id = "${data.agent_id}"`);

                    try {
                        if (adminDb) {
                            const snapshot = await adminDb.collection("subworkspaces").where("retell_agent_id", "==", data.agent_id).get();
                            if (!snapshot.empty) {
                                const subSettings = snapshot.docs[0].data();
                                // PRIORITY: analysis_config.custom_fields
                                customFields = subSettings?.analysis_config?.custom_fields || [];

                                // FALLBACK: global_analysis_definitions
                                if (customFields.length === 0 && subSettings?.global_analysis_definitions?.length > 0) {
                                    console.log(`[AI Extraction] Falling back to global_analysis_definitions (agent_id lookup)`);
                                    customFields = subSettings.global_analysis_definitions.filter((f: any) => !f.isArchived);
                                }

                                configSource = `subworkspace:${snapshot.docs[0].id}`;
                                resolvedSubworkspaceId = snapshot.docs[0].id;
                                console.log(`[AI Extraction] FOUND! Loaded ${customFields.length} custom fields from Subworkspace by agent_id (Admin).`);
                            } else {
                                console.log(`[AI Extraction] NO MATCH FOUND for agent ${data.agent_id} (Admin)`);
                            }
                        } else {
                            console.warn("[AI Extraction] Admin SDK not available. Skipping Client SDK fallback to avoid permission errors.");
                        }
                    } catch (err) {
                        console.error("[AI Extraction] Error resolving subworkspace by agent_id:", err);
                    }
                }
            }

            // Filter out archived fields
            activeFields = customFields.filter((f: any) => !f.isArchived);

            console.log(`[AI Extraction] ========================================`);
            console.log(`[AI Extraction] Final Check Before OpenAI Call:`);
            console.log(`[AI Extraction]   - Total custom fields found: ${customFields.length}`);
            console.log(`[AI Extraction]   - Active (non-archived) fields: ${activeFields.length}`);
            console.log(`[AI Extraction]   - Active field names: ${JSON.stringify(activeFields.map((f: any) => f.name))}`);
            console.log(`[AI Extraction]   - Transcript text length: ${transcriptText?.length || 0} chars`);
            console.log(`[AI Extraction]   - Config source: ${configSource}`);
            console.log(`[AI Extraction] ========================================`);

            if (activeFields.length > 0 && transcriptText) {
                console.log(`[AI Extraction] ✅ PROCEEDING with OpenAI analysis for ${activeFields.length} fields...`);

                if (!process.env.OPENAI_API_KEY) {
                    console.warn("[AI Extraction] Missing OPENAI_API_KEY, skipping local extraction.");
                } else {
                    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

                    const prompt = `
                        Analyze the following call transcript and extract the requested variables. 
                        Return ONLY a valid JSON object with a key "custom_analysis_data" containing an array of objects.
                        Each object must have: "name" (string), "value" (string, number, or boolean), and "rationale" (string).
                        
                        Variables to extract:
                        ${activeFields.map((f: any) => {
                        let desc = `- Name: ${f.name}, Type: ${f.type}, Description: ${f.description}`;
                        if (f.type === 'enum' && f.options && f.options.length > 0) {
                            desc += ` \n  IMPORTANT: Value MUST be one of: [${f.options.map((o: string) => `"${o}"`).join(', ')}]`;
                        }
                        return desc;
                    }).join('\n')}
                        
                        Transcript:
                        ${transcriptText}
                    `;

                    const completion = await openai.chat.completions.create({
                        messages: [{ role: "system", content: "You are a precise data extraction assistant." }, { role: "user", content: prompt }],
                        model: "gpt-4o-mini",
                        response_format: { type: "json_object" }
                    });

                    const result = JSON.parse(completion.choices[0].message.content || "{}");

                    if (result.custom_analysis_data && Array.isArray(result.custom_analysis_data) && result.custom_analysis_data.length > 0) {
                        // Safe Merge Strategy:
                        // Don't just overwrite, merge with existing data (e.g. from Retell native analysis)
                        let mergedData = [...(analysis.custom_analysis_data || [])];

                        result.custom_analysis_data.forEach((newItem: any) => {
                            const paramsIndex = mergedData.findIndex((existing: any) => existing.name === newItem.name);
                            if (paramsIndex >= 0) {
                                // Overwrite if new value is present
                                mergedData[paramsIndex] = newItem;
                            } else {
                                mergedData.push(newItem);
                            }
                        });

                        analysis.custom_analysis_data = mergedData;
                        console.log(`[AI Extraction] Successfully generated/merged ${result.custom_analysis_data.length} data points.`);
                    } else {
                        console.log(`[AI Extraction] OpenAI returned empty/invalid custom_analysis_data, preserving existing data.`);
                    }
                }
            } else {
                const skipReason = activeFields.length === 0
                    ? `No active custom fields (total found: ${customFields.length}, active after filter: ${activeFields.length})`
                    : `Empty transcript (length: ${transcriptText?.length || 0})`;
                console.log(`[AI Extraction] ⚠️ SKIPPING extraction: ${skipReason}`);
            }
        } catch (err) {
            console.error("[AI Extraction] Error generating analysis:", err);
        }
    }

    // ─── Inbound Analysis: Lead Detection + Training (PARALLEL) ─────────
    // Cache subworkspace data to avoid redundant Firestore reads
    let cachedSubData: any = null;
    let isInbound = false;
    let leadAnalysis: any = null;
    let trainingFlags: any = null;

    if (transcriptText && resolvedSubworkspaceId && process.env.OPENAI_API_KEY && adminDb) {
        try {
            // Single read for both lead detection and training
            const subDoc = await adminDb.collection('subworkspaces').doc(resolvedSubworkspaceId).get();
            if (subDoc.exists) {
                cachedSubData = subDoc.data()!;
                // Check if inbound
                const parentWorkspaceId = cachedSubData.workspace_id;
                if (parentWorkspaceId) {
                    const wsDoc = await adminDb.collection('workspaces').doc(parentWorkspaceId).get();
                    isInbound = wsDoc.exists && wsDoc.data()?.type === 'inbound';
                }
                if (!isInbound) {
                    isInbound = cachedSubData.type === 'inbound';
                }
            }
        } catch (err) {
            console.error('[Inbound Analysis] Error fetching subworkspace:', err);
        }
    }

    // Run lead detection and training in PARALLEL (they're independent)
    if (isInbound && cachedSubData && transcriptText && process.env.OPENAI_API_KEY) {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const leadDetectionTask = (async () => {
            try {
                console.log(`[Lead Detection] Running for call ${callId}...`);
                const leadPrompt = `Analyze this inbound customer call transcript and determine if the caller is a potential lead — someone who called with interest but did NOT schedule or complete a booking/appointment.

Return ONLY a valid JSON object with:
- "is_potential_lead": boolean (true if they showed interest but didn't schedule/convert)
- "score": number 1-10 (how likely they are to convert if contacted by a human)
- "reason": string (brief explanation in Spanish, max 2 sentences)
- "interest_topic": string (what they were interested in, in Spanish)
- "recommended_action": string (what a human agent should do, in Spanish)

If the caller DID schedule/complete their goal, set is_potential_lead to false.
If the call was too short, spam, or irrelevant, set is_potential_lead to false with score 0.

Transcript:
${transcriptText}`;

                const completion = await openai.chat.completions.create({
                    messages: [
                        { role: 'system', content: 'You are a CRM lead qualification specialist.' },
                        { role: 'user', content: leadPrompt }
                    ],
                    model: 'gpt-4o-mini',
                    response_format: { type: 'json_object' }
                });

                const result = JSON.parse(completion.choices[0].message.content || '{}');
                console.log(`[Lead Detection] Result: is_potential_lead=${result.is_potential_lead}, score=${result.score}`);
                return result;
            } catch (err) {
                console.error('[Lead Detection] Error:', err);
                return null;
            }
        })();

        const trainingTask = (async () => {
            try {
                const agentPrompt = cachedSubData.active_prompt || cachedSubData.prompt_editable_text || '';
                const knowledgeBase = cachedSubData.knowledge_base || '';
                if (!agentPrompt && !knowledgeBase) return null;

                console.log(`[Training] Analyzing call ${callId} for errors...`);
                const trainingPrompt = `You are a QA auditor for an AI phone agent. Analyze the conversation below and identify any errors the AI agent made.

AGENT'S INSTRUCTIONS (Prompt):
${agentPrompt || '(No prompt configured)'}

KNOWLEDGE BASE:
${knowledgeBase || '(No knowledge base configured)'}

CONVERSATION:
${transcriptText}

Evaluate the agent's performance and return ONLY a valid JSON object with:
- "has_errors": boolean (true if the agent made meaningful mistakes)
- "overall_score": number 1-10 (10 = perfect, 1 = terrible)
- "errors": array of objects, each with:
  - "type": one of "kb_contradiction" | "instruction_violation" | "incorrect_info" | "poor_handling" | "missed_opportunity"
  - "description": string (brief description in Spanish, max 2 sentences)
  - "severity": "low" | "medium" | "high"
  - "transcript_excerpt": string (the relevant part of the conversation)

If the agent performed well with no errors, return has_errors: false with an empty errors array.
Ignore minor issues like slightly informal language. Focus on factual errors, KB contradictions, and instruction violations.`;

                const completion = await openai.chat.completions.create({
                    messages: [
                        { role: 'system', content: 'You are a strict but fair QA auditor for AI phone agents.' },
                        { role: 'user', content: trainingPrompt }
                    ],
                    model: 'gpt-4o-mini',
                    response_format: { type: 'json_object' }
                });

                const result = JSON.parse(completion.choices[0].message.content || '{}');
                console.log(`[Training] Result: has_errors=${result.has_errors}, score=${result.overall_score}, errors=${result.errors?.length || 0}`);
                return result;
            } catch (err) {
                console.error('[Training] Error:', err);
                return null;
            }
        })();

        // Wait for both in parallel
        const [leadResult, trainingResult] = await Promise.all([leadDetectionTask, trainingTask]);
        leadAnalysis = leadResult;
        trainingFlags = trainingResult;
    }

    const updates: any = {
        analysis: analysis, // The full analysis object
        event_type: 'call_analyzed',
        post_call_analysis_done: true,
        updated_at: adminDb ? admin.firestore.FieldValue.serverTimestamp() : serverTimestamp(),
        ...(resolvedSubworkspaceId && { subworkspace_id: resolvedSubworkspaceId }),
        // Lead detection fields
        ...(leadAnalysis && {
            is_potential_lead: leadAnalysis.is_potential_lead || false,
            lead_analysis: leadAnalysis,
            ...(leadAnalysis.is_potential_lead && { lead_status: 'new' }),
        }),
        // Training error detection fields
        ...(trainingFlags && {
            training_flags: trainingFlags,
        }),
        ...(process.env.NODE_ENV !== 'production' && {
            _debug: {
                adminDbInitialized: !!adminDb,
                configuredFieldsCount: customFields?.length || 0,
                activeFieldsCount: activeFields?.length || 0,
                extractedFieldsCount: analysis.custom_analysis_data?.length || 0,
                hasCustomFields: analysis.custom_analysis_data?.length > 0 || false,
                customFieldsCount: analysis.custom_analysis_data?.length || 0,
                resolvedSubworkspaceId: resolvedSubworkspaceId || 'NONE',
                configSource: configSource || 'NONE',
                timestampProcessed: new Date().toISOString()
            }
        })
    };

    if (transcriptNodes) {
        updates.transcript_object = transcriptNodes;
    }

    // Merge these updates (prefer Admin SDK)
    if (adminDb) {
        await adminDb.collection('calls').doc(callId).set(updates, { merge: true });
    } else {
        await setDoc(doc(db, "calls", callId), updates, { merge: true });
    }
    console.log(`[call.analyzed] Analysis updated for ${callId}. Debug: ${JSON.stringify(updates._debug)}`);
}