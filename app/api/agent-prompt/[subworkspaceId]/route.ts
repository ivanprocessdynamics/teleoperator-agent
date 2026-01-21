import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ subworkspaceId: string }> }
) {
    const { subworkspaceId } = await params;

    if (!subworkspaceId) {
        return new NextResponse("Missing Subworkspace ID", { status: 400 });
    }

    try {
        const subRef = doc(db, "subworkspaces", subworkspaceId);
        const subSnap = await getDoc(subRef);

        if (!subSnap.exists()) {
            return new NextResponse("Subworkspace not found", { status: 404 });
        }

        const data = subSnap.data();

        // Priority: active_prompt (set by campaigns/testing) > combined prompts
        let promptToReturn = data.active_prompt;

        if (!promptToReturn) {
            // Fallback to concatenated prompts
            const corePrompt = data.prompt_core_text || "";
            const editablePrompt = data.prompt_editable_text || "";
            promptToReturn = `${corePrompt}\n\n${editablePrompt}`;
        }

        // Return as JSON for Retell compatibility
        return NextResponse.json({
            prompt: promptToReturn
        });

    } catch (error) {
        console.error("Error fetching prompt:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
