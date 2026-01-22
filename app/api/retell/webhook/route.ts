import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import crypto from 'crypto';

export async function POST(req: Request) {
    try {
        // 1. Signature Verification (Optional but recommended)
        // const signature = req.headers.get("x-retell-signature");
        // if (!signature) ... verify with process.env.RETELL_WEBHOOK_SECRET

        const body = await req.json();
        const { event, call_id, agent_id, call_analysis, transcript_object, recording_url, end_timestamp } = body;

        console.log(`Webhook received: ${event} for call ${call_id}`);

        if (event === "call.analyzed") {
            // 2. Save to Firestore
            // We use 'calls' collection.
            // ID = call_id

            const callData = {
                id: call_id,
                agent_id: agent_id,
                // We don't have campaign_id in the webhook body unless passed as metadata.
                // If we passed it in create-web-call > metadata, we could retrieve it.
                // For now, we store what we have.
                analysis: call_analysis || {}, // { custom_analysis_data: [ ... ], call_summary: "...", user_sentiment: "..." }
                transcript_object: transcript_object || [],
                recording_url: recording_url || null,
                duration: (end_timestamp - body.start_timestamp) / 1000,
                timestamp: serverTimestamp(), // Use server timestamp for sorting
                created_at_iso: new Date().toISOString()
            };

            await setDoc(doc(db, "calls", call_id), callData);

            console.log(`Call ${call_id} saved to Firestore.`);
        }

        return NextResponse.json({ received: true }, { status: 200 });

    } catch (error: any) {
        console.error("Error processing webhook:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
