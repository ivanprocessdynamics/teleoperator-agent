import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import crypto from 'crypto';

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

export async function POST(req: Request) {
    try {
        // 1. Validate Signature (Optional but recommended)
        const signature = req.headers.get("x-retell-signature");
        if (process.env.RETELL_WEBHOOK_SECRET && signature) {
            const bodyText = await req.text();
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RETELL_WEBHOOK_SECRET)
                .update(bodyText)
                .digest('hex');

            if (signature !== expectedSignature) {
                console.error("Invalid Retell signature");
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            // Parse body after reading text
            var body = JSON.parse(bodyText);
        } else {
            var body = await req.json();
        }

        const { event, call_id, call } = body;
        const callId = call_id || call?.call_id;

        if (!callId) {
            return NextResponse.json({ error: "No call_id provided" }, { status: 400 });
        }

        console.log(`Webhook Event: ${event} | Call ID: ${callId}`);

        // Extract Call Data (normalized)
        const callData = call || body; // 'call_ended' puts data in 'call', 'call.analyzed' might be at root or 'call'

        // 2. Event Routing
        if (event === "call_ended") {
            // Priority: Save Transcript IMMEDIATELY
            await handleCallEnded(callId, callData);
        }
        else if (event === "call.analyzed" || event === "call_analyzed") {
            // Secondary: enrich with Analysis later
            await handleCallAnalyzed(callId, callData);
        }
        else if (event === "call_started") {
            console.log("Call started event received");
            // Optional: Log start time or active status
        }

        return NextResponse.json({ received: true }, { status: 200 });

    } catch (error: any) {
        console.error("Webhook Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function handleCallEnded(callId: string, data: any) {
    // Determine transcript
    let transcriptNodes = [];

    if (data.transcript_object && Array.isArray(data.transcript_object)) {
        transcriptNodes = data.transcript_object;
    } else if (data.transcript) {
        // Fallback to text parsing
        transcriptNodes = parseTranscript(data.transcript);
    }

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
    console.log(`[call_ended] Transcript saved for ${callId}`);
}

async function handleCallAnalyzed(callId: string, data: any) {
    const analysis = data.call_analysis || {};

    // We update ONLY the analysis fields + transcript (if improved)
    // Sometimes call.analyzed has a better/final transcript

    let transcriptNodes = null;
    if (data.transcript_object && Array.isArray(data.transcript_object)) {
        transcriptNodes = data.transcript_object;
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
