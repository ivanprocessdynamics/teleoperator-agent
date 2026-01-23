import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from "firebase/firestore";

export async function POST(req: Request) {
    try {
        const event = await req.json();
        const { event_type, call_id, transcript, call_analysis, metadata, disconnection_reason } = event;

        console.log("Received Webhook:", event_type, call_id, "Metadata:", metadata);

        // ====================================================================
        // CAMPAIGN ROW UPDATES
        // When we launch a campaign call, we store campaign_id and row_id in metadata.
        // ====================================================================
        if (metadata?.campaign_id && metadata?.row_id) {
            const rowRef = doc(db, "campaign_rows", metadata.row_id);

            if (event_type === "call_started") {
                await updateDoc(rowRef, {
                    status: "calling",
                    call_id: call_id,
                    called_at: Timestamp.now(),
                });
            } else if (event_type === "call_ended") {
                // Determine final status based on disconnection_reason
                let finalStatus: 'completed' | 'failed' | 'no_answer' = 'completed';

                const failedReasons = ['dial_failed', 'dial_busy', 'error_unknown', 'error_retell', 'scam_detected'];
                const noAnswerReasons = ['dial_no_answer', 'voicemail_reached', 'user_not_joined'];

                if (failedReasons.includes(disconnection_reason)) {
                    finalStatus = 'failed';
                } else if (noAnswerReasons.includes(disconnection_reason)) {
                    finalStatus = 'no_answer';
                }

                await updateDoc(rowRef, {
                    status: finalStatus,
                    last_error: finalStatus !== 'completed' ? disconnection_reason : null,
                });
            }
        }

        // ====================================================================
        // LEGACY: Contact-based updates (for backward compatibility)
        // ====================================================================
        if (call_id) {
            const q = query(collection(db, "contacts"), where("retell_call_id", "==", call_id));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const contactDoc = querySnapshot.docs[0];
                let newStatus = contactDoc.data().status;

                if (event_type === "call_started") {
                    newStatus = "on_call";
                } else if (event_type === "call_ended") {
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
