import { NextResponse } from "next/server";
import { signInAnonymously } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slotNumber: string }> }
) {
    const { slotNumber } = await params;
    const slot = parseInt(slotNumber);

    if (isNaN(slot)) {
        return new NextResponse("Invalid Slot Number", { status: 400 });
    }

    try {
        // Verify DB is initialized
        if (!db || (Object.keys(db).length === 0 && db.constructor === Object)) {
            throw new Error("Database not initialized. Server missing Firebase configuration.");
        }

        // Attempt anonymous sign-in to satisfying basic security rules (req.auth != null)
        if (auth) {
            try {
                await signInAnonymously(auth);
            } catch (authError) {
                console.warn("Anonymous auth failed:", authError);
                // Continue anyway, maybe rules are public or it was already signed in
            }
        }

        // Find the subworkspace assigned to this slot
        const q = query(
            collection(db, "subworkspaces"),
            where("retell_slot", "==", slot),
            limit(1)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return new NextResponse("<html><body><p>Waiting for agent assignment...</p></body></html>", {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        const data = snapshot.docs[0].data();

        // Priority: active_prompt (set by campaigns/testing) > combined prompts
        let promptToReturn = data.active_prompt;

        if (!promptToReturn) {
            // Fallback to concatenated prompts
            const corePrompt = data.prompt_core_text || "";
            const editablePrompt = data.prompt_editable_text || "";
            promptToReturn = `${corePrompt}\n\n${editablePrompt}`;
        }

        return new NextResponse(`<html><body><div id="content">${promptToReturn}</div></body></html>`, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });

    } catch (error: any) {
        console.error("Error fetching prompt by slot:", error);
        return new NextResponse(JSON.stringify({ error: error.message, stack: error.stack }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
