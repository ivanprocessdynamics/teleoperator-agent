import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { adminDb } from "@/lib/firebase-admin";
import { doc, setDoc, serverTimestamp, getDoc, query, collection, where, getDocs, updateDoc, Timestamp } from "firebase/firestore";
import crypto from 'crypto';
import OpenAI from "openai";

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
async function updateCampaignRowStatus(callId: string, data: any, eventType: 'started' | 'ended') {
    const result = { success: false, method: 'none', error: null as any };
    try {
        console.log(`[Campaign Row] Updating status for call ${callId} (${eventType})`);

        // 1. Try with Admin SDK (Preferred for permissions)
        if (adminDb) {
            console.log("[Campaign Row] Using Admin SDK");
            try {
                const rowsSnapshot = await adminDb.collection("campaign_rows").where("call_id", "==", callId).get();
                if (!rowsSnapshot.empty) {
                    const rowDoc = rowsSnapshot.docs[0];
                    console.log(`[Campaign Row] Found row ${rowDoc.id} (Admin)`);

                    if (eventType === 'started') {
                        await rowDoc.ref.update({
                            status: 'calling',
                            called_at: new Date(), // Admin SDK uses calling Date or Firestore Timestamp
                        });
                    } else if (eventType === 'ended') {
                        let finalStatus = 'completed';
                        const disconnectionReason = data.disconnection_reason;
                        const failedReasons = ['dial_failed', 'dial_busy', 'error_unknown', 'error_retell', 'scam_detected', 'error_llm_websocket_open', 'error_llm_websocket_lost_connection'];
                        const noAnswerReasons = ['dial_no_answer', 'voicemail_reached', 'user_not_joined', 'registered_call_timeout'];

                        if (disconnectionReason && failedReasons.includes(disconnectionReason)) {
                            finalStatus = 'failed';
                        } else if (disconnectionReason && noAnswerReasons.includes(disconnectionReason)) {
                            finalStatus = 'no_answer';
                        }

                        await rowDoc.ref.update({
                            status: finalStatus,
                            last_error: finalStatus !== 'completed' ? disconnectionReason : null,
                        });
                    }
                    console.log(`[Campaign Row] Updated successfully (Admin)`);
                    result.success = true;
                    result.method = 'admin-sdk';
                    return result; // Done
                } else {
                    result.error = 'row-not-found-admin';
                }
            } catch (adminErr: any) {
                console.error("[Campaign Row] Admin SDK error:", adminErr);
                result.error = `admin-error: ${adminErr.message}`;
                // Fallthrough to client SDK
            }
        } else {
            result.error = 'admin-sdk-not-initialized';
        }

        // 2. Fallback to Client SDK (Local dev / Misconfigured Admin)
        const q = query(collection(db, "campaign_rows"), where("call_id", "==", callId));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const rowDoc = snapshot.docs[0];
            console.log(`[Campaign Row] Found row ${rowDoc.id} (Client SDK)`);

            if (eventType === 'started') {
                await updateDoc(doc(db, "campaign_rows", rowDoc.id), {
                    status: 'calling',
                    called_at: Timestamp.now(),
                });
            } else if (eventType === 'ended') {
                let finalStatus: 'completed' | 'failed' | 'no_answer' = 'completed';
                const disconnectionReason = data.disconnection_reason;
                const failedReasons = ['dial_failed', 'dial_busy', 'error_unknown', 'error_retell', 'scam_detected', 'error_llm_websocket_open', 'error_llm_websocket_lost_connection'];
                const noAnswerReasons = ['dial_no_answer', 'voicemail_reached', 'user_not_joined', 'registered_call_timeout'];

                if (disconnectionReason && failedReasons.includes(disconnectionReason)) {
                    finalStatus = 'failed';
                } else if (disconnectionReason && noAnswerReasons.includes(disconnectionReason)) {
                    finalStatus = 'no_answer';
                }

                await updateDoc(doc(db, "campaign_rows", rowDoc.id), {
                    status: finalStatus,
                    last_error: finalStatus !== 'completed' ? disconnectionReason : null,
                });
            }
            console.log(`[Campaign Row] Updated successfully (Client SDK)`);
            result.success = true;
            result.method = 'client-sdk';
        } else {
            console.log(`[Campaign Row] No row found for call_id ${callId}`);
            if (!result.error) result.error = 'row-not-found-client';
        }
    } catch (error: any) {
        console.error(`[Campaign Row] Error updating row for call ${callId}:`, error);
        result.error = `client-error: ${error.message}`;
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
            await handleCallEnded(callId, callData);

            // Update Campaign Row Status (if this call was part of a campaign)
            rowUpdateResult = await updateCampaignRowStatus(callId, callData, 'ended');
        }
        else if (event === "call.analyzed" || event === "call_analyzed") {
            // Secondary: enrich with Analysis later
            await handleCallAnalyzed(callId, callData);
        }
        else if (event === "call_started") {
            console.log("Call started event received");
            // Update Campaign Row Status to 'calling'
            rowUpdateResult = await updateCampaignRowStatus(callId, callData, 'started');
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

    // Prepare basic call record
    const docData: any = {
        id: callId,
        agent_id: data.agent_id,
        transcript_object: transcriptNodes, // Structured chat
        recording_url: data.recording_url || null,
        duration: data.duration_ms ? data.duration_ms / 1000 :
            (data.end_timestamp - data.start_timestamp) / 1000,
        start_timestamp: data.start_timestamp,
        end_timestamp: data.end_timestamp,
        disconnection_reason: data.disconnection_reason,
        event_type: 'call_ended',
        metadata: data.metadata || null,
        timestamp: serverTimestamp(), // Required for CallHistoryTable sorting
        updated_at: serverTimestamp(),
    };

    // If this is the FIRST time we see this call, add creation timestamp
    // If it exists, we just update the transcript/status
    const docRef = doc(db, "calls", callId);
    /* 
       We use setDoc with merge: true. 
       If document doesn't exist, it creates it.
       If it exists (maybe from call_started?), it updates it.
    */

    await setDoc(docRef, docData, { merge: true });
    console.log(`[call_ended] Saved for ${callId}`);
}

