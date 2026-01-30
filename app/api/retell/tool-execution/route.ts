
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";
import { executeToolCall } from "@/lib/tools-execution";

export async function POST(req: Request) {
    const startTime = Date.now();
    try {
        const body = await req.json();
        console.log("=== TOOL EXECUTION REQUEST ===");
        // console.log("Body:", JSON.stringify(body, null, 2));

        const { agent_id, args, name, call_id } = body;

        if (!agent_id || !name) {
            return NextResponse.json({ error: "Missing required fields (agent_id, name)" }, { status: 400 });
        }

        const response = await executeToolCall({
            agent_id,
            name,
            args,
            call_id
        });

        return NextResponse.json(response);

    } catch (error: any) {
        console.error("Tool Execution Critical Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
