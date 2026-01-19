import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";

export async function POST(req: Request) {
    try {
        const event = await req.json();
        const { event_type, call_id, transcript, call_analysis } = event;

        // Use retell_call_id to match our contacts
        // Note: In a real app, we'd store the call_id when we launch the campaign
        // For now, let's assume we can match or we just log.

        console.log("Received Webhook:", event_type, call_id);

        // If we have a mechanism to map call_id -> contact_id, we update status here.
        // Since we didn't implement storing call_id on 'Launch Campaign', 
        // we will simulate finding the contact by some metadata or just log successful receipt.

        // Example logic if we had stored retell_call_id on the contact:
        if (call_id) {
            const q = query(collection(db, "contacts"), where("retell_call_id", "==", call_id));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const contactDoc = querySnapshot.docs[0];
                let newStatus = contactDoc.data().status;

                if (event_type === "call.started") {
                    newStatus = "on_call";
                } else if (event_type === "call.ended") {
                    // Determine if answered based on analysis or duration
                    newStatus = "answered"; // Simplify for MVP
                }

                await updateDoc(doc(db, "contacts", contactDoc.id), {
                    status: newStatus,
                    transcript: transcript, // This might be the final transcript object
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