async function handleCallAnalyzed(callId: string, data: any) {
    let analysis = data.call_analysis || {};

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

    // AI Extraction (Primary for Custom Fields)
    // Campaign-First approach: If call has campaign_id, use that Campaign's config.
    // Otherwise, fall back to Subworkspace config (for Testing Environment calls).
    if (data.agent_id) {
        try {
            console.log(`[AI Extraction] Checking for custom field config for agent ${data.agent_id}`);

            let customFields: any[] = [];
            let configSource = 'none';

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
                if (adminDb) {
                    const snapshot = await adminDb.collection("subworkspaces").where("retell_agent_id", "==", data.agent_id).get();
                    if (!snapshot.empty) {
                        const subSettings = snapshot.docs[0].data();
                        customFields = subSettings?.analysis_config?.custom_fields || [];
                        configSource = `subworkspace:${snapshot.docs[0].id}`;
                        console.log(`[AI Extraction] Loaded ${customFields.length} custom fields from Subworkspace (Admin).`);
                    } else {
                        console.log(`[AI Extraction] No subworkspace found for agent ${data.agent_id} (Admin)`);
                    }
                } else {
                    // Fallback to Client SDK
                    const q = query(collection(db, "subworkspaces"), where("retell_agent_id", "==", data.agent_id));
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) {
                        const subSettings = snapshot.docs[0].data();
                        customFields = subSettings?.analysis_config?.custom_fields || [];
                        configSource = `subworkspace:${snapshot.docs[0].id}`;
                        console.log(`[AI Extraction] Loaded ${customFields.length} custom fields from Subworkspace (Client).`);
                    } else {
                        console.log(`[AI Extraction] No subworkspace found for agent ${data.agent_id} (Client)`);
                    }
                }
            }

            // Filter out archived fields
            const activeFields = customFields.filter((f: any) => !f.isArchived);

            if (activeFields.length > 0 && transcriptText) {
                console.log(`[AI Extraction] Generating analysis for ${activeFields.length} active custom fields using OpenAI (source: ${configSource})...`);

                if (!process.env.OPENAI_API_KEY) {
                    console.warn("[AI Extraction] Missing OPENAI_API_KEY, skipping local extraction.");
                } else {
                    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

                    const prompt = `
                        Analyze the following call transcript and extract the requested variables. 
                        Return ONLY a valid JSON object with a key "custom_analysis_data" containing an array of objects.
                        Each object must have: "name" (string), "value" (string, number, or boolean), and "rationale" (string).
                        
                        Variables to extract:
                        ${activeFields.map((f: any) => `- Name: ${f.name}, Type: ${f.type}, Description: ${f.description}`).join('\n')}
                        
                        Transcript:
                        ${transcriptText}
                    `;

                    const completion = await openai.chat.completions.create({
                        messages: [{ role: "system", content: "You are a precise data extraction assistant." }, { role: "user", content: prompt }],
                        model: "gpt-4o-mini",
                        response_format: { type: "json_object" }
                    });

                    const result = JSON.parse(completion.choices[0].message.content || "{}");

                    if (result.custom_analysis_data) {
                        // Merge or Overwrite? User said "OpenAI principal", so we overwrite custom_analysis_data
                        // but we preserve other analysis fields (sentiment, summary) that came from Retell if not configured otherwise.
                        analysis.custom_analysis_data = result.custom_analysis_data;
                        console.log(`[AI Extraction] Successfully generated ${result.custom_analysis_data.length} data points.`);
                    }
                }
            } else {
                console.log(`[AI Extraction] No active custom fields found or empty transcript.`);
            }
        } catch (err) {
            console.error("[AI Extraction] Error generating analysis:", err);
        }
    }

    const updates: any = {
        analysis: analysis, // The full analysis object
        event_type: 'call_analyzed',
        post_call_analysis_done: true,
        updated_at: serverTimestamp()
    };

    if (transcriptNodes) {
        updates.transcript_object = transcriptNodes;
    }

    // Merge these updates
    await setDoc(doc(db, "calls", callId), updates, { merge: true });
    console.log(`[call.analyzed] Analysis updated for ${callId}`);
}
