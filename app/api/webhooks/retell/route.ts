import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from "firebase/firestore";

export async function POST(req: Request) {
    try {
        const event = await req.json();

        // Log the full event for debugging
        console.log("=== RETELL WEBHOOK RECEIVED ===");
        console.log("Full event:", JSON.stringify(event, null, 2));

        // Retell sends event as 'event' or directly as properties
        const eventType = event.event || event.event_type;
        const callId = event.call?.call_id || event.call_id;
        const metadata = event.call?.metadata || event.metadata;
        const disconnectionReason = event.call?.disconnection_reason || event.disconnection_reason;
        const transcript = event.call?.transcript || event.transcript;

        console.log("Parsed - eventType:", eventType, "callId:", callId, "metadata:", metadata);

        // ====================================================================
        // CAMPAIGN ROW UPDATES
        // When we launch a campaign call, we store campaign_id and row_id in metadata.
        // ====================================================================
        if (metadata?.campaign_id && metadata?.row_id) {
            console.log("Updating campaign row:", metadata.row_id, "with event:", eventType);

            try {
                const rowRef = doc(db, "campaign_rows", metadata.row_id);

                if (eventType === "call_started") {
                    await updateDoc(rowRef, {
                        status: "calling",
                        call_id: callId,
                        called_at: Timestamp.now(),
                    });
                    console.log("Row updated to 'calling'");
                } else if (eventType === "call_ended") {
                    // Determine final status based on disconnection_reason
                    let finalStatus: 'completed' | 'failed' | 'no_answer' = 'completed';

                    const failedReasons = ['dial_failed', 'dial_busy', 'error_unknown', 'error_retell', 'scam_detected', 'error_llm_websocket_open', 'error_llm_websocket_lost_connection'];
                    const noAnswerReasons = ['dial_no_answer', 'voicemail_reached', 'user_not_joined', 'registered_call_timeout'];

                    if (disconnectionReason && failedReasons.includes(disconnectionReason)) {
                        finalStatus = 'failed';
                    } else if (disconnectionReason && noAnswerReasons.includes(disconnectionReason)) {
                        finalStatus = 'no_answer';
                    }

                    console.log("Setting row status to:", finalStatus, "reason:", disconnectionReason);

                    await updateDoc(rowRef, {
                        status: finalStatus,
                        last_error: finalStatus !== 'completed' ? disconnectionReason : null,
                    });
                    console.log("Row updated successfully");
                } else if (eventType === "call_analyzed") {
                    // Call analysis is ready - could store analysis results here
                    console.log("Call analyzed:", callId);
                }
            } catch (updateError) {
                console.error("Error updating campaign row:", updateError);
            }
        } else {
            console.log("No campaign metadata found, checking for call_id fallback");
        }

        // ====================================================================
        // FALLBACK: Update by call_id if metadata wasn't present
        // ====================================================================
        if (callId && (!metadata?.campaign_id || !metadata?.row_id)) {
            const q = query(collection(db, "campaign_rows"), where("call_id", "==", callId));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                console.log("Found row by call_id:", callId);
                const rowDoc = querySnapshot.docs[0];

                if (eventType === "call_ended") {
                    let finalStatus: 'completed' | 'failed' | 'no_answer' = 'completed';

                    const failedReasons = ['dial_failed', 'dial_busy', 'error_unknown', 'error_retell', 'scam_detected'];
                    const noAnswerReasons = ['dial_no_answer', 'voicemail_reached', 'user_not_joined'];

                    if (disconnectionReason && failedReasons.includes(disconnectionReason)) {
                        finalStatus = 'failed';
                    } else if (disconnectionReason && noAnswerReasons.includes(disconnectionReason)) {
                        finalStatus = 'no_answer';
                    }

                    await updateDoc(doc(db, "campaign_rows", rowDoc.id), {
                        status: finalStatus,
                        last_error: finalStatus !== 'completed' ? disconnectionReason : null,
                    });
                    console.log("Row updated via call_id fallback");
                }
            }
        }

        // ====================================================================
        // LEGACY: Contact-based updates (for backward compatibility)
        // ====================================================================
        if (callId) {
            const q = query(collection(db, "contacts"), where("retell_call_id", "==", callId));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const contactDoc = querySnapshot.docs[0];
                let newStatus = contactDoc.data().status;

                if (eventType === "call_started") {
                    newStatus = "on_call";
                } else if (eventType === "call_ended") {
                    newStatus = "answered";
                }

                await updateDoc(doc(db, "contacts", contactDoc.id), {
                    status: newStatus,
                    transcript: transcript,
                    last_updated: new Date()
                });
            }
        }

        return NextResponse.json({ received: true }, { status: 200 });
    } catch (error) {
        console.error("Error processing webhook:", error);
        return NextResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 }
        );
    }
}
