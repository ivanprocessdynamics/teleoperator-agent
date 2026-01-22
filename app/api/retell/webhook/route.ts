import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { event, call_id, call } = body;

        console.log(`Webhook received: ${event} for call ${call_id || call?.call_id}`);

        // Handle both call_ended and call_analyzed events
        // call_ended: contains transcript immediately after call ends
        // call_analyzed: contains transcript + analysis results (processed after)

        if (event === "call_ended" || event === "call.analyzed" || event === "call_analyzed") {
            const callId = call_id || call?.call_id;
            if (!callId) {
                console.error("No call_id found in webhook payload");
                return NextResponse.json({ error: "No call_id" }, { status: 400 });
            }

            // Retell sends data in different structures depending on the event
            // For call_ended: data is in 'call' object
            // For call_analyzed/call.analyzed: data might be at root or in 'call'
            const callData = call || body;

            const transcript = callData.transcript_object || callData.transcript || [];
            const analysis = callData.call_analysis || {};
            const recordingUrl = callData.recording_url || null;
            const agentId = callData.agent_id || null;

            // Calculate duration
            let duration = 0;
            if (callData.end_timestamp && callData.start_timestamp) {
                duration = (callData.end_timestamp - callData.start_timestamp) / 1000;
            }

            const docData: any = {
                id: callId,
                agent_id: agentId,
                transcript_object: transcript,
                recording_url: recordingUrl,
                duration: duration,
                event_type: event, // Track which event saved this
                updated_at: serverTimestamp(),
            };

            // Only add analysis if it exists (from call_analyzed event)
            if (Object.keys(analysis).length > 0) {
                docData.analysis = analysis;
            }

            // Use merge to not overwrite existing data if call_ended already saved
            await setDoc(doc(db, "calls", callId), docData, { merge: true });

            console.log(`Call ${callId} saved/updated in Firestore from ${event} event.`);
        }

        return NextResponse.json({ received: true }, { status: 200 });

    } catch (error: any) {
        console.error("Error processing webhook:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
