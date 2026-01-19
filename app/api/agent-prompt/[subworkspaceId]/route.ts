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
        // Concatenate prompts
        const corePrompt = data.prompt_core_text || "";
        const editablePrompt = data.prompt_editable_text || "";
        const combinedPrompt = `${corePrompt}\n\n${editablePrompt}`;

        // Return as plain text or JSON as requested by Retell
        // Usually LLM URL expects just the prompt string or a JSON structure matching the LLM request
        // The user requirement said "JSON plano o texto plano". Let's return JSON for flexibility or text if specified.

        return NextResponse.json({
            prompt: combinedPrompt
        });

    } catch (error) {
        console.error("Error fetching prompt:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
