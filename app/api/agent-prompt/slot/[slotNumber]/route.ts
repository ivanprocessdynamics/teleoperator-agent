import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
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
        // Find the subworkspace assigned to this slot
        const q = query(
            collection(db, "subworkspaces"),
            where("retell_slot", "==", slot),
            limit(1)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            // If no agent is assigned to this slot, allow a default prompt or 404
            // Returning a default prompt is safer for avoiding errors in Retell
            return NextResponse.json({
                prompt: "Waiting for agent assignment..."
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

        return NextResponse.json({
            prompt: promptToReturn
        });

    } catch (error) {
        console.error("Error fetching prompt by slot:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
