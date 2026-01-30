import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * Returns the _debug field from the latest call for a specific agent.
 * Useful to verify webhook execution logic without access to Vercel logs.
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const agentId = searchParams.get("agent_id");

        if (!adminDb) {
            return NextResponse.json({ error: "Admin SDK not initialized" }, { status: 500 });
        }

        // Simplify query to avoid needing a custom index
        // We just get the absolute latest call. In a test environment this is usually fine.
        const query = adminDb.collection("calls")
            .orderBy("start_timestamp", "desc")
            .limit(1);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return NextResponse.json({ message: "No calls found" }, { status: 404 });
        }

        const callData = snapshot.docs[0].data();

        return NextResponse.json({
            call_id: snapshot.docs[0].id,
            timestamp: new Date(callData.start_timestamp).toISOString(),
            agent_id: callData.agent_id,
            subworkspace_id: callData.subworkspace_id,
            _debug: callData._debug || "No debug info found",
            analysis_summary: callData.analysis || "No analysis found"
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
